"""Dispatch raw alert text to the appropriate parser — supports 20 log sources."""
from __future__ import annotations
import re
from app.parsers.base import ParsedAlert

# ── Import all parsers ────────────────────────────────────────────────────────
from app.parsers.auth_parser          import parse_auth_log
from app.parsers.nmap_parser          import parse_nmap
from app.parsers.suricata_parser      import parse_suricata
from app.parsers.generic_parser       import parse_generic
from app.parsers.windows_event_parser import parse_windows_event
from app.parsers.firewall_parser      import parse_firewall
from app.parsers.apache_parser        import parse_apache
from app.parsers.dns_parser           import parse_dns
from app.parsers.netflow_parser       import parse_netflow
from app.parsers.syslog_parser        import parse_syslog
from app.parsers.snort_parser         import parse_snort
from app.parsers.waf_parser           import parse_waf
from app.parsers.zeek_parser          import parse_zeek
from app.parsers.aws_cloudtrail_parser import parse_aws_cloudtrail
from app.parsers.endpoint_parser      import parse_endpoint
from app.parsers.cisco_parser         import parse_cisco
from app.parsers.palo_alto_parser     import parse_palo_alto
from app.parsers.smtp_parser          import parse_smtp
from app.parsers.osquery_parser       import parse_osquery

# ── All 20 supported sources ──────────────────────────────────────────────────
ALL_SOURCES: dict[str, callable] = {
    "auth":            parse_auth_log,
    "nmap":            parse_nmap,
    "suricata":        parse_suricata,
    "windows_event":   parse_windows_event,
    "firewall":        parse_firewall,
    "apache":          parse_apache,
    "dns":             parse_dns,
    "netflow":         parse_netflow,
    "syslog":          parse_syslog,
    "snort":           parse_snort,
    "waf":             parse_waf,
    "zeek":            parse_zeek,
    "aws_cloudtrail":  parse_aws_cloudtrail,
    "endpoint_edr":    parse_endpoint,
    "cisco":           parse_cisco,
    "palo_alto":       parse_palo_alto,
    "smtp":            parse_smtp,
    "osquery":         parse_osquery,
    "generic":         parse_generic,
    "siem":            parse_generic,   # SIEM exports fall back to generic
}

# ── Auto-detection hints ──────────────────────────────────────────────────────
_HINTS = [
    (re.compile(r"Nmap scan report|Starting Nmap|PORT\s+STATE\s+SERVICE", re.I), "nmap"),
    (re.compile(r'"event_type"\s*:\s*"alert"|\[\*\*\].*Priority', re.I),         "suricata"),
    (re.compile(r"Failed password|Accepted password|Invalid user|sshd\[|pam_unix", re.I), "auth"),
    (re.compile(r"EventID|Security.*Event|Logon Type|Account Name", re.I),        "windows_event"),
    (re.compile(r"SRC=|DPT=|iptables|ACCEPT|DROP.*chain|FORWARD", re.I),         "firewall"),
    (re.compile(r'"GET |"POST |"PUT |"DELETE |HTTP/1\.|access\.log|error\.log', re.I), "apache"),
    (re.compile(r"NXDOMAIN|SERVFAIL|query\[|\.in-addr\.arpa|dns.*query", re.I),   "dns"),
    (re.compile(r"netflow|IPFIX|bytes=|pkts=|flows=", re.I),                      "netflow"),
    (re.compile(r"facility|severity|kern\.|daemon\.|auth\.|syslog", re.I),        "syslog"),
    (re.compile(r"\[\*\*\].*\[Classification|Priority:.*\{TCP\}.*->", re.I),      "snort"),
    (re.compile(r"ModSecurity|OWASP.*CRS|WAF|RuleId|clientIp.*action", re.I),    "waf"),
    (re.compile(r"#separator|#path|#fields|ts\s+uid\s+id", re.I),                "zeek"),
    (re.compile(r'"eventSource".*amazonaws|CloudTrail|"awsRegion"', re.I),        "aws_cloudtrail"),
    (re.compile(r"CrowdStrike|SentinelOne|CarbonBlack|Falcon|endpoint.*detect", re.I), "endpoint_edr"),
    (re.compile(r"%ASA-%|%PIX-%|%FWSM-%|Cisco.*IOS", re.I),                      "cisco"),
    (re.compile(r"THREAT.*palo|PAN-OS|panorama|Palo Alto", re.I),                 "palo_alto"),
    (re.compile(r"postfix|sendmail|dovecot|smtp.*reject|relay=", re.I),           "smtp"),
    (re.compile(r'"name".*"osquery"|osquery|host_identifier|unixTime', re.I),     "osquery"),
]


def detect_source(raw: str, hint: str = "generic") -> str:
    """Detect log source. Uses explicit hint first, then auto-detects."""
    if hint and hint in ALL_SOURCES and hint != "generic":
        return hint
    for pattern, source in _HINTS:
        if pattern.search(raw):
            return source
    return "generic"


def parse_alert(raw: str, source_hint: str = "generic") -> ParsedAlert:
    """Parse raw alert text and return a structured ParsedAlert."""
    source = detect_source(raw, source_hint)
    parser_fn = ALL_SOURCES.get(source, parse_generic)
    result: ParsedAlert = parser_fn(raw)
    result.source = source
    return result


def get_all_sources() -> list[dict]:
    """Return metadata for all supported log sources."""
    return [
        {"value": "generic",       "label": "Auto-detect",              "category": "General"},
        {"value": "auth",          "label": "Linux Auth Log (SSH)",      "category": "Linux"},
        {"value": "syslog",        "label": "Syslog (RFC 3164/5424)",    "category": "Linux"},
        {"value": "nmap",          "label": "Nmap Scan",                 "category": "Network"},
        {"value": "netflow",       "label": "NetFlow / IPFIX",           "category": "Network"},
        {"value": "dns",           "label": "DNS Server Log",            "category": "Network"},
        {"value": "smtp",          "label": "SMTP / Mail Server",        "category": "Network"},
        {"value": "suricata",      "label": "Suricata IDS",              "category": "IDS/IPS"},
        {"value": "snort",         "label": "Snort IDS",                 "category": "IDS/IPS"},
        {"value": "zeek",          "label": "Zeek (Bro) NSM",            "category": "IDS/IPS"},
        {"value": "firewall",      "label": "Firewall (iptables/pfSense)","category": "Firewall"},
        {"value": "cisco",         "label": "Cisco ASA / IOS",           "category": "Firewall"},
        {"value": "palo_alto",     "label": "Palo Alto Networks",        "category": "Firewall"},
        {"value": "waf",           "label": "WAF (ModSecurity/AWS)",     "category": "Web"},
        {"value": "apache",        "label": "Apache / Nginx Web Server", "category": "Web"},
        {"value": "windows_event", "label": "Windows Event Log",         "category": "Windows"},
        {"value": "endpoint_edr",  "label": "EDR (CrowdStrike/S1/CB)",   "category": "Endpoint"},
        {"value": "osquery",       "label": "osquery / Fleet",           "category": "Endpoint"},
        {"value": "aws_cloudtrail","label": "AWS CloudTrail",            "category": "Cloud"},
        {"value": "siem",          "label": "SIEM Export (Generic)",     "category": "General"},
    ]
