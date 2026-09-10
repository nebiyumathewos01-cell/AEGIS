"""Parser for Endpoint Detection & Response (EDR) logs — CrowdStrike, SentinelOne, Carbon Black style."""
from __future__ import annotations
import json
import re
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE   = re.compile(r"(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})")
_IP_RE   = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_HASH_RE = re.compile(r"\b([a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})\b")

SEVERITY_MAP = {"critical": "CRITICAL", "high": "HIGH", "medium": "MEDIUM", "low": "LOW"}

EDR_PATTERNS = [
    (re.compile(r"ransomware|encrypt.*file|shadow.*copy", re.I), "ransomware_activity"),
    (re.compile(r"mimikatz|credential.*dump|lsass.*access", re.I), "credential_dumping"),
    (re.compile(r"lateral.*move|pass.*hash|pass.*ticket", re.I), "lateral_movement"),
    (re.compile(r"process.*injection|dll.*inject|shellcode", re.I), "process_injection"),
    (re.compile(r"persistence|registry.*run|scheduled.*task", re.I), "persistence"),
    (re.compile(r"exfiltrat|data.*transfer|upload.*bytes", re.I), "data_exfiltration"),
    (re.compile(r"malware|trojan|virus|worm", re.I), "malware_detected"),
    (re.compile(r"privilege.*escal|token.*imperson|uac.*bypass", re.I), "privilege_escalation"),
]


def parse_endpoint(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="endpoint_edr")

    # Try JSON
    events = []
    for line in raw.strip().splitlines():
        try:
            events.append(json.loads(line))
        except (json.JSONDecodeError, ValueError):
            pass

    if events:
        primary = events[0]
        parsed.username = primary.get("username") or primary.get("user")
        sev = primary.get("severity", "").lower()
        parsed.severity = SEVERITY_MAP.get(sev, "MEDIUM")
        ts = primary.get("timestamp") or primary.get("event_time")
        if ts:
            try:
                parsed.timestamp = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            except ValueError:
                pass
        ip = primary.get("local_ip") or primary.get("src_ip")
        if ip:
            parsed.source_ip = ip
    else:
        ips = _IP_RE.findall(raw)
        if ips:
            parsed.source_ip = ips[0]
        ts = _TS_RE.search(raw)
        if ts:
            try:
                parsed.timestamp = datetime.strptime(ts.group(1)[:19], "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass

    # Detect alert type
    alert_type = "edr_alert"
    for pattern, atype in EDR_PATTERNS:
        if pattern.search(raw):
            alert_type = atype
            break
    parsed.alert_type = alert_type

    # Extract file hashes
    hashes = list(set(_HASH_RE.findall(raw)))[:5]
    parsed.attempt_count = len(raw.strip().splitlines())
    parsed.extra = {
        "file_hashes": hashes,
        "total_events": len(raw.strip().splitlines()),
    }
    return parsed
