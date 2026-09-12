"""Environment Profile endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.environment_profile import EnvironmentProfile
from app.models.user import User

router = APIRouter(prefix="/api/environment", tags=["environment"])


class ProfilePayload(BaseModel):
    cloud:         str | None = None
    os:            str | None = None
    firewall:      str | None = None
    ids_ips:       str | None = None
    web_server:    str | None = None
    app_framework: str | None = None
    database:      str | None = None
    custom_notes:  str | None = None


def _serialize(p: EnvironmentProfile) -> dict:
    return {
        "id": p.id,
        "cloud": p.cloud,
        "os": p.os,
        "firewall": p.firewall,
        "ids_ips": p.ids_ips,
        "web_server": p.web_server,
        "app_framework": p.app_framework,
        "database": p.database,
        "custom_notes": p.custom_notes,
        "context_string": p.to_context_string(),
        "updated_at": p.updated_at.isoformat(),
    }


@router.get("")
def get_profile(db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    profile = db.query(EnvironmentProfile).filter(
        EnvironmentProfile.owner_id == current_user.id
    ).first()
    if not profile:
        return {"id": None, "cloud": None, "os": None, "firewall": None,
                "ids_ips": None, "web_server": None, "app_framework": None,
                "database": None, "custom_notes": None, "context_string": ""}
    return _serialize(profile)


@router.put("")
def save_profile(payload: ProfilePayload,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    profile = db.query(EnvironmentProfile).filter(
        EnvironmentProfile.owner_id == current_user.id
    ).first()
    if not profile:
        profile = EnvironmentProfile(owner_id=current_user.id)
        db.add(profile)

    for field, value in payload.model_dump().items():
        setattr(profile, field, value)
    db.flush()
    db.refresh(profile)
    return _serialize(profile)
