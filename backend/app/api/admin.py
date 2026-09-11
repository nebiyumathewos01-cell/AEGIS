"""Admin endpoints — user management and approval system.

Privacy rules enforced here:
- Admin sees ONLY account metadata (name, email, status, join date, alert COUNT)
- Admin NEVER sees alert content, raw logs, or analysis results
- All admin actions are recorded in the audit log
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.alert import Alert
from app.models.user import User
from app.services.auth_service import admin_exists, create_user, hash_password
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/admin", tags=["admin"])
settings = get_settings()

# ── Admin guard ───────────────────────────────────────────────────────────────
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return current_user


# ── One-time admin setup ──────────────────────────────────────────────────────
class AdminSetupRequest(BaseModel):
    email: str = Field(..., min_length=5)
    username: str = Field(..., min_length=3)
    full_name: str = Field(..., min_length=2)
    password: str = Field(..., min_length=8)
    setup_key: str  # must match ADMIN_SETUP_KEY env var


@router.post("/setup", status_code=201)
def admin_setup(payload: AdminSetupRequest, db: Session = Depends(get_db)):
    """
    One-time endpoint to create the first admin account.
    Disabled permanently once an admin exists.
    """
    # Check setup key
    expected_key = os.environ.get("ADMIN_SETUP_KEY", "AEGIS_SETUP_2024")
    if payload.setup_key != expected_key:
        raise HTTPException(403, "Invalid setup key")

    # Only works once
    if admin_exists(db):
        raise HTTPException(400, "Admin account already exists. Setup is disabled.")

    from app.services.auth_service import get_user_by_email, get_user_by_username
    if get_user_by_email(db, payload.email):
        raise HTTPException(400, "Email already registered")
    if get_user_by_username(db, payload.username):
        raise HTTPException(400, "Username already taken")

    admin = create_user(
        db, email=payload.email, username=payload.username,
        full_name=payload.full_name, password=payload.password,
        role="admin", approval_status="approved",
    )
    admin.approved_at = datetime.now(timezone.utc)
    db.flush()
    return {
        "message": "Admin account created successfully.",
        "email": admin.email,
        "username": admin.username,
        "role": admin.role,
    }


# ── User list ─────────────────────────────────────────────────────────────────
@router.get("/users")
def list_users(
    status: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Returns user accounts with metadata only.
    Alert content is NEVER included — only alert count.
    """
    q = db.query(User)
    if status:
        q = q.filter(User.approval_status == status)
    users = q.order_by(User.created_at.desc()).all()

    result = []
    for u in users:
        # Only count — never content
        alert_count = db.query(func.count(Alert.id)).filter(
            Alert.owner_id == u.id
        ).scalar()
        result.append({
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "approval_status": u.approval_status,
            "is_active": u.is_active,
            "alert_count": alert_count,
            "created_at": u.created_at.isoformat(),
            "approved_at": u.approved_at.isoformat() if u.approved_at else None,
        })
    return {"total": len(result), "users": result}


# ── Approve user ──────────────────────────────────────────────────────────────
@router.put("/users/{user_id}/approve")
async def approve_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(400, "Cannot modify another admin account")

    user.approval_status = "approved"
    user.is_active = True
    user.approved_at = datetime.now(timezone.utc)
    db.flush()

    await log_action(db, user=admin, action="USER_APPROVED",
                     detail=f"Admin approved user: {user.email}", request=request)
    return {"message": f"User {user.email} approved successfully", "user_id": user_id}


# ── Reject user ───────────────────────────────────────────────────────────────
@router.put("/users/{user_id}/reject")
async def reject_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(400, "Cannot modify another admin account")

    user.approval_status = "rejected"
    user.is_active = False
    db.flush()

    await log_action(db, user=admin, action="USER_REJECTED",
                     detail=f"Admin rejected user: {user.email}", request=request)
    return {"message": f"User {user.email} rejected", "user_id": user_id}


# ── Suspend / unsuspend ───────────────────────────────────────────────────────
@router.put("/users/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(400, "Cannot suspend another admin")

    user.approval_status = "suspended"
    user.is_active = False
    db.flush()

    await log_action(db, user=admin, action="USER_SUSPENDED",
                     detail=f"Admin suspended user: {user.email}", request=request)
    return {"message": f"User {user.email} suspended", "user_id": user_id}


@router.put("/users/{user_id}/unsuspend")
async def unsuspend_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.approval_status = "approved"
    user.is_active = True
    db.flush()

    await log_action(db, user=admin, action="USER_UNSUSPENDED",
                     detail=f"Admin unsuspended user: {user.email}", request=request)
    return {"message": f"User {user.email} unsuspended", "user_id": user_id}


# ── Platform stats (no user data) ────────────────────────────────────────────
@router.get("/stats")
def platform_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total_users    = db.query(func.count(User.id)).scalar()
    pending_users  = db.query(func.count(User.id)).filter(User.approval_status == "pending").scalar()
    approved_users = db.query(func.count(User.id)).filter(User.approval_status == "approved").scalar()
    rejected_users = db.query(func.count(User.id)).filter(User.approval_status == "rejected").scalar()
    suspended_users= db.query(func.count(User.id)).filter(User.approval_status == "suspended").scalar()
    total_alerts   = db.query(func.count(Alert.id)).scalar()

    return {
        "total_users":     total_users,
        "pending_users":   pending_users,
        "approved_users":  approved_users,
        "rejected_users":  rejected_users,
        "suspended_users": suspended_users,
        "total_alerts":    total_alerts,
    }
