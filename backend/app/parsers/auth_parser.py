"""Parser for Linux authentication logs (syslog / /var/log/auth.log style)."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime

from app.parsers.base import ParsedAlert

# Patterns
_FAILED_RE = re.compile(
    r"Failed password for (?:invalid user )?(\S+) from ([\d.]+) port (\d+)",
    re.IGNORECASE,
)
_ACCEPTED_RE = re.compile(
    r"Accepted (\w+) for (\S+) from ([\d.]+) port (\d+)",
    re.IGNORECASE,
)
_INVALID_USER_RE = re.compile(
    r"Invalid user (\S+) from ([\d.]+)",
    re.IGNORECASE,
)
_DISCONNECT_RE = re.compile(
    r"Disconnected from ([\d.]+) port (\d+)",
    re.IGNORECASE,
)
_TIMESTAMP_RE = re.compile(
    r"(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})"
)
_IP_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")


def parse_auth_log(raw: str) -> ParsedAlert:
    lines = [l.strip() for l in raw.strip().splitlines() if l.strip()]
    parsed = ParsedAlert(source="auth")

    failed_ips: Counter[str] = Counter()
    failed_users: Counter[str] = Counter()
    accepted_logins: list[dict] = []
    invalid_users: list[str] = []
    ports: list[int] = []
    timestamps: list[str] = []

    for line in lines:
        # Timestamps
        ts_match = _TIMESTAMP_RE.search(line)
        if ts_match:
            timestamps.append(ts_match.group(1))

        # Failed password
        m = _FAILED_RE.search(line)
        if m:
            user, ip, port = m.group(1), m.group(2), m.group(3)
            failed_ips[ip] += 1
            failed_users[user] += 1
            ports.append(int(port))
            continue

        # Accepted login
        m = _ACCEPTED_RE.search(line)
        if m:
            method, user, ip, port = m.group(1), m.group(2), m.group(3), m.group(4)
            accepted_logins.append({"method": method, "user": user, "ip": ip, "port": port})
            continue

        # Invalid user
        m = _INVALID_USER_RE.search(line)
        if m:
            user, ip = m.group(1), m.group(2)
            invalid_users.append(user)
            failed_ips[ip] += 1
            continue

    # Determine primary source IP (most active)
    if failed_ips:
        parsed.source_ip = failed_ips.most_common(1)[0][0]
        parsed.attempt_count = sum(failed_ips.values())

    # Primary username
    if failed_users:
        parsed.username = failed_users.most_common(1)[0][0]

    # Port / protocol
    if ports:
        parsed.source_port = ports[0]
    parsed.protocol = "SSH"
    parsed.destination_port = 22

    # Determine event type
    total_failed = sum(failed_ips.values())
    if total_failed >= 5:
        parsed.alert_type = "brute_force_attempt"
    elif total_failed > 0:
        parsed.alert_type = "failed_login"
    elif accepted_logins:
        parsed.alert_type = "successful_login"
    else:
        parsed.alert_type = "auth_event"

    # Extra context
    parsed.extra = {
        "failed_ips": dict(failed_ips),
        "failed_users": dict(failed_users),
        "accepted_logins": accepted_logins,
        "invalid_users": invalid_users,
        "unique_source_ips": len(failed_ips),
    }

    # First timestamp
    if timestamps:
        try:
            current_year = datetime.now().year
            parsed.timestamp = datetime.strptime(
                f"{timestamps[0]} {current_year}", "%b %d %H:%M:%S %Y"
            )
        except ValueError:
            pass

    return parsed
