from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    alert_id: Mapped[int] = mapped_column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), unique=True, index=True)
    summary: Mapped[str] = mapped_column(Text)
    threat_interpretation: Mapped[str] = mapped_column(Text)
    evidence: Mapped[str] = mapped_column(Text)
    risk_explanation: Mapped[str] = mapped_column(Text)
    recommendations: Mapped[str] = mapped_column(Text)  # JSON
    ai_model: Mapped[str] = mapped_column(String(128), default="rule-based")
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    alert: Mapped[Alert] = relationship("Alert", back_populates="analysis")
