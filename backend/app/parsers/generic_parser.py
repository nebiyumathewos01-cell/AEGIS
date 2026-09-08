"""Generic fallback parser — extracts common fields from any log text."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime

from app.parsers.base import ParsedAlert

_IP_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_PORT_RE = re.compile(r"\bport[:\s]+(\d+)\b", re.IGNORECASE)
_USER_RE = re.compile(r"\buser[:\s]+(\S+)\b|\bfor\s+(?:invalid user\s+)?(\S+)\b", re.IGNORECASE)
_PROTO_RE = re.compile(r"\b(TCP|UDP|ICMP|HTTP|HTTPS|FTP|SSH|SMB|RDP|DNS)\b", re.IGNORECASE)
_TIMESTAMP_RE = re.compile(
    r"(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})"
    r"|(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})"
)

_KEYWORD_TYPE_MAP = [
    (["brute", "bruteforce"], "brute_force_attempt"),
    (["failed password", "authentication failure", "auth fail"], "failed_login"),
    (["accepted password", "accepted publickey", "session opened"], "successful_login"),
    (["port scan", "nmap", "scan report"], "port_scan"),
    (["malware", "virus", "trojan"], "malware_detected"),
    (["exploit", "overflow", "injection"], "exploit_attempt"),
    (["dos", "ddos", "flood"], "dos_attack"),
    (["c2", "c&c", "command and control"], "c2_communication"),
    (["connection refused", "timeout", "unreachable"], "connection_event"),
]


def _detect_event_type(raw: str) -> str:
    lower = raw.lower()
    for keywords, event_type in _KEYWORD_TYPE_MAP:
        if any(k in lower for k in keywords):
            return event_type
    return "security_event"


def parse_generic(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="generic")
    parsed.alert_type = _detect_event_type(raw)

    # IPs — most common is likely source, second destination
    ip_counter: Counter[str] = Counter(_IP_RE.findall(raw))
    common_ips = ip_counter.most_common(2)
    if common_ips:
        parsed.source_ip = common_ips[0][0]
    if len(common_ips) > 1:
        parsed.destination_ip = common_ips[1][0]

    # Port
    port_match = _PORT_RE.search(raw)
    if port_match:
        parsed.destination_port = int(port_match.group(1))

    # Username
    user_match = _USER_RE.search(raw)
    if user_match:
        parsed.username = user_match.group(1) or user_match.group(2)

    # Protocol
    proto_match = _PROTO_RE.search(raw)
    if proto_match:
        parsed.protocol = proto_match.group(1).upper()

    # Timestamp
    ts_match = _TIMESTAMP_RE.search(raw)
    if ts_match:
        ts_str = (ts_match.group(1) or ts_match.group(2) or "").strip()
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%b %d %H:%M:%S"):
            try:
                parsed.timestamp = datetime.strptime(ts_str[:19], fmt)
                break
            except ValueError:
                continue

    # Attempt count — count lines with failure keywords
    lines = raw.splitlines()
    fail_count = sum(
        1 for l in lines
        if any(k in l.lower() for k in ("failed", "failure", "invalid", "error", "denied"))
    )
    if fail_count > 0:
        parsed.attempt_count = fail_count

    return parsed
