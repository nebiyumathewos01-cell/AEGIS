"""
Agent Session — tracks a complete autonomous investigation including
reasoning steps, tool calls, evidence, approval gates, responses, and feedback.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.alert import Alert



class AgentSession(Base):
    """One full investigation session for one alert."""
    __tablename__ = "agent_sessions"

    id:        Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    alert_id:  Mapped[int] = mapped_column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    owner_id:  Mapped[int] = mapped_column(Integer, ForeignKey("users.id",  ondelete="CASCADE"), index=True)

    # Phase: investigating | awaiting_approval | responding | feedback | completed | failed
    phase:            Mapped[str]   = mapped_column(String(32),  default="investigating")
    iteration:        Mapped[int]   = mapped_column(Integer,     default=1)
    verdict:          Mapped[str | None] = mapped_column(String(128), nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float,       default=0.0)
    confidence_label: Mapped[str]   = mapped_column(String(16),  default="LOW")
    final_risk_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    final_risk_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Full audit trail as JSON
    audit_trail:      Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of AuditEntry
    evidence_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    investigation_report: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    alert: Mapped[Alert] = relationship("Alert", back_populates="agent_sessions")
    pending_actions: Mapped[list[PendingAction]] = relationship(
        "PendingAction", back_populates="session", cascade="all, delete-orphan",
        order_by="PendingAction.created_at"
    )
    feedback_records: Mapped[list[FeedbackRecord]] = relationship(
        "FeedbackRecord", back_populates="session", cascade="all, delete-orphan"
    )


class PendingAction(Base):
    """
    An action the agent wants to take that requires human approval.
    Read-only investigation = automatic.
    State-changing actions = require analyst approval.
    """
    __tablename__ = "pending_actions"

    id:          Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id:  Mapped[int] = mapped_column(Integer, ForeignKey("agent_sessions.id", ondelete="CASCADE"), index=True)
    owner_id:    Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # Action details
    action_type:  Mapped[str] = mapped_column(String(64))   # block_ip | rate_limit | lock_account | notify | increase_monitoring
    action_label: Mapped[str] = mapped_column(String(256))  # human-readable description
    action_data:  Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: parameters
    command:      Mapped[str | None] = mapped_column(Text, nullable=True)  # exact command to run
    risk_level:   Mapped[str] = mapped_column(String(16), default="low")   # low | medium | high
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True)

    # Agent reasoning for why it wants this action
    reasoning:    Mapped[str | None] = mapped_column(Text, nullable=True)

    # Analyst decision
    # status: pending | approved | rejected | modified | executed | failed
    status:       Mapped[str] = mapped_column(String(32), default="pending")
    analyst_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by:   Mapped[str | None] = mapped_column(String(128), nullable=True)
    decided_at:   Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Execution result
    execution_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at:      Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    session: Mapped[AgentSession] = relationship("AgentSession", back_populates="pending_actions")


class FeedbackRecord(Base):
    """
    Analyst feedback on an agent investigation.
    Used to improve future agent behavior and confidence calibration.
    """
    __tablename__ = "feedback_records"

    id:         Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("agent_sessions.id", ondelete="CASCADE"), index=True)
    owner_id:   Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    verdict_correct:      Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # was agent verdict correct?
    confidence_accurate:  Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # was confidence level right?
    recommendations_helpful: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    overall_rating:       Mapped[int | None]  = mapped_column(Integer, nullable=True)  # 1-5
    analyst_comments:     Mapped[str | None]  = mapped_column(Text, nullable=True)
    false_positive:       Mapped[bool]        = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    session: Mapped[AgentSession] = relationship("AgentSession", back_populates="feedback_records")
