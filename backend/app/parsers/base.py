"""Base data class shared by all parsers."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class ParsedAlert:
    """Structured extraction from a raw security alert."""

    source: str = "generic"
    alert_type: str = "unknown"
    source_ip: str | None = None
    destination_ip: str | None = None
    source_port: int | None = None
    destination_port: int | None = None
    protocol: str | None = None
    username: str | None = None
    timestamp: datetime | None = None
    attempt_count: int | None = None
    severity: str | None = None
    event_ids: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable dictionary of all extracted fields."""
        return {
            "source": self.source,
            "alert_type": self.alert_type,
            "source_ip": self.source_ip,
            "destination_ip": self.destination_ip,
            "source_port": self.source_port,
            "destination_port": self.destination_port,
            "protocol": self.protocol,
            "username": self.username,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "attempt_count": self.attempt_count,
            "severity": self.severity,
            "event_ids": self.event_ids,
            **self.extra,
        }
