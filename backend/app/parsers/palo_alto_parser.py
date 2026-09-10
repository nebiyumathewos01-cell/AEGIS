"""Parser for Palo Alto Networks firewall / Panorama CSV logs."""
from __future__ import annotations
import re
from datetime import datetime
from app.parsers.base import ParsedAlert

_IP_RE  = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_TS_RE  = re.compile(r"(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})")

THREAT_CATEGORIES = {
    "vulnerability": "exploit_attempt",
    "spyware":       "malware_detected",
    "virus":         "malware_detected",
    "wildfire-virus":"malware_detected",
    "botnet":        "c2_communication",
    "dns-benign":    "dns_event",
    "dns-malware":   "suspicious_dns_query",
    "brute-force":   "brute_force_attempt",
    "flood":         "dos_attack",
    "scan":          "port_scan",
    "data":          "data_exfiltration",
}


def parse_palo_alto(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="palo_alto")
    lines = [l for l in raw.strip().splitlines() if l.strip()]

    src_ip = dst_ip = None
    alert_type = "palo_alto_event"

    for line in lines:
        # CSV format detection
        fields = line.split(",")
        if len(fields) >= 15:
            # Typical PAN threat log CSV order
            try:
                src_ip = fields[7].strip()
                dst_ip = fields[8].strip()
                category = fields[16].strip().lower() if len(fields) > 16 else ""
                threat_name = fields[14].strip().lower() if len(fields) > 14 else ""
                if category in THREAT_CATEGORIES:
                    alert_type = THREAT_CATEGORIES[category]
                elif any(k in threat_name for k in ("brute", "scan", "flood")):
                    alert_type = "brute_force_attempt"
            except IndexError:
                pass

        ips = _IP_RE.findall(line)
        if ips and not src_ip:
            src_ip = ips[0]
        if len(ips) > 1 and not dst_ip:
            dst_ip = ips[1]

    if src_ip and re.match(r"\d+\.\d+\.\d+\.\d+", src_ip):
        parsed.source_ip = src_ip
    if dst_ip and re.match(r"\d+\.\d+\.\d+\.\d+", dst_ip):
        parsed.destination_ip = dst_ip

    parsed.alert_type = alert_type
    parsed.attempt_count = len(lines)

    ts = _TS_RE.search(raw)
    if ts:
        for fmt in ("%Y/%m/%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                parsed.timestamp = datetime.strptime(ts.group(1), fmt)
                break
            except ValueError:
                continue

    parsed.extra = {"total_events": len(lines)}
    return parsed
