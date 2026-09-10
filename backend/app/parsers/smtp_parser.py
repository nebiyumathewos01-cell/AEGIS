"""Parser for SMTP / mail server logs (Postfix, Sendmail, Exchange)."""
from __future__ import annotations
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE     = re.compile(r"(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})")
_IP_RE     = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_FROM_RE   = re.compile(r"from=<([^>]+)>", re.IGNORECASE)
_TO_RE     = re.compile(r"to=<([^>]+)>", re.IGNORECASE)
_STATUS_RE = re.compile(r"status=(\w+)", re.IGNORECASE)
_REJECT_RE = re.compile(r"reject|blocked|spam|virus|malware|blacklist", re.IGNORECASE)
_RELAY_RE  = re.compile(r"relay=([\d.]+)", re.IGNORECASE)


def parse_smtp(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="smtp")
    lines = [l for l in raw.strip().splitlines() if l.strip()]

    ip_counter: Counter = Counter()
    reject_count = 0
    bounce_count = 0
    senders = []
    recipients = []

    for line in lines:
        for ip in _IP_RE.findall(line):
            ip_counter[ip] += 1
        m = _FROM_RE.search(line)
        if m:
            senders.append(m.group(1))
        m = _TO_RE.search(line)
        if m:
            recipients.append(m.group(1))
        if _REJECT_RE.search(line):
            reject_count += 1
        m = _STATUS_RE.search(line)
        if m and m.group(1).lower() == "bounced":
            bounce_count += 1

    if ip_counter:
        parsed.source_ip = ip_counter.most_common(1)[0][0]

    if reject_count >= 20:
        parsed.alert_type = "spam_campaign"
    elif reject_count >= 5:
        parsed.alert_type = "email_policy_violation"
    elif len(set(senders)) == 1 and len(recipients) >= 10:
        parsed.alert_type = "bulk_email_detected"
    else:
        parsed.alert_type = "smtp_event"

    parsed.protocol = "SMTP"
    parsed.destination_port = 25
    parsed.attempt_count = len(lines)

    ts = _TS_RE.search(raw)
    if ts:
        try:
            year = datetime.now().year
            parsed.timestamp = datetime.strptime(f"{ts.group(1)} {year}", "%b %d %H:%M:%S %Y")
        except ValueError:
            pass

    parsed.extra = {
        "reject_count": reject_count,
        "unique_senders": len(set(senders)),
        "unique_recipients": len(set(recipients)),
        "bounce_count": bounce_count,
    }
    return parsed
