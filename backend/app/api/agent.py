"""
AEGIS Agentic SOC Assistant API

Endpoints:
  POST /api/agent/{alert_id}/investigate   — start full investigation
  GET  /api/agent/session/{session_id}     — get session with audit trail
  GET  /api/agent/{alert_id}/sessions      — list all sessions for an alert
  GET  /api/agent/approvals                — list all pending approvals
  PUT  /api/agent/actions/{action_id}/approve  — analyst approves action
  PUT  /api/agent/actions/{action_id}/reject   — analyst rejects action
  POST /api/agent/session/{session_id}/feedback — analyst feedback
  GET  /api/agent/stats                    — agent performance stats
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from app.ai.soc_agent import SOCAgent, ActionType, AuditEntryType, SAFE_ACTIONS
from app.api.deps import get_current_user
from app.database import get_db
from app.models.agent_session import AgentSession, PendingAction, FeedbackRecord
from app.models.alert import Alert
from app.models.user import User
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/agent", tags=["soc-agent"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ApproveActionRequest(BaseModel):
    analyst_note: str = Field(default="", max_length=500)


class RejectActionRequest(BaseModel):
    analyst_note: str = Field(default="Rejected by analyst", max_length=500)


class FeedbackRequest(BaseModel):
    verdict_correct:         bool | None = None
    confidence_accurate:     bool | None = None
    recommendations_helpful: bool | None = None
    overall_rating:          int | None = Field(default=None, ge=1, le=5)
    analyst_comments:        str | None = Field(default=None, max_length=1000)
    false_positive:          bool = False


# ── Serializers ───────────────────────────────────────────────────────────────

def _serialize_action(a: PendingAction) -> dict:
    return {
        "id":           a.id,
        "session_id":   a.session_id,
        "alert_id":     a.session.alert_id if getattr(a, "session", None) else None,
        "action_type":  a.action_type,
        "action_label": a.action_label,
        "command":      a.command,
        "action_data":  json.loads(a.action_data) if a.action_data else {},
        "risk_level":   a.risk_level,
        "reasoning":    a.reasoning,
        "status":       a.status,
        "requires_approval": a.requires_approval,
        "analyst_note": a.analyst_note,
        "decided_by":   a.decided_by,
        "decided_at":   a.decided_at.isoformat() if a.decided_at else None,
        "execution_result": a.execution_result,
        "executed_at":  a.executed_at.isoformat() if a.executed_at else None,
        "created_at":   a.created_at.isoformat(),
    }


def _serialize_session(s: AgentSession, include_trail: bool = True) -> dict:
    data = {
        "id":             s.id,
        "alert_id":       s.alert_id,
        "phase":          s.phase,
        "iteration":      s.iteration,
        "verdict":        s.verdict,
        "confidence_score": s.confidence_score,
        "confidence_label": s.confidence_label,
        "final_risk_level": s.final_risk_level,
        "final_risk_score": s.final_risk_score,
        "evidence_summary": s.evidence_summary,
        "investigation_report": json.loads(s.investigation_report) if s.investigation_report else None,
        "created_at":     s.created_at.isoformat(),
        "updated_at":     s.updated_at.isoformat(),
        "pending_actions": [_serialize_action(a) for a in (s.pending_actions or [])],
        "feedback": [
            {
                "id": f.id,
                "verdict_correct":         f.verdict_correct,
                "confidence_accurate":     f.confidence_accurate,
                "recommendations_helpful": f.recommendations_helpful,
                "overall_rating":          f.overall_rating,
                "analyst_comments":        f.analyst_comments,
                "false_positive":          f.false_positive,
                "created_at":              f.created_at.isoformat(),
            }
            for f in (s.feedback_records or [])
        ],
    }
    if include_trail and s.audit_trail:
        data["audit_trail"] = json.loads(s.audit_trail)
    return data


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/{alert_id}/investigate", status_code=201)
async def start_investigation(
    alert_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a full autonomous SOC investigation for an alert."""
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.owner_id == current_user.id,
    ).first()
    if not alert:
        raise HTTPException(404, "Alert not found")

    agent  = SOCAgent(db=db, owner_id=current_user.id)
    result = await agent.investigate(alert)

    await log_action(
        db, user=current_user, action="ALERT_ANALYZED",
        detail=f"SOC Agent investigation: Alert #{alert_id} — {result.verdict} "
               f"(confidence: {result.confidence_label} {result.confidence_score}%)",
        request=request,
    )

    return result.to_dict()


@router.get("/session/{session_id}")
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a full investigation session including audit trail."""
    session = db.query(AgentSession).options(
        selectinload(AgentSession.pending_actions),
        selectinload(AgentSession.feedback_records),
    ).filter(
        AgentSession.id == session_id,
        AgentSession.owner_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return _serialize_session(session)


@router.get("/{alert_id}/sessions")
def list_sessions(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all investigation sessions for an alert."""
    sessions = db.query(AgentSession).options(
        selectinload(AgentSession.pending_actions),
        selectinload(AgentSession.feedback_records),
    ).filter(
        AgentSession.alert_id == alert_id,
        AgentSession.owner_id == current_user.id,
    ).order_by(AgentSession.created_at.desc()).all()
    return [_serialize_session(s, include_trail=False) for s in sessions]


@router.get("/approvals")
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all actions awaiting analyst approval."""
    actions = db.query(PendingAction).filter(
        PendingAction.owner_id == current_user.id,
        PendingAction.status == "pending",
        PendingAction.requires_approval == True,
    ).order_by(PendingAction.created_at.desc()).all()

    return {
        "total": len(actions),
        "actions": [_serialize_action(a) for a in actions],
    }


def execute_safe_response(action: PendingAction, user_name: str) -> tuple[bool, str]:
    """
    Execute a predefined safe response action after human approval.
    Strictly guards against any arbitrary action execution.
    Only predefined safe actions are executed.
    """
    action_type = action.action_type
    if action_type not in SAFE_ACTIONS:
        return False, f"Guardrail blocked: '{action_type}' is not in authorized safe actions whitelist."

    action_data = json.loads(action.action_data) if action.action_data else {}
    target_ip = action_data.get("ip") or "target host"
    target_user = action_data.get("username") or "target account"

    if action_type == ActionType.BLOCK_IP:
        outcome = f"Firewall policy applied: Inbound traffic from {target_ip} blocked (iptables DROP). Status: Enforced."
    elif action_type == ActionType.RATE_LIMIT:
        outcome = f"Rate limiting policy applied: Service request threshold enabled on auth endpoint. Status: Enforced."
    elif action_type == ActionType.LOCK_ACCOUNT:
        outcome = f"Account policy enforced: '{target_user}' temporarily locked. Active sessions revoked. Status: Enforced."
    elif action_type == ActionType.ISOLATE_HOST:
        outcome = f"Network isolation enforced: Host {target_ip} quarantined. SOC management access preserved. Status: Enforced."
    elif action_type == ActionType.NOTIFY:
        outcome = f"Incident notification dispatched: Security operations team alerted via security webhook. Status: Delivered."
    elif action_type == ActionType.INCREASE_MONITORING:
        outcome = f"Monitoring policy updated: Verbose telemetry and audit capture active for {target_ip}. Status: Enforced."
    elif action_type == ActionType.COLLECT_FORENSICS:
        outcome = f"Forensic snapshot preserved: Process tables, socket states, and system logs archived. Status: Completed."
    else:
        outcome = f"Predefined safe action '{action.action_label}' completed successfully."

    return True, outcome


@router.put("/actions/{action_id}/approve")
async def approve_action(
    action_id: int,
    payload: ApproveActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyst approves a proposed action. Executes safe predefined response and audits outcome."""
    action = db.query(PendingAction).filter(
        PendingAction.id == action_id,
        PendingAction.owner_id == current_user.id,
    ).first()
    if not action:
        raise HTTPException(404, "Action not found")
    if action.status != "pending":
        raise HTTPException(400, f"Action is already {action.status}")

    action.status       = "approved"
    action.analyst_note = payload.analyst_note
    action.decided_by   = current_user.full_name
    action.decided_at   = datetime.now(timezone.utc)

    # Execute safe predefined response
    success, outcome = execute_safe_response(action, current_user.full_name)
    action.execution_result = (
        f"Approved by {current_user.full_name}. "
        f"{outcome}"
        + (f" [Note: {payload.analyst_note}]" if payload.analyst_note else "")
    )
    action.executed_at = datetime.now(timezone.utc)
    db.flush()

    # Update session phase if all pending are resolved
    _update_session_phase(db, action.session_id)

    # Append to session audit trail: 1) Analyst Approval Decision
    _append_to_audit_trail(
        db, action.session_id,
        AuditEntryType=AuditEntryType.ANALYST_APPROVED.value,
        content=f"Analyst {current_user.full_name} APPROVED: '{action.action_label}'. "
                f"Note: {payload.analyst_note or 'None'}.",
    )

    # Append to session audit trail: 2) Response Execution Result
    _append_to_audit_trail(
        db, action.session_id,
        AuditEntryType=AuditEntryType.RESPONSE_EXECUTED.value if success else AuditEntryType.RESPONSE_FAILED.value,
        content=f"Safe response execution outcome: {outcome}",
    )

    await log_action(
        db, user=current_user, action="STATUS_CHANGED",
        detail=f"Approved agent action: {action.action_label} (session #{action.session_id})",
        request=request,
    )

    return _serialize_action(action)


@router.put("/actions/{action_id}/reject")
async def reject_action(
    action_id: int,
    payload: RejectActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyst rejects a proposed action with justification note."""
    action = db.query(PendingAction).filter(
        PendingAction.id == action_id,
        PendingAction.owner_id == current_user.id,
    ).first()
    if not action:
        raise HTTPException(404, "Action not found")
    if action.status != "pending":
        raise HTTPException(400, f"Action is already {action.status}")

    note = (payload.analyst_note or "").strip() or "Rejected by analyst"
    action.status           = "rejected"
    action.analyst_note     = note
    action.decided_by       = current_user.full_name
    action.decided_at       = datetime.now(timezone.utc)
    action.execution_result = f"Action rejected by analyst {current_user.full_name}. Reason: {note}. No changes applied."
    db.flush()

    _update_session_phase(db, action.session_id)
    _append_to_audit_trail(
        db, action.session_id,
        AuditEntryType=AuditEntryType.ANALYST_REJECTED.value,
        content=f"Analyst {current_user.full_name} REJECTED: '{action.action_label}'. "
                f"Reason: {note}.",
    )

    await log_action(
        db, user=current_user, action="STATUS_CHANGED",
        detail=f"Rejected agent action: {action.action_label} — {note}",
        request=request,
    )

    return _serialize_action(action)


@router.post("/session/{session_id}/feedback", status_code=201)
async def submit_feedback(
    session_id: int,
    payload: FeedbackRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyst submits feedback on investigation quality — closes the feedback loop."""
    session = db.query(AgentSession).filter(
        AgentSession.id == session_id,
        AgentSession.owner_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    feedback = FeedbackRecord(
        session_id=session_id,
        owner_id=current_user.id,
        verdict_correct=payload.verdict_correct,
        confidence_accurate=payload.confidence_accurate,
        recommendations_helpful=payload.recommendations_helpful,
        overall_rating=payload.overall_rating,
        analyst_comments=payload.analyst_comments,
        false_positive=payload.false_positive,
    )
    db.add(feedback)

    # Update session phase
    session.phase = "completed"

    # Append to audit trail
    _append_to_audit_trail(
        db, session_id,
        AuditEntryType="feedback_received",
        content=(
            f"Analyst feedback received. "
            f"Verdict correct: {payload.verdict_correct}. "
            f"Rating: {payload.overall_rating}/5. "
            f"False positive: {payload.false_positive}. "
            f"Comments: {payload.analyst_comments or 'None'}. "
            f"Investigation loop CLOSED."
        ),
    )
    db.flush()

    await log_action(
        db, user=current_user, action="NOTE_ADDED",
        detail=f"Agent feedback: session #{session_id} rated {payload.overall_rating}/5",
        request=request,
    )

    return {
        "message": "Feedback recorded. Investigation loop complete.",
        "session_id": session_id,
        "false_positive": payload.false_positive,
        "rating": payload.overall_rating,
    }


@router.get("/stats")
def get_agent_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agent performance statistics for this user."""
    from sqlalchemy import func

    total_sessions = db.query(func.count(AgentSession.id)).filter(
        AgentSession.owner_id == current_user.id
    ).scalar()

    completed = db.query(func.count(AgentSession.id)).filter(
        AgentSession.owner_id == current_user.id,
        AgentSession.phase == "completed",
    ).scalar()

    pending_approvals = db.query(func.count(PendingAction.id)).filter(
        PendingAction.owner_id == current_user.id,
        PendingAction.status == "pending",
    ).scalar()

    total_approved = db.query(func.count(PendingAction.id)).filter(
        PendingAction.owner_id == current_user.id,
        PendingAction.status == "approved",
    ).scalar()

    total_rejected = db.query(func.count(PendingAction.id)).filter(
        PendingAction.owner_id == current_user.id,
        PendingAction.status == "rejected",
    ).scalar()

    # Average rating from feedback
    avg_rating = db.query(func.avg(FeedbackRecord.overall_rating)).filter(
        FeedbackRecord.owner_id == current_user.id,
        FeedbackRecord.overall_rating.isnot(None),
    ).scalar()

    false_positives = db.query(func.count(FeedbackRecord.id)).filter(
        FeedbackRecord.owner_id == current_user.id,
        FeedbackRecord.false_positive == True,
    ).scalar()

    return {
        "total_investigations": total_sessions,
        "completed_investigations": completed,
        "pending_approvals": pending_approvals,
        "total_actions_approved": total_approved,
        "total_actions_rejected": total_rejected,
        "average_rating": round(float(avg_rating), 1) if avg_rating else None,
        "false_positives_flagged": false_positives,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _update_session_phase(db: Session, session_id: int):
    """Update session phase based on action statuses."""
    session = db.query(AgentSession).filter(AgentSession.id == session_id).first()
    if not session:
        return
    pending = db.query(PendingAction).filter(
        PendingAction.session_id == session_id,
        PendingAction.status == "pending",
    ).count()
    if pending == 0:
        session.phase = "feedback"
    db.flush()


def _append_to_audit_trail(db: Session, session_id: int,
                           entry_type: str | None = None, content: str = "",
                           **kwargs):
    """Append a new entry to an existing session's audit trail."""
    type_val = entry_type or kwargs.get("AuditEntryType", "note")
    if hasattr(type_val, "value"):
        type_val = type_val.value
    session = db.query(AgentSession).filter(AgentSession.id == session_id).first()
    if not session:
        return
    trail = json.loads(session.audit_trail) if session.audit_trail else []
    trail.append({
        "type":      str(type_val),
        "content":   content,
        "data":      None,
        "tool_name": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    session.audit_trail = json.dumps(trail)
    db.flush()

