"""Admin endpoints — user management.
Privacy: admin sees only account metadata, never alert content.
"""
from __future__ import annotations
import os
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.alert import Alert
from app.models.user import User
from app.services.auth_service import admin_exists, create_user
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return current_user


class AdminSetupRequest(BaseModel):
    email: str = Field(..., min_length=5)
    username: str = Field(..., min_length=3)
    full_name: str = Field(..., min_length=2)
    password: str = Field(..., min_length=8)
    setup_key: str


@router.post("/setup", status_code=201)
def admin_setup(payload: AdminSetupRequest, db: Session = Depends(get_db)):
    expected = os.environ.get("ADMIN_SETUP_KEY", "AEGIS_SETUP_2024")
    if payload.setup_key != expected:
        raise HTTPException(403, "Invalid setup key")
    if admin_exists(db):
        raise HTTPException(400, "Admin already exists. Setup disabled.")
    from app.services.auth_service import get_user_by_email, get_user_by_username
    if get_user_by_email(db, payload.email):
        raise HTTPException(400, "Email already registered")
    if get_user_by_username(db, payload.username):
        raise HTTPException(400, "Username already taken")
    admin = create_user(db, email=payload.email, username=payload.username,
                        full_name=payload.full_name, password=payload.password,
                        role="admin")
    return {"message": "Admin created", "email": admin.email, "role": admin.role}


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        count = db.query(func.count(Alert.id)).filter(Alert.owner_id == u.id).scalar()
        result.append({
            "id": u.id, "email": u.email, "username": u.username,
            "full_name": u.full_name, "role": u.role,
            "is_active": u.is_active, "alert_count": count,
            "created_at": u.created_at.isoformat(),
        })
    return {"total": len(result), "users": result}


@router.put("/users/{user_id}/suspend")
async def suspend_user(user_id: int, request: Request,
                       db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(400, "Cannot suspend another admin")
    user.is_active = False
    db.flush()
    await log_action(db, user=admin, action="USER_SUSPENDED",
                     detail=f"Suspended: {user.email}", request=request)
    return {"message": f"{user.email} suspended"}


@router.put("/users/{user_id}/unsuspend")
async def unsuspend_user(user_id: int, request: Request,
                         db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = True
    db.flush()
    await log_action(db, user=admin, action="USER_UNSUSPENDED",
                     detail=f"Restored: {user.email}", request=request)
    return {"message": f"{user.email} restored"}


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return {
        "total_users":    db.query(func.count(User.id)).scalar(),
        "active_users":   db.query(func.count(User.id)).filter(User.is_active == True).scalar(),
        "suspended_users":db.query(func.count(User.id)).filter(User.is_active == False).scalar(),
        "total_alerts":   db.query(func.count(Alert.id)).scalar(),
    }
