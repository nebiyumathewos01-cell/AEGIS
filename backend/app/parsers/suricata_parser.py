"""Parser for Suricata alert logs (eve.json and fast.log formats)."""

from __future__ import annotations

import json
import re
from datetime import datetime

from app.parsers.base import ParsedAlert

# fast.log pattern: timestamp [**] [sid:gid:rev] message [**] [Classification: ...] [Priority: N] {PROTO} src:port -> dst:port
_FAST_RE = re.compile(
    r"(\d{2}/\d{2}/\d{4}-\d{2}:\d{2}:\d{2}\.\d+)\s+\[\*\*\]\s+\[(\d+:\d+:\d+)\]\s+(.+?)\s+\[\*\*\]"
    r"(?:.*?\[Priority:\s*(\d+)\])?"
    r"\s+\{(\w+)\}\s+([\d.]+):(\d+)\s+->\s+([\d.]+):(\d+)",
    re.IGNORECASE,
)

_SEVERITY_MAP = {1: "CRITICAL", 2: "HIGH", 3: "MEDIUM", 4: "LOW"}


def _parse_eve_json(raw: str) -> ParsedAlert | None:
    """Try to parse eve.json format (one JSON object per line)."""
    alerts: list[dict] = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if obj.get("event_type") == "alert":
                alerts.append(obj)
        except json.JSONDecodeError:
            continue

    if not alerts:
        return None

    # Use the highest-priority alert as the primary
    alerts.sort(key=lambda a: a.get("alert", {}).get("severity", 99))
    primary = alerts[0]
    alert_info = primary.get("alert", {})

    parsed = ParsedAlert(source="suricata")
    parsed.source_ip = primary.get("src_ip")
    parsed.destination_ip = primary.get("dest_ip")
    parsed.source_port = primary.get("src_port")
    parsed.destination_port = primary.get("dest_port")
    parsed.protocol = primary.get("proto", "").upper() or None

    sig_name = alert_info.get("signature", "Suricata Alert")
    parsed.alert_type = _classify_suricata_signature(sig_name)

    priority = alert_info.get("severity", 3)
    parsed.severity = _SEVERITY_MAP.get(priority, "MEDIUM")

    # Timestamp
    ts = primary.get("timestamp")
    if ts:
        try:
            parsed.timestamp = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            pass

    parsed.extra = {
        "signature": sig_name,
        "signature_id": alert_info.get("signature_id"),
        "category": alert_info.get("category"),
        "severity": priority,
        "all_alerts": [
            {
                "signature": a.get("alert", {}).get("signature"),
                "src_ip": a.get("src_ip"),
                "dest_ip": a.get("dest_ip"),
                "proto": a.get("proto"),
            }
            for a in alerts[:10]
        ],
    }
    parsed.attempt_count = len(alerts)
    return parsed


def _parse_fast_log(raw: str) -> ParsedAlert | None:
    """Parse Suricata fast.log format."""
    matches = list(_FAST_RE.finditer(raw))
    if not matches:
        return None

    parsed = ParsedAlert(source="suricata")
    # Use first match as primary
    m = matches[0]
    ts_str, sid, message, priority, proto, src_ip, src_port, dst_ip, dst_port = (
        m.group(1), m.group(2), m.group(3), m.group(4),
        m.group(5), m.group(6), m.group(7), m.group(8), m.group(9),
    )

    parsed.source_ip = src_ip
    parsed.destination_ip = dst_ip
    parsed.source_port = int(src_port)
    parsed.destination_port = int(dst_port)
    parsed.protocol = proto.upper()
    parsed.alert_type = _classify_suricata_signature(message)

    prio = int(priority) if priority else 3
    parsed.severity = _SEVERITY_MAP.get(prio, "MEDIUM")

    try:
        parsed.timestamp = datetime.strptime(ts_str[:19], "%m/%d/%Y-%H:%M:%S")
    except ValueError:
        pass

    parsed.extra = {
        "signature": message.strip(),
        "signature_id": sid,
        "all_signatures": [mx.group(3).strip() for mx in matches[:10]],
    }
    parsed.attempt_count = len(matches)
    return parsed


def _classify_suricata_signature(sig: str) -> str:
    sig_lower = sig.lower()
    if any(k in sig_lower for k in ("brute", "bruteforce", "brute force")):
        return "brute_force_attempt"
    if any(k in sig_lower for k in ("scan", "probe", "sweep")):
        return "port_scan"
    if any(k in sig_lower for k in ("malware", "trojan", "backdoor", "rat ")):
        return "malware_detected"
    if any(k in sig_lower for k in ("exploit", "overflow", "injection")):
        return "exploit_attempt"
    if any(k in sig_lower for k in ("dos", "ddos", "flood", "denial")):
        return "dos_attack"
    if any(k in sig_lower for k in ("c2", "c&c", "command and control", "botnet")):
        return "c2_communication"
    if any(k in sig_lower for k in ("policy", "blacklist", "tor ")):
        return "policy_violation"
    return "suricata_alert"


def parse_suricata(raw: str) -> ParsedAlert:
    # Try eve.json first, then fast.log
    result = _parse_eve_json(raw) or _parse_fast_log(raw)
    if result:
        return result

    # Fallback: basic regex extraction
    parsed = ParsedAlert(source="suricata", alert_type="suricata_alert")
    ip_matches = re.findall(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b", raw)
    if ip_matches:
        parsed.source_ip = ip_matches[0]
        if len(ip_matches) > 1:
            parsed.destination_ip = ip_matches[1]
    return parsed
