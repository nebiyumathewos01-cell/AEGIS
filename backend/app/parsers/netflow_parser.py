"""Parser for NetFlow / IPFIX traffic records."""
from __future__ import annotations
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE    = re.compile(r"(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})")
_SRC_RE   = re.compile(r"(?:src|source)[=:\s]+([\d.]+)", re.IGNORECASE)
_DST_RE   = re.compile(r"(?:dst|destination)[=:\s]+([\d.]+)", re.IGNORECASE)
_BYTES_RE = re.compile(r"bytes[=:\s]+(\d+)", re.IGNORECASE)
_PROTO_RE = re.compile(r"proto[=:\s]+(\w+)", re.IGNORECASE)
_DPORT_RE = re.compile(r"(?:dport|dst.port)[=:\s]+(\d+)", re.IGNORECASE)

EXFIL_THRESHOLD_BYTES = 100_000_000  # 100 MB


def parse_netflow(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="netflow")
    lines = [l for l in raw.strip().splitlines() if l.strip()]

    src_counter: Counter = Counter()
    total_bytes = 0
    dst_set = set()
    ports = []

    for line in lines:
        m = _SRC_RE.search(line)
        if m:
            src_counter[m.group(1)] += 1
        m = _DST_RE.search(line)
        if m:
            dst_set.add(m.group(1))
        m = _BYTES_RE.search(line)
        if m:
            total_bytes += int(m.group(1))
        m = _DPORT_RE.search(line)
        if m:
            ports.append(int(m.group(1)))

    if src_counter:
        parsed.source_ip = src_counter.most_common(1)[0][0]
    if dst_set:
        parsed.destination_ip = next(iter(dst_set))
    if ports:
        parsed.destination_port = ports[0]

    proto = _PROTO_RE.search(raw)
    if proto:
        parsed.protocol = proto.group(1).upper()

    if total_bytes >= EXFIL_THRESHOLD_BYTES:
        parsed.alert_type = "data_exfiltration"
    elif len(dst_set) >= 10:
        parsed.alert_type = "beaconing_detected"
    elif len(src_counter) >= 20:
        parsed.alert_type = "traffic_anomaly"
    else:
        parsed.alert_type = "netflow_event"

    ts = _TS_RE.search(raw)
    if ts:
        try:
            parsed.timestamp = datetime.strptime(ts.group(1)[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    parsed.extra = {
        "total_bytes": total_bytes,
        "total_bytes_human": f"{total_bytes / 1_000_000:.1f} MB",
        "unique_destinations": len(dst_set),
        "unique_sources": len(src_counter),
        "destination_ports": list(set(ports))[:10],
    }
    return parsed
