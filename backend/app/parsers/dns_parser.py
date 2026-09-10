"""Parser for DNS server logs (BIND, Windows DNS, Unbound)."""
from __future__ import annotations
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE      = re.compile(r"(\d{2}-\w{3}-\d{4}\s+\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})")
_IP_RE      = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_DOMAIN_RE  = re.compile(r"query[:\s]+(\S+\.\S+)", re.IGNORECASE)
_NXDOMAIN_RE = re.compile(r"NXDOMAIN|SERVFAIL|refused", re.IGNORECASE)

SUSPICIOUS_DOMAINS = re.compile(
    r"\.onion|\.bit|tor2web|dyndns|no-ip|pastebin|bit\.ly|tinyurl"
    r"|ngrok|serveo|localhost\.run", re.IGNORECASE
)
TUNNELING_PATTERN = re.compile(r"[a-z0-9]{30,}\.", re.IGNORECASE)


def parse_dns(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="dns")
    lines = [l for l in raw.strip().splitlines() if l.strip()]

    ip_counter: Counter = Counter()
    domains: list[str] = []
    nxdomain_count = 0
    suspicious_domains = []
    tunneling_indicators = 0

    for line in lines:
        for ip in _IP_RE.findall(line):
            ip_counter[ip] += 1
        m = _DOMAIN_RE.search(line)
        if m:
            domain = m.group(1).rstrip(".")
            domains.append(domain)
            if SUSPICIOUS_DOMAINS.search(domain):
                suspicious_domains.append(domain)
            if TUNNELING_PATTERN.search(domain):
                tunneling_indicators += 1
        if _NXDOMAIN_RE.search(line):
            nxdomain_count += 1

    if ip_counter:
        parsed.source_ip = ip_counter.most_common(1)[0][0]

    if tunneling_indicators >= 3:
        parsed.alert_type = "dns_tunneling"
    elif suspicious_domains:
        parsed.alert_type = "suspicious_dns_query"
    elif nxdomain_count >= 20:
        parsed.alert_type = "dns_enumeration"
    elif len(set(domains)) >= 50:
        parsed.alert_type = "dns_flood"
    else:
        parsed.alert_type = "dns_event"

    parsed.protocol = "DNS"
    parsed.destination_port = 53
    parsed.attempt_count = len(lines)

    parsed.extra = {
        "total_queries": len(lines),
        "nxdomain_count": nxdomain_count,
        "suspicious_domains": suspicious_domains[:5],
        "tunneling_indicators": tunneling_indicators,
        "unique_domains": len(set(domains)),
    }
    return parsed
