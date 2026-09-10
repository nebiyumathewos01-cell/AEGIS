"""Audit log service — records all security-relevant actions."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from fastapi import Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.audit_log import AuditLog
from app.models.user import User


def _get_ip(request: Optional[Request]) -> str | None:
    if not request:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return getattr(request.client, "host", None)


def _get_ua(request: Optional[Request]) -> str | None:
    if not request:
        return None
    ua = request.headers.get("user-agent", "")
    return ua[:256] if ua else None


async def log_action(
    db: Session,
    *,
    user: Optional[User] = None,
    action: str,
    detail: Optional[str] = None,
    request: Optional[Request] = None,
    ip_override: Optional[str] = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else None,
        full_name=user.full_name if user else None,
        action=action,
        detail=detail,
        ip_address=ip_override or _get_ip(request),
        user_agent=_get_ua(request),
    )
    db.add(entry)
    db.flush()
    return entry


def get_audit_logs(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
) -> tuple[int, list[AuditLog]]:
    q = db.query(AuditLog)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    items = q.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()
    return total, items
