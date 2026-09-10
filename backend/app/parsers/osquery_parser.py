"""Parser for osquery / Fleet endpoint logs."""
from __future__ import annotations
import json
import re
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE = re.compile(r"(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})")

HIGH_RISK_QUERIES = {
    "process_events":        "process_creation",
    "socket_events":         "network_connection",
    "user_events":           "auth_event",
    "shell_history":         "command_execution",
    "file_events":           "file_system_change",
    "logged_in_users":       "auth_event",
    "crontab":               "persistence",
    "startup_items":         "persistence",
    "kernel_modules":        "kernel_modification",
    "listening_ports":       "open_port_detected",
    "authorized_keys":       "ssh_key_change",
    "suid_bin":              "privilege_escalation",
}


def parse_osquery(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="osquery")

    events = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except (json.JSONDecodeError, ValueError):
            pass

    if not events:
        parsed.alert_type = "osquery_event"
        return parsed

    primary = events[0]
    query_name = primary.get("name", "")
    action = primary.get("action", "")

    # Alert type from query name
    alert_type = HIGH_RISK_QUERIES.get(query_name, "osquery_event")
    parsed.alert_type = alert_type

    # Extract hostname
    hostname = primary.get("hostname") or primary.get("host_identifier")
    if hostname:
        parsed.extra["hostname"] = hostname

    # Extract username from columns
    cols = primary.get("columns", {})
    parsed.username = cols.get("username") or cols.get("user") or cols.get("uid")

    # Timestamp
    unix_ts = primary.get("unixTime") or primary.get("unix_time")
    if unix_ts:
        try:
            parsed.timestamp = datetime.fromtimestamp(int(unix_ts))
        except (ValueError, OSError):
            pass

    parsed.attempt_count = len(events)
    parsed.extra.update({
        "query_name": query_name,
        "action": action,
        "total_events": len(events),
        "columns": cols,
    })
    return parsed
