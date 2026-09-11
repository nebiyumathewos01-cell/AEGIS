from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import DateTime, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # approval_status: pending | approved | rejected | suspended
    approval_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)

    # role: analyst | admin
    role: Mapped[str] = mapped_column(String(32), default="analyst")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    alerts: Mapped[list] = relationship(
        "Alert", back_populates="owner", cascade="all, delete-orphan"
    )
