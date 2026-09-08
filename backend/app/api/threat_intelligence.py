"""Threat Intelligence enrichment endpoint."""

from __future__ import annotations

import logging
import re

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/threat-intelligence", tags=["threat-intelligence"])
settings = get_settings()

_IP_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
_DOMAIN_RE = re.compile(r"^[a-zA-Z0-9.\-]{1,253}$")


class TIRequest(BaseModel):
    ioc: str  # IP address or domain

    @field_validator("ioc")
    @classmethod
    def validate_ioc(cls, v: str) -> str:
        v = v.strip()
        if not (_IP_RE.match(v) or _DOMAIN_RE.match(v)):
            raise ValueError("Invalid IP address or domain")
        if len(v) > 253:
            raise ValueError("IOC too long")
        return v


# ── Demo data for when no API key is configured ──────────────────────────────
_DEMO_DATA: dict[str, dict] = {
    "192.168.1.50": {
        "ioc": "192.168.1.50",
        "ioc_type": "ip",
        "reputation": "Private/Internal",
        "malicious_count": 0,
        "suspicious_count": 0,
        "harmless_count": 0,
        "last_analysis_date": "N/A",
        "country": "N/A",
        "asn": "N/A",
        "owner": "Private network",
        "categories": [],
        "tags": ["private", "rfc1918"],
        "source": "demo",
        "note": "Private IP address — not routable on the public internet.",
    },
    "10.0.0.1": {
        "ioc": "10.0.0.1",
        "ioc_type": "ip",
        "reputation": "Private/Internal",
        "malicious_count": 0,
        "suspicious_count": 0,
        "harmless_count": 0,
        "last_analysis_date": "N/A",
        "country": "N/A",
        "asn": "N/A",
        "owner": "Private network",
        "categories": [],
        "tags": ["private", "rfc1918"],
        "source": "demo",
        "note": "Private IP address — not routable on the public internet.",
    },
}

_DEMO_DEFAULT = {
    "ioc_type": "ip",
    "reputation": "Unknown",
    "malicious_count": 0,
    "suspicious_count": 0,
    "harmless_count": 0,
    "last_analysis_date": "N/A",
    "country": "Unknown",
    "asn": "Unknown",
    "owner": "Unknown",
    "categories": [],
    "tags": [],
    "source": "demo",
    "note": "No VirusTotal API key configured. Configure VIRUSTOTAL_API_KEY for live lookups.",
}


async def _query_virustotal(ioc: str) -> dict:
    """Query VirusTotal v3 API for an IP or domain."""
    is_ip = bool(_IP_RE.match(ioc))
    endpoint = "ip_addresses" if is_ip else "domains"
    url = f"https://www.virustotal.com/api/v3/{endpoint}/{ioc}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            url,
            headers={"x-apikey": settings.virustotal_api_key},
        )
        resp.raise_for_status()
        data = resp.json()

    attrs = data.get("data", {}).get("attributes", {})
    stats = attrs.get("last_analysis_stats", {})
    ts = attrs.get("last_analysis_date")
    last_date = (
        str(ts) if ts else "N/A"
    )

    return {
        "ioc": ioc,
        "ioc_type": "ip" if is_ip else "domain",
        "reputation": attrs.get("reputation", 0),
        "malicious_count": stats.get("malicious", 0),
        "suspicious_count": stats.get("suspicious", 0),
        "harmless_count": stats.get("harmless", 0),
        "last_analysis_date": last_date,
        "country": attrs.get("country", "Unknown"),
        "asn": str(attrs.get("asn", "Unknown")),
        "owner": attrs.get("as_owner", "Unknown"),
        "categories": list(attrs.get("categories", {}).values())[:5],
        "tags": attrs.get("tags", [])[:10],
        "source": "virustotal",
    }


@router.post("/ip")
async def lookup_ioc(payload: TIRequest) -> dict:
    ioc = payload.ioc

    # Use VirusTotal if API key is configured
    if settings.virustotal_api_key:
        try:
            return await _query_virustotal(ioc)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {**_DEMO_DEFAULT, "ioc": ioc, "note": "IOC not found in VirusTotal database."}
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid VirusTotal API key")
            logger.warning("VirusTotal API error %s: %s", e.response.status_code, e)
            raise HTTPException(status_code=502, detail="Threat intelligence service unavailable")
        except Exception as e:
            logger.warning("TI lookup failed: %s", e)
            raise HTTPException(status_code=502, detail="Threat intelligence service unavailable")

    # Demo fallback
    if ioc in _DEMO_DATA:
        return _DEMO_DATA[ioc]
    return {**_DEMO_DEFAULT, "ioc": ioc}
