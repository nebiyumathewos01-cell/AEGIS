import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.alert_service import get_alert

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/{alert_id}")
def get_report(alert_id: int, db: Session = Depends(get_db)):
    alert = get_alert(db, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    analysis = None
    if alert.analysis:
        a = alert.analysis
        recs = json.loads(a.recommendations) if isinstance(a.recommendations, str) else a.recommendations
        analysis = {"summary": a.summary, "threat_interpretation": a.threat_interpretation,
                    "evidence": a.evidence, "risk_explanation": a.risk_explanation,
                    "recommendations": recs, "ai_model": a.ai_model,
                    "is_ai_generated": a.is_ai_generated, "created_at": a.created_at.isoformat()}
    notes = [{"id": n.id, "note": n.note, "analyst": n.analyst,
              "created_at": n.created_at.isoformat()} for n in (alert.notes or [])]
    return {
        "report_generated_at": datetime.now(timezone.utc).isoformat(),
        "alert": {"id": alert.id, "alert_type": alert.alert_type, "source": alert.source,
                  "source_ip": alert.source_ip, "destination_ip": alert.destination_ip,
                  "protocol": alert.protocol, "destination_port": alert.destination_port,
                  "username": alert.username, "attempt_count": alert.attempt_count,
                  "risk_score": alert.risk_score, "risk_level": alert.risk_level,
                  "status": alert.status,
                  "timestamp": alert.timestamp.isoformat() if alert.timestamp else None,
                  "created_at": alert.created_at.isoformat()},
        "parsed_data": json.loads(alert.parsed_data) if alert.parsed_data else {},
        "risk_factors": json.loads(alert.risk_factors) if alert.risk_factors else [],
        "analysis": analysis, "notes": notes,
    }
