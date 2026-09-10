"""Parser for Snort IDS alert logs."""
from __future__ import annotations
import re
from datetime import datetime
from app.parsers.base import ParsedAlert

# Snort fast alert format:
# MM/DD-HH:MM:SS.uuuuuu  [**] [sid:gid:rev] msg [**] [Classification: ...] [Priority: N] {PROTO} src:port -> dst:port
_FAST_RE = re.compile(
    r"(\d{2}/\d{2}-\d{2}:\d{2}:\d{2})\.\d+\s+\[\*\*\]\s+\[(\d+:\d+:\d+)\]\s+(.+?)\s+\[\*\*\]"
    r"(?:.*?\[Priority:\s*(\d+)\])?"
    r"\s+\{(\w+)\}\s+([\d.]+):(\d+)\s+->\s+([\d.]+):(\d+)",
    re.IGNORECASE,
)

_SEVERITY_MAP = {1: "CRITICAL", 2: "HIGH", 3: "MEDIUM", 4: "LOW"}

CATEGORY_MAP = [
    (re.compile(r"brute.force|repeated.*attempt", re.I), "brute_force_attempt"),
    (re.compile(r"scan|probe|sweep", re.I), "port_scan"),
    (re.compile(r"malware|trojan|backdoor", re.I), "malware_detected"),
    (re.compile(r"exploit|overflow|shellcode", re.I), "exploit_attempt"),
    (re.compile(r"dos|flood|denial", re.I), "dos_attack"),
    (re.compile(r"sql.injection|xss|cross.site", re.I), "web_attack"),
    (re.compile(r"c2|c&c|command.*control|botnet", re.I), "c2_communication"),
]


def parse_snort(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="snort")
    matches = list(_FAST_RE.finditer(raw))

    if not matches:
        from app.parsers.generic_parser import parse_generic
        result = parse_generic(raw)
        result.source = "snort"
        return result

    m = matches[0]
    ts_str, sid, msg, priority, proto, src_ip, src_port, dst_ip, dst_port = (
        m.group(1), m.group(2), m.group(3), m.group(4),
        m.group(5), m.group(6), m.group(7), m.group(8), m.group(9),
    )

    parsed.source_ip = src_ip
    parsed.destination_ip = dst_ip
    parsed.source_port = int(src_port)
    parsed.destination_port = int(dst_port)
    parsed.protocol = proto.upper()

    prio = int(priority) if priority else 3
    parsed.severity = _SEVERITY_MAP.get(prio, "MEDIUM")

    # Classify
    alert_type = "snort_alert"
    for pattern, atype in CATEGORY_MAP:
        if pattern.search(msg):
            alert_type = atype
            break
    parsed.alert_type = alert_type

    try:
        parsed.timestamp = datetime.strptime(ts_str, "%m/%d-%H:%M:%S")
        parsed.timestamp = parsed.timestamp.replace(year=datetime.now().year)
    except ValueError:
        pass

    parsed.attempt_count = len(matches)
    parsed.extra = {
        "signature": msg.strip(),
        "signature_id": sid,
        "all_signatures": [mx.group(3).strip() for mx in matches[:10]],
    }
    return parsed
