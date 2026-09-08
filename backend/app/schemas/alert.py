"""Pydantic schemas for Alert."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


VALID_STATUSES = {"new", "investigating", "false_positive", "confirmed", "resolved"}
VALID_SOURCES = {"auth", "nmap", "suricata", "generic"}


class AlertCreate(BaseModel):
    raw_alert: str = Field(..., min_length=1, max_length=50_000)
    source: str = Field(default="generic")

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in VALID_SOURCES:
            return "generic"
        return v


class AlertStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in VALID_STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {VALID_STATUSES}")
        return v


class AnalysisSummary(BaseModel):
    id: int
    summary: str
    threat_interpretation: str
    evidence: str
    risk_explanation: str
    recommendations: list[str]
    ai_model: str
    is_ai_generated: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertSummary(BaseModel):
    id: int
    timestamp: datetime | None
    source: str
    alert_type: str
    source_ip: str | None
    risk_score: float
    risk_level: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertRead(BaseModel):
    id: int
    timestamp: datetime | None
    source: str
    alert_type: str
    source_ip: str | None
    destination_ip: str | None
    source_port: int | None
    destination_port: int | None
    protocol: str | None
    username: str | None
    attempt_count: int | None
    raw_alert: str
    parsed_data: dict[str, Any] | None
    risk_score: float
    risk_level: str
    risk_factors: list[dict[str, Any]] | None
    status: str
    created_at: datetime
    updated_at: datetime
    analysis: AnalysisSummary | None
    notes: list[Any]

    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    total: int
    items: list[AlertSummary]
