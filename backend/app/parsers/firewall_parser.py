"""Parser for firewall logs (iptables, pfSense, Cisco ASA, Palo Alto style)."""
from __future__ import annotations
import re
from collections import Counter
from datetime import datetime
from app.parsers.base import ParsedAlert

_TS_RE      = re.compile(r"(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})")
_SRC_RE     = re.compile(r"(?:SRC|src)[=:\s]+([\d.]+)", re.IGNORECASE)
_DST_RE     = re.compile(r"(?:DST|dst|destination)[=:\s]+([\d.]+)", re.IGNORECASE)
_SPORT_RE   = re.compile(r"(?:SPT|sport|src.port)[=:\s]+(\d+)", re.IGNORECASE)
_DPORT_RE   = re.compile(r"(?:DPT|dport|dst.port|port)[=:\s]+(\d+)", re.IGNORECASE)
_PROTO_RE   = re.compile(r"\b(TCP|UDP|ICMP|GRE|ESP)\b", re.IGNORECASE)
_ACTION_RE  = re.compile(r"\b(DENY|DROP|BLOCK|ALLOW|PERMIT|ACCEPT|REJECT)\b", re.IGNORECASE)
_IP_RE      = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")

SENSITIVE_PORTS = {22, 23, 25, 80, 443, 445, 1433, 3306, 3389, 5432, 6379, 27017}


def parse_firewall(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="firewall")
    lines = [l for l in raw.strip().splitlines() if l.strip()]

    src_counter: Counter = Counter()
    dst_set = set()
    dports = []
    actions = []

    for line in lines:
        m = _SRC_RE.search(line)
        if m:
            src_counter[m.group(1)] += 1
        m = _DST_RE.search(line)
        if m:
            dst_set.add(m.group(1))
        m = _DPORT_RE.search(line)
        if m:
            dports.append(int(m.group(1)))
        m = _ACTION_RE.search(line)
        if m:
            actions.append(m.group(1).upper())

    if src_counter:
        parsed.source_ip = src_counter.most_common(1)[0][0]
    if dst_set:
        parsed.destination_ip = next(iter(dst_set))
    if dports:
        parsed.destination_port = dports[0]
    proto = _PROTO_RE.search(raw)
    if proto:
        parsed.protocol = proto.group(1).upper()

    deny_count = actions.count("DENY") + actions.count("DROP") + actions.count("BLOCK")
    allow_count = actions.count("ALLOW") + actions.count("PERMIT") + actions.count("ACCEPT")

    if deny_count >= 10:
        parsed.alert_type = "firewall_block_storm"
        parsed.attempt_count = deny_count
    elif deny_count > 0 and dports and any(p in SENSITIVE_PORTS for p in dports):
        parsed.alert_type = "sensitive_port_blocked"
        parsed.attempt_count = deny_count
    elif allow_count > 0 and dports and any(p in SENSITIVE_PORTS for p in dports):
        parsed.alert_type = "sensitive_port_allowed"
    else:
        parsed.alert_type = "firewall_event"

    ts = _TS_RE.search(raw)
    if ts:
        try:
            parsed.timestamp = datetime.strptime(ts.group(1)[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    parsed.extra = {
        "deny_count": deny_count,
        "allow_count": allow_count,
        "unique_sources": len(src_counter),
        "destination_ports": list(set(dports))[:10],
    }
    return parsed
