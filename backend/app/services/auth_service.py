"""Authentication service — password hashing, JWT tokens, user management."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import User

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.app_secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.app_secret_key, algorithms=[ALGORITHM])


# ── User CRUD ──────────────────────────────────────────────────────────────────

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username.lower()).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def admin_exists(db: Session) -> bool:
    return db.query(User).filter(User.role == "admin").first() is not None


def create_user(
    db: Session, *, email: str, username: str,
    full_name: str, password: str,
    role: str = "analyst",
    approval_status: str = "pending",
) -> User:
    user = User(
        email=email.lower().strip(),
        username=username.lower().strip(),
        full_name=full_name.strip(),
        hashed_password=hash_password(password),
        role=role,
        approval_status=approval_status,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Returns user if credentials valid AND account is approved and active."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    # Block pending/rejected/suspended
    if user.approval_status != "approved":
        return None
    if not user.is_active:
        return None
    return user


def get_approval_status(db: Session, email: str) -> str | None:
    """Return just the approval status for a given email (for login error messages)."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    return user.approval_status
