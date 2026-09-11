"""
API Key management + Webhook endpoint.

Flow:
  External system → POST /api/webhook/alert
                    Header: X-API-Key: aegis_xxxx
  → Validate key → find owner → parse alert → analyze → save
"""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.api_key import ApiKey
from app.models.user import User
from app.parsers import parse_alert
from app.rules import RuleEngine
from app.ai import AIAnalyzer
from app.schemas.alert import AlertCreate
from app.services.alert_service import create_alert, save_analysis

router = APIRouter(tags=["integrations"])
_rule_engine = RuleEngine()
_ai_analyzer = AIAnalyzer()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _generate_key() -> tuple[str, str]:
    """Returns (raw_key, key_hash). raw_key shown once, hash stored."""
    raw = "aegis_" + secrets.token_urlsafe(32)
    return raw, _hash_key(raw)


def _get_key_by_hash(db: Session, raw_key: str) -> ApiKey | None:
    h = _hash_key(raw_key)
    return db.query(ApiKey).filter(
        ApiKey.key_hash == h,
        ApiKey.is_active == True,
    ).first()


# ── API Key management ────────────────────────────────────────────────────────

class KeyCreateRequest(BaseModel):
    label: str = Field(default="Default", max_length=64)


@router.post("/api/keys", status_code=201)
def create_api_key(
    payload: KeyCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new API key for the current user."""
    # Max 5 keys per user
    count = db.query(ApiKey).filter(
        ApiKey.owner_id == current_user.id,
        ApiKey.is_active == True,
    ).count()
    if count >= 5:
        raise HTTPException(400, "Maximum 5 active API keys allowed")

    raw_key, key_hash = _generate_key()
    api_key = ApiKey(
        owner_id=current_user.id,
        key_hash=key_hash,
        key_prefix=raw_key[:14],  # "aegis_" + 8 chars
        label=payload.label,
    )
    db.add(api_key)
    db.flush()
    db.refresh(api_key)

    return {
        "id": api_key.id,
        "key": raw_key,  # shown ONCE — user must copy it
        "key_prefix": api_key.key_prefix,
        "label": api_key.label,
        "created_at": api_key.created_at.isoformat(),
        "warning": "Copy this key now. It will not be shown again.",
    }


@router.get("/api/keys")
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    keys = db.query(ApiKey).filter(
        ApiKey.owner_id == current_user.id,
    ).order_by(ApiKey.created_at.desc()).all()
    return [
        {
            "id": k.id,
            "key_prefix": k.key_prefix + "...",
            "label": k.label,
            "is_active": k.is_active,
            "alert_count": k.alert_count,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "created_at": k.created_at.isoformat(),
        }
        for k in keys
    ]


@router.delete("/api/keys/{key_id}")
def revoke_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.owner_id == current_user.id,
    ).first()
    if not key:
        raise HTTPException(404, "API key not found")
    key.is_active = False
    db.flush()
    return {"message": "API key revoked"}


# ── Webhook endpoint ──────────────────────────────────────────────────────────

class WebhookPayload(BaseModel):
    raw_alert: str = Field(..., min_length=1, max_length=50_000)
    source: str = Field(default="generic")
    auto_analyze: bool = Field(default=True)


@router.post("/api/webhook/alert", status_code=201)
async def webhook_ingest(
    payload: WebhookPayload,
    request: Request,
    db: Session = Depends(get_db),
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    """
    Public webhook endpoint — accepts alerts from external systems.
    Authentication: X-API-Key header with a valid user API key.
    """
    # Validate API key
    api_key_obj = _get_key_by_hash(db, x_api_key)
    if not api_key_obj:
        raise HTTPException(401, "Invalid or revoked API key")

    # Get owner
    owner = db.query(User).filter(
        User.id == api_key_obj.owner_id,
        User.is_active == True,
    ).first()
    if not owner:
        raise HTTPException(401, "Account suspended or not found")

    # Create alert
    alert = create_alert(db, AlertCreate(
        raw_alert=payload.raw_alert,
        source=payload.source,
    ), owner_id=owner.id)

    # Update key usage stats
    api_key_obj.last_used_at = datetime.now(timezone.utc)
    api_key_obj.alert_count += 1
    db.flush()

    analysis_result = None

    # Auto-analyze if requested
    if payload.auto_analyze:
        try:
            parsed = parse_alert(alert.raw_alert, source_hint=alert.source)
            rule_result = _rule_engine.analyze(parsed)
            ai_result = await _ai_analyzer.analyze(parsed, rule_result)
            analysis = save_analysis(
                db, alert_id=alert.id, owner_id=owner.id,
                summary=ai_result.summary,
                threat_interpretation=ai_result.threat_interpretation,
                evidence=ai_result.evidence,
                risk_explanation=ai_result.risk_explanation,
                recommendations=ai_result.recommendations,
                ai_model=ai_result.ai_model,
                is_ai_generated=ai_result.is_ai_generated,
            )
            analysis_result = {
                "summary": analysis.summary,
                "risk_level": alert.risk_level,
                "risk_score": alert.risk_score,
                "ai_model": analysis.ai_model,
            }
        except Exception:
            pass  # analysis failure doesn't block alert creation

    return {
        "alert_id": alert.id,
        "alert_type": alert.alert_type,
        "risk_level": alert.risk_level,
        "risk_score": alert.risk_score,
        "source": alert.source,
        "analysis": analysis_result,
        "dashboard_url": f"/alerts/{alert.id}",
    }


# ── Quick test endpoint ───────────────────────────────────────────────────────

@router.get("/api/webhook/test")
def test_webhook(
    db: Session = Depends(get_db),
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    """Test that your API key is valid."""
    api_key_obj = _get_key_by_hash(db, x_api_key)
    if not api_key_obj:
        raise HTTPException(401, "Invalid or revoked API key")
    owner = db.query(User).filter(User.id == api_key_obj.owner_id).first()
    return {
        "status": "valid",
        "label": api_key_obj.label,
        "owner": owner.full_name if owner else "Unknown",
        "alert_count": api_key_obj.alert_count,
    }
