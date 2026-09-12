from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class EnvironmentProfile(Base):
    __tablename__ = "environment_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    # Infrastructure
    cloud:        Mapped[str | None] = mapped_column(String(64),  nullable=True)  # AWS/Azure/GCP/On-premise
    os:           Mapped[str | None] = mapped_column(String(64),  nullable=True)  # Linux/Windows/Mixed
    # Network
    firewall:     Mapped[str | None] = mapped_column(String(128), nullable=True)  # iptables/pfSense/AWS SG
    ids_ips:      Mapped[str | None] = mapped_column(String(128), nullable=True)  # Suricata/Snort/None
    # Web tier
    web_server:   Mapped[str | None] = mapped_column(String(64),  nullable=True)  # Nginx/Apache/None
    app_framework:Mapped[str | None] = mapped_column(String(128), nullable=True)  # Node.js/Python/PHP/Java
    # Data tier
    database:     Mapped[str | None] = mapped_column(String(128), nullable=True)  # PostgreSQL/MySQL/MongoDB
    # Additional context
    custom_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_context_string(self) -> str:
        """Build a concise context string for AI prompts."""
        parts = []
        if self.cloud:         parts.append(f"Cloud: {self.cloud}")
        if self.os:            parts.append(f"OS: {self.os}")
        if self.firewall:      parts.append(f"Firewall: {self.firewall}")
        if self.ids_ips:       parts.append(f"IDS/IPS: {self.ids_ips}")
        if self.web_server:    parts.append(f"Web Server: {self.web_server}")
        if self.app_framework: parts.append(f"App Framework: {self.app_framework}")
        if self.database:      parts.append(f"Database: {self.database}")
        if self.custom_notes:  parts.append(f"Notes: {self.custom_notes}")
        return " | ".join(parts) if parts else "No environment profile configured"
