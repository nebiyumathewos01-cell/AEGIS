"""Pydantic schemas for Dashboard stats."""

from __future__ import annotations

from pydantic import BaseModel


class RiskDistribution(BaseModel):
    LOW: int = 0
    MEDIUM: int = 0
    HIGH: int = 0
    CRITICAL: int = 0


class AlertTypeStat(BaseModel):
    alert_type: str
    count: int


class DashboardStats(BaseModel):
    total_alerts: int
    critical_alerts: int
    high_alerts: int
    medium_alerts: int
    low_alerts: int
    new_alerts: int
    investigating_alerts: int
    risk_distribution: RiskDistribution
    top_alert_types: list[AlertTypeStat]
    top_source_ips: list[dict]
