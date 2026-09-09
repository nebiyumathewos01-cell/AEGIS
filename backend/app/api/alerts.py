"""Alert endpoints — all scoped to authenticated user."""
from __future__ import annotations
import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.ai import AIAnalyzer
from app.api.deps import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.parsers import parse_alert
from app.rules import RuleEngine
from app.schemas.alert import AlertCreate, AlertStatusUpdate
from app.services.alert_service import (
    create_alert, get_alert, list_alerts,
    save_analysis, update_alert_status,
)

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
settings = get_settings()
_rule_engine = RuleEngine()
_ai_analyzer = AIAnalyzer()


def _ser(alert):
    data = {
        "id": alert.id,
        "timestamp": alert.timestamp.isoformat() if alert.timestamp else None,
        "source": alert.source, "alert_type": alert.alert_type,
        "source_ip": alert.source_ip, "destination_ip": alert.destination_ip,
        "source_port": alert.source_port, "destination_port": alert.destination_port,
        "protocol": alert.protocol, "username": alert.username,
        "attempt_count": alert.attempt_count, "raw_alert": alert.raw_alert,
        "parsed_data": json.loads(alert.parsed_data) if alert.parsed_data else None,
        "risk_score": alert.risk_score, "risk_level": alert.risk_level,
        "risk_factors": json.loads(alert.risk_factors) if alert.risk_factors else None,
        "status": alert.status,
        "created_at": alert.created_at.isoformat(),
        "updated_at": alert.updated_at.isoformat(),
        "analysis": None, "notes": [],
    }
    if getattr(alert, "analysis", None):
        a = alert.analysis
        recs = json.loads(a.recommendations) if isinstance(a.recommendations, str) else a.recommendations
        data["analysis"] = {
            "id": a.id, "summary": a.summary,
            "threat_interpretation": a.threat_interpretation,
            "evidence": a.evidence, "risk_explanation": a.risk_explanation,
            "recommendations": recs, "ai_model": a.ai_model,
            "is_ai_generated": a.is_ai_generated,
            "created_at": a.created_at.isoformat(),
        }
    if getattr(alert, "notes", None):
        data["notes"] = [
            {"id": n.id, "alert_id": n.alert_id, "note": n.note,
             "analyst": n.analyst, "created_at": n.created_at.isoformat()}
            for n in alert.notes
        ]
    return data


@router.post("", status_code=201)
def submit_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = create_alert(db, payload, owner_id=current_user.id)
    return _ser(alert)


@router.post("/upload", status_code=201)
async def upload_alert_file(
    file: UploadFile = File(...),
    source: str = Query(default="generic"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (file.filename or "").endswith((".log", ".txt")):
        raise HTTPException(400, "Only .log and .txt files accepted")
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(413, f"File exceeds {settings.max_upload_size_mb} MB")
    raw = content.decode("utf-8", errors="replace")
    alert = create_alert(db, AlertCreate(raw_alert=raw, source=source), owner_id=current_user.id)
    return _ser(alert)


@router.get("")
def get_alerts(
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
    risk_level: str | None = None, alert_type: str | None = None,
    source_ip: str | None = None, status: str | None = None,
    search: str | None = None,
    date_from: datetime | None = None, date_to: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total, alerts = list_alerts(
        db, owner_id=current_user.id, skip=skip, limit=limit,
        risk_level=risk_level, alert_type=alert_type, source_ip=source_ip,
        status=status, search=search, date_from=date_from, date_to=date_to,
    )
    return {"total": total, "items": [
        {"id": a.id,
         "timestamp": a.timestamp.isoformat() if a.timestamp else None,
         "source": a.source, "alert_type": a.alert_type,
         "source_ip": a.source_ip, "risk_score": a.risk_score,
         "risk_level": a.risk_level, "status": a.status,
         "created_at": a.created_at.isoformat()}
        for a in alerts
    ]}


@router.get("/{alert_id}")
def get_alert_detail(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = get_alert(db, alert_id, owner_id=current_user.id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    return _ser(alert)


@router.post("/{alert_id}/analyze")
async def analyze_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = get_alert(db, alert_id, owner_id=current_user.id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    parsed = parse_alert(alert.raw_alert, source_hint=alert.source)
    rule_result = _rule_engine.analyze(parsed)
    ai_result = await _ai_analyzer.analyze(parsed, rule_result)
    analysis = save_analysis(
        db, alert_id=alert_id, owner_id=current_user.id,
        summary=ai_result.summary,
        threat_interpretation=ai_result.threat_interpretation,
        evidence=ai_result.evidence,
        risk_explanation=ai_result.risk_explanation,
        recommendations=ai_result.recommendations,
        ai_model=ai_result.ai_model,
        is_ai_generated=ai_result.is_ai_generated,
    )
    recs = json.loads(analysis.recommendations) if isinstance(analysis.recommendations, str) else analysis.recommendations
    return {
        "id": analysis.id, "alert_id": analysis.alert_id,
        "summary": analysis.summary,
        "threat_interpretation": analysis.threat_interpretation,
        "evidence": analysis.evidence, "risk_explanation": analysis.risk_explanation,
        "recommendations": recs, "ai_model": analysis.ai_model,
        "is_ai_generated": analysis.is_ai_generated,
        "created_at": analysis.created_at.isoformat(),
    }


@router.put("/{alert_id}/status")
def change_status(
    alert_id: int, payload: AlertStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = update_alert_status(db, alert_id, owner_id=current_user.id, payload=payload)
    if not alert:
        raise HTTPException(404, "Alert not found")
    return {"id": alert.id, "status": alert.status}
