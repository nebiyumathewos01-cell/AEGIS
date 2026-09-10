"""Audit log endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.audit_service import get_audit_logs

router = APIRouter(prefix="/api/audit", tags=["audit"])

ACTION_LABELS = {
    "LOGIN_SUCCESS":   "Signed In",
    "LOGIN_FAILED":    "Failed Login",
    "LOGOUT":          "Signed Out",
    "REGISTER":        "Registered",
    "ALERT_CREATED":   "Alert Submitted",
    "ALERT_ANALYZED":  "Alert Analyzed",
    "STATUS_CHANGED":  "Status Updated",
    "NOTE_ADDED":      "Note Added",
    "REPORT_EXPORTED": "Report Exported",
    "DEMO_LOADED":     "Demo Loaded",
    "TI_LOOKUP":       "Threat Intel Lookup",
}


@router.get("/logs")
def get_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Admins see all logs; analysts see only their own
    uid = None if current_user.role == "admin" else current_user.id
    total, logs = get_audit_logs(db, skip=skip, limit=limit,
                                 user_id=uid, action=action)
    return {
        "total": total,
        "items": [
            {
                "id": l.id,
                "user_id": l.user_id,
                "username": l.username,
                "full_name": l.full_name,
                "action": l.action,
                "action_label": ACTION_LABELS.get(l.action, l.action),
                "detail": l.detail,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
    }


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = None if current_user.role == "admin" else current_user.id
    _, all_logs = get_audit_logs(db, limit=1000, user_id=uid)
    action_counts: dict[str, int] = {}
    for l in all_logs:
        action_counts[l.action] = action_counts.get(l.action, 0) + 1

    last_login = next(
        (l for l in all_logs if l.action == "LOGIN_SUCCESS"), None
    )
    return {
        "total_actions": len(all_logs),
        "login_count": action_counts.get("LOGIN_SUCCESS", 0),
        "failed_login_count": action_counts.get("LOGIN_FAILED", 0),
        "alerts_created": action_counts.get("ALERT_CREATED", 0),
        "last_login": last_login.created_at.isoformat() if last_login else None,
        "last_login_ip": last_login.ip_address if last_login else None,
        "action_counts": action_counts,
    }
