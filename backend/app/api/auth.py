from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.auth_service import (
    authenticate_user, create_access_token, create_user,
    get_user_by_email, get_user_by_username,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/auth", tags=["auth"])


COMMON_PASSWORDS = {
    "password", "12345678", "123456789", "password1", "iloveyou",
    "sunshine", "princess", "football", "welcome1", "shadow123",
    "monkey123", "dragon123", "master123", "abc12345", "letmein1",
    "qwerty123", "passw0rd", "starwars", "baseball", "superman",
    "batman123", "trustno1", "hello123", "freedom1", "whatever",
    "admin123", "login123", "test1234", "pass1234", "qwertyui",
}


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=256)
    username: str = Field(..., min_length=3, max_length=64)
    full_name: str = Field(..., min_length=2, max_length=128)
    # NIST SP 800-63B: min 8 chars, no max complexity requirements
    password: str = Field(..., min_length=8, max_length=256)

    @field_validator("username")
    @classmethod
    def username_lowercase(cls, v: str) -> str:
        v = v.lower().strip()
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username can only contain lowercase letters, numbers, _ and -")
        return v

    @field_validator("password")
    @classmethod
    def password_nist(cls, v: str) -> str:
        # NIST SP 800-63B: check against common passwords
        if v.lower() in COMMON_PASSWORDS:
            raise ValueError(
                "This password is too commonly used. "
                "Please choose a different password (NIST SP 800-63B)."
            )
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
    }


@router.post("/register", status_code=201)
async def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(400, "Email already registered")
    if get_user_by_username(db, payload.username):
        raise HTTPException(400, "Username already taken")
    user = create_user(db, email=payload.email, username=payload.username,
                       full_name=payload.full_name, password=payload.password)
    await log_action(db, user=user, action="REGISTER",
                     detail=f"New account: {user.email}", request=request)
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": _user_dict(user)}


@router.post("/login")
async def login_form(request: Request, form: OAuth2PasswordRequestForm = Depends(),
                     db: Session = Depends(get_db)):
    user = authenticate_user(db, form.username, form.password)
    if not user:
        await log_action(db, action="LOGIN_FAILED",
                         detail=f"Failed login: {form.username}", request=request)
        raise HTTPException(401, "Incorrect email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    await log_action(db, user=user, action="LOGIN_SUCCESS",
                     detail=f"Login: {user.email}", request=request)
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": _user_dict(user)}


@router.post("/login/json")
async def login_json(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        await log_action(db, action="LOGIN_FAILED",
                         detail=f"Failed login: {payload.email}", request=request)
        raise HTTPException(401, "Incorrect email or password")
    await log_action(db, user=user, action="LOGIN_SUCCESS",
                     detail=f"Login: {user.email}", request=request)
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": _user_dict(user)}


@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    await log_action(db, user=current_user, action="LOGOUT",
                     detail=f"Logout: {current_user.email}", request=request)
    return {"message": "Signed out"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)
