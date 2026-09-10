"""Parser for Windows Event Log (Security) exports."""
from __future__ import annotations
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

_EVENT_ID_RE   = re.compile(r"EventID[:\s]+(\d+)", re.IGNORECASE)
_USER_RE       = re.compile(r"Account Name[:\s]+(\S+)", re.IGNORECASE)
_DOMAIN_RE     = re.compile(r"Account Domain[:\s]+(\S+)", re.IGNORECASE)
_IP_RE         = re.compile(r"Source Network Address[:\s]+([\d.]+)", re.IGNORECASE)
_TS_RE         = re.compile(r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})")
_IP_GENERIC    = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")

# Common Windows Security Event IDs
_EVENT_TYPES = {
    "4624": "successful_login",
    "4625": "failed_login",
    "4648": "explicit_credential_logon",
    "4672": "special_privileges_assigned",
    "4688": "process_creation",
    "4698": "scheduled_task_created",
    "4720": "user_account_created",
    "4732": "user_added_to_group",
    "4740": "account_lockout",
    "4756": "member_added_to_universal_group",
    "7045": "service_installed",
    "1102": "audit_log_cleared",
}


def parse_windows_event(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="windows_event")

    # Extract Event IDs
    event_ids = _EVENT_ID_RE.findall(raw)
    parsed.event_ids = event_ids[:10]

    # Determine alert type from most common/serious event
    alert_type = "windows_security_event"
    for eid in event_ids:
        if eid in _EVENT_TYPES:
            alert_type = _EVENT_TYPES[eid]
            break
    parsed.alert_type = alert_type

    # Failed login count
    fail_count = raw.count("4625") + raw.lower().count("failure")
    if fail_count >= 10:
        parsed.alert_type = "brute_force_attempt"
        parsed.attempt_count = fail_count
    elif fail_count > 0:
        parsed.attempt_count = fail_count

    # Username
    user_match = _USER_RE.search(raw)
    if user_match:
        parsed.username = user_match.group(1)

    # Source IP
    ip_match = _IP_RE.search(raw)
    if ip_match:
        parsed.source_ip = ip_match.group(1)
    else:
        ips = _IP_GENERIC.findall(raw)
        if ips:
            parsed.source_ip = Counter(ips).most_common(1)[0][0]

    # Timestamp
    ts_match = _TS_RE.search(raw)
    if ts_match:
        try:
            parsed.timestamp = datetime.strptime(ts_match.group(1), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    parsed.protocol = "Windows"
    parsed.extra["event_ids"] = event_ids
    return parsed
