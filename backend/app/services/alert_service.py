"""Synchronous business logic for alert CRUD and analysis."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload

from app.models import Alert, Analysis, InvestigationNote
from app.parsers import parse_alert
from app.rules import RuleEngine
from app.schemas.alert import AlertCreate, AlertStatusUpdate

_rule_engine = RuleEngine()


def _sanitize(text: str) -> str:
    return (text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#x27;"))


def create_alert(db: Session, payload: AlertCreate) -> Alert:
    raw = payload.raw_alert[:50_000]
    parsed = parse_alert(raw, source_hint=payload.source)
    rule_result = _rule_engine.analyze(parsed)

    alert = Alert(
        timestamp=parsed.timestamp or datetime.now(timezone.utc),
        source=parsed.source,
        alert_type=parsed.alert_type,
        source_ip=parsed.source_ip,
        destination_ip=parsed.destination_ip,
        source_port=parsed.source_port,
        destination_port=parsed.destination_port,
        protocol=parsed.protocol,
        username=parsed.username,
        attempt_count=parsed.attempt_count,
        raw_alert=_sanitize(raw),
        parsed_data=json.dumps(parsed.to_dict()),
        risk_score=rule_result.risk_score,
        risk_level=rule_result.risk_level,
        risk_factors=json.dumps(rule_result.to_dict()["risk_factors"]),
        status="new",
    )
    db.add(alert)
    db.flush()
    db.refresh(alert)
    return alert


def get_alert(db: Session, alert_id: int) -> Alert | None:
    return (db.query(Alert)
              .options(selectinload(Alert.analysis), selectinload(Alert.notes))
              .filter(Alert.id == alert_id)
              .first())


def list_alerts(db: Session, *, skip=0, limit=50, risk_level=None,
                alert_type=None, source_ip=None, status=None,
                search=None, date_from=None, date_to=None):
    q = db.query(Alert)
    if risk_level:  q = q.filter(Alert.risk_level == risk_level.upper())
    if alert_type:  q = q.filter(Alert.alert_type == alert_type)
    if source_ip:   q = q.filter(Alert.source_ip == source_ip)
    if status:      q = q.filter(Alert.status == status)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Alert.alert_type.ilike(like),
                         Alert.source_ip.ilike(like),
                         Alert.raw_alert.ilike(like)))
    if date_from:   q = q.filter(Alert.created_at >= date_from)
    if date_to:     q = q.filter(Alert.created_at <= date_to)
    total = q.count()
    items = q.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    return total, items


def update_alert_status(db: Session, alert_id: int, payload: AlertStatusUpdate) -> Alert | None:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        return None
    alert.status = payload.status
    alert.updated_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(alert)
    return alert


def save_analysis(db: Session, alert_id: int, *, summary, threat_interpretation,
                  evidence, risk_explanation, recommendations,
                  ai_model="rule-based", is_ai_generated=False) -> Analysis:
    existing = db.query(Analysis).filter(Analysis.alert_id == alert_id).first()
    if existing:
        db.delete(existing)
        db.flush()
    a = Analysis(
        alert_id=alert_id, summary=summary,
        threat_interpretation=threat_interpretation,
        evidence=evidence, risk_explanation=risk_explanation,
        recommendations=json.dumps(recommendations),
        ai_model=ai_model, is_ai_generated=is_ai_generated,
    )
    db.add(a)
    db.flush()
    db.refresh(a)
    return a


def add_note(db: Session, alert_id: int, *, note: str, analyst="Analyst") -> InvestigationNote:
    n = InvestigationNote(alert_id=alert_id, note=note, analyst=analyst)
    db.add(n)
    db.flush()
    db.refresh(n)
    return n


def get_dashboard_stats(db: Session) -> dict[str, Any]:
    total = db.query(func.count(Alert.id)).scalar()
    levels = {l: db.query(func.count(Alert.id)).filter(Alert.risk_level == l).scalar()
              for l in ("CRITICAL", "HIGH", "MEDIUM", "LOW")}
    statuses = {s: db.query(func.count(Alert.id)).filter(Alert.status == s).scalar()
                for s in ("new", "investigating")}
    top_types = [{"alert_type": r[0], "count": r[1]}
                 for r in db.query(Alert.alert_type, func.count(Alert.id).label("c"))
                             .group_by(Alert.alert_type).order_by(func.count(Alert.id).desc()).limit(5)]
    top_ips = [{"source_ip": r[0], "count": r[1]}
               for r in db.query(Alert.source_ip, func.count(Alert.id).label("c"))
                           .filter(Alert.source_ip.isnot(None))
                           .group_by(Alert.source_ip).order_by(func.count(Alert.id).desc()).limit(5)]
    return {
        "total_alerts": total, "critical_alerts": levels["CRITICAL"],
        "high_alerts": levels["HIGH"], "medium_alerts": levels["MEDIUM"],
        "low_alerts": levels["LOW"], "new_alerts": statuses["new"],
        "investigating_alerts": statuses["investigating"],
        "risk_distribution": levels,
        "top_alert_types": top_types, "top_source_ips": top_ips,
    }
