"""Parser for Cisco ASA / IOS / Meraki firewall logs."""
from __future__ import annotations
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE   = re.compile(r"(\w{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})")
_IP_RE   = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_MSG_RE  = re.compile(r"%[\w-]+-\d+-(\w+):")
_DENY_RE = re.compile(r"Deny|Teardown|No route|access-list.*denied", re.I)
_ALLOW_RE = re.compile(r"Built.*connection|permit|access-list.*permitted", re.I)
_VPN_RE  = re.compile(r"VPN|IPsec|IKE|tunnel", re.I)
_MSG_ID_RE = re.compile(r"%ASA-\d-(\d+):")

CISCO_MSG_TYPES = {
    "113019": "vpn_auth_failed",
    "113020": "vpn_auth_success",
    "106001": "firewall_deny",
    "106007": "deny_inbound",
    "106014": "deny_inbound",
    "302013": "tcp_connection",
    "302014": "tcp_teardown",
    "733100": "dos_attack",
    "733101": "dos_attack",
}


def parse_cisco(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="cisco")
    lines = [l for l in raw.strip().splitlines() if l.strip()]

    ip_counter: Counter = Counter()
    msg_ids = []
    deny_count = 0

    for line in lines:
        for ip in _IP_RE.findall(line):
            ip_counter[ip] += 1
        m = _MSG_ID_RE.search(line)
        if m:
            msg_ids.append(m.group(1))
        if _DENY_RE.search(line):
            deny_count += 1

    if ip_counter:
        top = ip_counter.most_common(2)
        parsed.source_ip = top[0][0]
        if len(top) > 1:
            parsed.destination_ip = top[1][0]

    # Determine alert type
    alert_type = "cisco_event"
    for mid in msg_ids:
        if mid in CISCO_MSG_TYPES:
            alert_type = CISCO_MSG_TYPES[mid]
            break

    if deny_count >= 10:
        alert_type = "firewall_block_storm"
    elif _VPN_RE.search(raw) and deny_count > 0:
        alert_type = "vpn_auth_failed"

    parsed.alert_type = alert_type
    parsed.attempt_count = deny_count or len(lines)

    ts = _TS_RE.search(raw)
    if ts:
        for fmt in ("%b %d %Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                parsed.timestamp = datetime.strptime(ts.group(1), fmt)
                break
            except ValueError:
                continue

    parsed.extra = {"deny_count": deny_count, "message_ids": msg_ids[:10]}
    return parsed
