"""Pydantic schemas for InvestigationNote."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    note: str = Field(..., min_length=1, max_length=5000)
    analyst: str = Field(default="Analyst", max_length=128)


class NoteRead(BaseModel):
    id: int
    alert_id: int
    note: str
    analyst: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
