"""Pydantic schemas for Analysis."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AnalysisRead(BaseModel):
    id: int
    alert_id: int
    summary: str
    threat_interpretation: str
    evidence: str
    risk_explanation: str
    recommendations: list[str]
    ai_model: str
    is_ai_generated: bool
    created_at: datetime

    model_config = {"from_attributes": True}
