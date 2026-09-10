"""Parser for Zeek (formerly Bro) network security monitor logs."""
from __future__ import annotations
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE    = re.compile(r"(\d{10}\.\d+)")
_IP_RE    = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_LOG_TYPE = re.compile(r"#path\s+(\w+)", re.IGNORECASE)

NOTICE_TYPES = {
    "SSH::Password_Guessing": "brute_force_attempt",
    "Scan::Port_Scan":        "port_scan",
    "Scan::Address_Scan":     "network_scan",
    "DNS::External_Name":     "dns_event",
    "SSL::Invalid_Server_Cert": "ssl_anomaly",
    "HTTP::SQL_Injection_Attacker": "sql_injection",
}


def parse_zeek(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="zeek")
    lines = [l for l in raw.strip().splitlines() if l.strip() and not l.startswith("#")]

    ip_counter: Counter = Counter()
    alert_type = "zeek_alert"

    # Detect log type
    log_type_m = _LOG_TYPE.search(raw)
    log_type = log_type_m.group(1).lower() if log_type_m else "conn"

    for line in lines:
        for ip in _IP_RE.findall(line):
            ip_counter[ip] += 1
        for notice, atype in NOTICE_TYPES.items():
            if notice in line:
                alert_type = atype
                break

    if ip_counter:
        top = ip_counter.most_common(2)
        parsed.source_ip = top[0][0]
        if len(top) > 1:
            parsed.destination_ip = top[1][0]

    parsed.alert_type = alert_type
    parsed.attempt_count = len(lines)

    ts_m = _TS_RE.search(raw)
    if ts_m:
        try:
            parsed.timestamp = datetime.fromtimestamp(float(ts_m.group(1)))
        except (ValueError, OSError):
            pass

    parsed.extra = {"log_type": log_type, "total_events": len(lines)}
    return parsed
