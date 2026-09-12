"""Playbook endpoints — generate and manage response playbooks."""
from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.alert import Alert
from app.models.environment_profile import EnvironmentProfile
from app.models.playbook import Playbook
from app.models.user import User
from app.services.playbook_service import generate_playbook

router = APIRouter(prefix="/api/playbook", tags=["playbook"])


class StepUpdate(BaseModel):
    step_number: int
    status: str  # approved / skipped / done


def _serialize(pb: Playbook) -> dict:
    steps = json.loads(pb.steps) if isinstance(pb.steps, str) else pb.steps
    return {
        "id": pb.id,
        "alert_id": pb.alert_id,
        "threat_type": pb.threat_type,
        "steps": steps,
        "status": pb.status,
        "created_at": pb.created_at.isoformat(),
        "updated_at": pb.updated_at.isoformat(),
    }


@router.post("/{alert_id}/generate", status_code=201)
def generate_alert_playbook(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a response playbook for an alert."""
    alert = db.query(Alert).filter(
        Alert.id == alert_id, Alert.owner_id == current_user.id
    ).first()
    if not alert:
        raise HTTPException(404, "Alert not found")

    # Get environment profile
    profile_obj = db.query(EnvironmentProfile).filter(
        EnvironmentProfile.owner_id == current_user.id
    ).first()
    profile = {}
    if profile_obj:
        profile = {
            "cloud":          profile_obj.cloud or "",
            "os":             profile_obj.os or "",
            "firewall":       profile_obj.firewall or "",
            "ids_ips":        profile_obj.ids_ips or "",
            "web_server":     profile_obj.web_server or "",
            "app_framework":  profile_obj.app_framework or "",
            "database":       profile_obj.database or "",
        }

    steps = generate_playbook(
        alert_type=alert.alert_type,
        source_ip=alert.source_ip,
        username=alert.username,
        risk_level=alert.risk_level,
        profile=profile,
    )

    # Remove existing playbook for this alert
    db.query(Playbook).filter(Playbook.alert_id == alert_id).delete()
    db.flush()

    pb = Playbook(
        alert_id=alert_id,
        owner_id=current_user.id,
        threat_type=alert.alert_type,
        steps=json.dumps(steps),
        status="pending",
    )
    db.add(pb)
    db.flush()
    db.refresh(pb)
    return _serialize(pb)


@router.get("/{alert_id}")
def get_playbook(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pb = db.query(Playbook).filter(
        Playbook.alert_id == alert_id,
        Playbook.owner_id == current_user.id,
    ).first()
    if not pb:
        raise HTTPException(404, "No playbook found for this alert")
    return _serialize(pb)


@router.put("/{alert_id}/steps")
def update_step(
    alert_id: int,
    payload: StepUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyst approves or skips a playbook step."""
    pb = db.query(Playbook).filter(
        Playbook.alert_id == alert_id,
        Playbook.owner_id == current_user.id,
    ).first()
    if not pb:
        raise HTTPException(404, "Playbook not found")

    steps = json.loads(pb.steps)
    updated = False
    for step in steps:
        if step["step_number"] == payload.step_number:
            step["status"] = payload.status
            updated = True
            break

    if not updated:
        raise HTTPException(404, f"Step {payload.step_number} not found")

    # Update overall playbook status
    statuses = {s["status"] for s in steps}
    if all(s in ("approved", "skipped", "done") for s in
           [s["status"] for s in steps]):
        pb.status = "completed"
    elif "approved" in statuses or "done" in statuses:
        pb.status = "in_progress"

    pb.steps = json.dumps(steps)
    db.flush()
    return _serialize(pb)
