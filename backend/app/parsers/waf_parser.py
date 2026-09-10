"""Parser for Web Application Firewall logs (ModSecurity, AWS WAF, Cloudflare)."""
from __future__ import annotations
import json
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE   = re.compile(r"(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})")
_IP_RE   = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_RULE_RE = re.compile(r"(?:id|RuleId)[\":\s]+[\"']?(\d+)[\"']?", re.IGNORECASE)
_URI_RE  = re.compile(r'(?:uri|REQUEST_URI)["\s:]+["\']?([^\s"\']+)', re.IGNORECASE)

ATTACK_SIGNATURES = [
    (re.compile(r"sql.injection|SQLI|942\d{3}", re.I), "sql_injection"),
    (re.compile(r"xss|cross.site.script|941\d{3}", re.I), "xss_attempt"),
    (re.compile(r"path.traversal|LFI|RFI|930\d{3}", re.I), "path_traversal"),
    (re.compile(r"remote.code.exec|RCE|OS.command|932\d{3}", re.I), "command_injection"),
    (re.compile(r"scanner|nikto|sqlmap|acunetix|nessus", re.I), "scanner_detected"),
    (re.compile(r"bot|crawler|scraper", re.I), "bot_traffic"),
]


def parse_waf(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="waf")

    # Try JSON first
    lines = raw.strip().splitlines()
    json_events = []
    for line in lines:
        try:
            obj = json.loads(line)
            json_events.append(obj)
        except (json.JSONDecodeError, ValueError):
            pass

    ip_counter: Counter = Counter()
    rule_ids = []
    attack_type = None

    if json_events:
        for evt in json_events:
            ip = evt.get("clientIp") or evt.get("src_ip") or evt.get("client_ip")
            if ip:
                ip_counter[ip] += 1
            rule = evt.get("ruleId") or evt.get("rule_id")
            if rule:
                rule_ids.append(str(rule))
    else:
        for ip in _IP_RE.findall(raw):
            ip_counter[ip] += 1
        rule_ids = _RULE_RE.findall(raw)

    if ip_counter:
        parsed.source_ip = ip_counter.most_common(1)[0][0]

    # Detect attack type
    for pattern, atype in ATTACK_SIGNATURES:
        if pattern.search(raw):
            attack_type = atype
            break
    parsed.alert_type = attack_type or "waf_block"

    parsed.protocol = "HTTP"
    parsed.destination_port = 443
    parsed.attempt_count = len(lines)

    ts = _TS_RE.search(raw)
    if ts:
        try:
            parsed.timestamp = datetime.strptime(ts.group(1)[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    parsed.extra = {
        "rule_ids": rule_ids[:10],
        "unique_ips": len(ip_counter),
        "total_events": len(lines),
    }
    return parsed
