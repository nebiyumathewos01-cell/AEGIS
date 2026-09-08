"""Parser for Nmap scan output."""

from __future__ import annotations

import re
from datetime import datetime

from app.parsers.base import ParsedAlert

_IP_TARGET_RE = re.compile(r"Nmap scan report for\s+([\w.\-]+)\s*(?:\(([\d.]+)\))?")
_PORT_RE = re.compile(r"(\d+)/(tcp|udp)\s+(\w+)\s+(\S+)")
_SCAN_TYPE_RE = re.compile(r"Nmap\s+\d+\.\d+.*?(\w+\s+scan)", re.IGNORECASE)
_INITIATOR_RE = re.compile(r"Initiating.*?from\s+([\d.]+)", re.IGNORECASE)
_TIMESTAMP_RE = re.compile(r"Starting Nmap.*?at\s+([\d\-: ]+\s+\w+)", re.IGNORECASE)
_OS_RE = re.compile(r"OS details:\s*(.+)")
_AGGRESSIVE_FLAGS = re.compile(r"-\w*[ASO]\w*", re.IGNORECASE)

SENSITIVE_PORTS = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    80: "HTTP",
    443: "HTTPS",
    445: "SMB",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    27017: "MongoDB",
    6379: "Redis",
    8080: "HTTP-Alt",
}


def parse_nmap(raw: str) -> ParsedAlert:
    parsed = ParsedAlert(source="nmap")
    lines = raw.strip().splitlines()

    open_ports: list[dict] = []
    filtered_ports: list[dict] = []
    target_host: str | None = None

    for line in lines:
        # Target IP
        m = _IP_TARGET_RE.search(line)
        if m:
            host = m.group(1)
            ip = m.group(2)
            target_host = ip or host
            parsed.destination_ip = target_host

        # Port lines
        m = _PORT_RE.search(line)
        if m:
            port_num = int(m.group(1))
            proto = m.group(2).upper()
            state = m.group(3).lower()
            service = m.group(4)
            entry = {
                "port": port_num,
                "protocol": proto,
                "state": state,
                "service": service,
                "sensitive": port_num in SENSITIVE_PORTS,
                "service_name": SENSITIVE_PORTS.get(port_num, service),
            }
            if state == "open":
                open_ports.append(entry)
            elif "filter" in state:
                filtered_ports.append(entry)

        # Initiating scanner IP
        m = _INITIATOR_RE.search(line)
        if m:
            parsed.source_ip = m.group(1)

        # OS
        m = _OS_RE.search(line)
        if m:
            parsed.extra["os_details"] = m.group(1).strip()

        # Timestamp
        m = _TIMESTAMP_RE.search(line)
        if m:
            try:
                ts_str = m.group(1).strip()
                parsed.timestamp = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass

    # Determine alert type
    sensitive_open = [p for p in open_ports if p["sensitive"]]
    if len(open_ports) > 15:
        parsed.alert_type = "port_scan_comprehensive"
    elif len(open_ports) > 5:
        parsed.alert_type = "port_scan_targeted"
    elif sensitive_open:
        parsed.alert_type = "sensitive_service_detected"
    elif open_ports:
        parsed.alert_type = "port_scan"
    else:
        parsed.alert_type = "nmap_scan"

    # Primary port / protocol from most interesting open port
    if sensitive_open:
        parsed.destination_port = sensitive_open[0]["port"]
        parsed.protocol = sensitive_open[0]["protocol"]
    elif open_ports:
        parsed.destination_port = open_ports[0]["port"]
        parsed.protocol = open_ports[0]["protocol"]

    parsed.extra.update({
        "open_ports": open_ports,
        "filtered_ports": filtered_ports,
        "open_port_count": len(open_ports),
        "sensitive_open_ports": sensitive_open,
        "target_host": target_host,
    })

    return parsed
