"""Dispatch raw alert text to the appropriate parser."""

from __future__ import annotations

import re

from app.parsers.base import ParsedAlert
from app.parsers.auth_parser import parse_auth_log
from app.parsers.nmap_parser import parse_nmap
from app.parsers.suricata_parser import parse_suricata
from app.parsers.generic_parser import parse_generic

_NMAP_HINT = re.compile(r"Nmap scan report|Starting Nmap|PORT\s+STATE\s+SERVICE", re.IGNORECASE)
_SURICATA_HINT = re.compile(r'"event_type"\s*:\s*"alert"|\[\*\*\].*Priority', re.IGNORECASE)
_AUTH_HINT = re.compile(r"Failed password|Accepted password|Invalid user|sshd\[|pam_unix", re.IGNORECASE)


def detect_source(raw: str, hint: str = "generic") -> str:
    """Detect log source from content if not explicitly provided."""
    if hint and hint != "generic":
        return hint
    if _AUTH_HINT.search(raw):
        return "auth"
    if _NMAP_HINT.search(raw):
        return "nmap"
    if _SURICATA_HINT.search(raw):
        return "suricata"
    return "generic"


def parse_alert(raw: str, source_hint: str = "generic") -> ParsedAlert:
    """Parse a raw alert string and return structured ParsedAlert."""
    source = detect_source(raw, source_hint)
    parsers = {
        "auth": parse_auth_log,
        "nmap": parse_nmap,
        "suricata": parse_suricata,
        "generic": parse_generic,
    }
    parser_fn = parsers.get(source, parse_generic)
    result: ParsedAlert = parser_fn(raw)
    result.source = source  # ensure consistency
    return result
