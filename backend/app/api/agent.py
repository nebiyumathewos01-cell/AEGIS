"""AEGIS Agent API endpoints."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.ai.aegis_agent import AEGISAgent
from app.api.deps import get_current_user
from app.database import get_db
from app.models.alert import Alert
from app.models.user import User
from app.services.audit_service import log_action
from fastapi import Request

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/{alert_id}/investigate")
async def run_agent_investigation(
    alert_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run full autonomous agent investigation on an alert.
    Returns complete result with all steps and final report.
    """
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.owner_id == current_user.id,
    ).first()
    if not alert:
        raise HTTPException(404, "Alert not found")

    agent = AEGISAgent(db=db, owner_id=current_user.id)
    result = await agent.investigate(alert)

    await log_action(
        db, user=current_user, action="ALERT_ANALYZED",
        detail=f"Agent investigation: Alert #{alert_id} — {result.verdict}",
        request=request,
    )

    return result.to_dict()


@router.post("/{alert_id}/investigate/stream")
async def stream_agent_investigation(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream agent investigation steps in real-time using Server-Sent Events.
    Frontend receives each step as it happens.
    """
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.owner_id == current_user.id,
    ).first()
    if not alert:
        raise HTTPException(404, "Alert not found")

    async def event_generator():
        agent = AEGISAgent(db=db, owner_id=current_user.id)
        result = await agent.investigate(alert)

        # Stream each step
        for step in result.steps:
            data = json.dumps({"type": "step", "data": step.to_dict()})
            yield f"data: {data}\n\n"

        # Stream final result
        final_data = json.dumps({
            "type": "complete",
            "data": result.to_dict(),
        })
        yield f"data: {final_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{alert_id}/status")
def get_agent_status(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if an alert has been investigated by the agent."""
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.owner_id == current_user.id,
    ).first()
    if not alert:
        raise HTTPException(404, "Alert not found")

    return {
        "alert_id": alert_id,
        "has_analysis": alert.analysis is not None,
        "alert_type": alert.alert_type,
        "risk_level": alert.risk_level,
    }
