"""Parser for Apache/Nginx web server access and error logs."""
from __future__ import annotations
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

# Apache combined log format
_COMBINED_RE = re.compile(
    r'([\d.]+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\w+)\s+([^\s"]+)[^"]*"\s+(\d{3})\s+\d+'
)
_IP_RE      = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_STATUS_RE  = re.compile(r"\s(4\d{2}|5\d{2})\s")
_TS_RE      = re.compile(r"\[(\d{2}/\w+/\d{4}:\d{2}:\d{2}:\d{2})")

ATTACK_PATTERNS = [
    (re.compile(r"union.*select|select.*from|drop.*table|insert.*into", re.IGNORECASE), "sql_injection"),
    (re.compile(r"<script|javascript:|onerror=|onload=|alert\(", re.IGNORECASE), "xss_attempt"),
    (re.compile(r"\.\./|\.\.\\|%2e%2e", re.IGNORECASE), "path_traversal"),
    (re.compile(r"cmd\.exe|/bin/sh|/bin/bash|powershell", re.IGNORECASE), "command_injection"),
    (re.compile(r"wp-login|wp-admin|phpmyadmin|\.env|\.git/config", re.IGNORECASE), "recon_probe"),
    (re.compile(r"nikto|sqlmap|nessus|masscan|zgrab", re.IGNORECASE), "scanner_detected"),
]


def parse_apache(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="apache")
    lines = [l for l in raw.strip().splitlines() if l.strip()]

    ip_counter: Counter = Counter()
    status_codes: list[int] = []
    attack_type = None
    methods: Counter = Counter()

    for line in lines:
        m = _COMBINED_RE.search(line)
        if m:
            ip, ts_str, method, path, status = m.groups()
            ip_counter[ip] += 1
            status_codes.append(int(status))
            methods[method] += 1
        else:
            for ip in _IP_RE.findall(line):
                ip_counter[ip] += 1
            for code in _STATUS_RE.findall(line):
                status_codes.append(int(code))

        if not attack_type:
            for pattern, atype in ATTACK_PATTERNS:
                if pattern.search(line):
                    attack_type = atype
                    break

    if ip_counter:
        parsed.source_ip = ip_counter.most_common(1)[0][0]

    error_4xx = sum(1 for s in status_codes if 400 <= s < 500)
    error_5xx = sum(1 for s in status_codes if 500 <= s < 600)

    if attack_type:
        parsed.alert_type = attack_type
    elif error_4xx >= 20:
        parsed.alert_type = "web_scan_detected"
    elif error_4xx > 0:
        parsed.alert_type = "web_error_spike"
    else:
        parsed.alert_type = "web_access_event"

    parsed.protocol = "HTTP"
    parsed.destination_port = 80
    parsed.attempt_count = len(lines)

    parsed.extra = {
        "total_requests": len(lines),
        "unique_ips": len(ip_counter),
        "4xx_errors": error_4xx,
        "5xx_errors": error_5xx,
        "top_methods": dict(methods.most_common(3)),
    }
    return parsed
