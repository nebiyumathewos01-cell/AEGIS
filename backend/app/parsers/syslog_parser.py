"""Parser for generic syslog (RFC 3164 / RFC 5424) messages."""
from __future__ import annotations
import re
from datetime import datetime
from app.parsers.base import ParsedAlert

_RFC3164_RE = re.compile(
    r"(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)"
)
_RFC5424_RE = re.compile(
    r"<(\d+)>1\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+\s+(.*)"
)
_IP_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")

SEVERITY_KEYWORDS = {
    "emerg": 0, "alert": 1, "crit": 2, "error": 3, "err": 3,
    "warning": 4, "warn": 4, "notice": 5, "info": 6, "debug": 7,
}
ATTACK_KEYWORDS = [
    (["segfault", "segmentation fault"], "process_crash"),
    (["out of memory", "oom"], "resource_exhaustion"),
    (["kernel: [", "oops:"], "kernel_error"),
    (["authentication failure", "failed password"], "failed_login"),
    (["sudo:", "su:"], "privilege_event"),
    (["firewall", "iptables", "nftables"], "firewall_event"),
]


def parse_syslog(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="syslog")
    lines = [l for l in raw.strip().splitlines() if l.strip()]
    if not lines:
        return parsed

    # Detect alert type
    lower_raw = raw.lower()
    for keywords, atype in ATTACK_KEYWORDS:
        if any(k in lower_raw for k in keywords):
            parsed.alert_type = atype
            break
    else:
        parsed.alert_type = "syslog_event"

    # Parse first matching line for metadata
    for line in lines:
        m = _RFC3164_RE.match(line)
        if m:
            ts_str, host, process, pid, msg = m.groups()
            try:
                year = datetime.now().year
                parsed.timestamp = datetime.strptime(f"{ts_str} {year}", "%b %d %H:%M:%S %Y")
            except ValueError:
                pass
            parsed.extra["host"] = host
            parsed.extra["process"] = process
            break

    # Extract IPs
    ips = _IP_RE.findall(raw)
    if ips:
        parsed.source_ip = ips[0]
    if len(ips) > 1:
        parsed.destination_ip = ips[1]

    # Count errors
    error_count = sum(1 for l in lines if any(k in l.lower() for k in ("error", "fail", "crit", "emerg")))
    if error_count:
        parsed.attempt_count = error_count

    parsed.extra["total_lines"] = len(lines)
    return parsed
