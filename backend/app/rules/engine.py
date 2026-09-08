"""
Deterministic rule-based security analysis engine.

Rules are evaluated against a ParsedAlert and produce:
  - A risk score (0–100)
  - A list of risk factors explaining WHY the score was assigned
  - A risk level: LOW / MEDIUM / HIGH / CRITICAL
  - Security flags (booleans for specific threat patterns)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.parsers.base import ParsedAlert


# ─── Sensitive services ─────────────────────────────────────────────────────
SENSITIVE_PORTS: dict[int, str] = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    445: "SMB",
    1433: "MSSQL",
    1521: "Oracle",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    5900: "VNC",
    6379: "Redis",
    9200: "Elasticsearch",
    27017: "MongoDB",
}

VERY_SENSITIVE_PORTS = {22, 3389, 445, 23, 5900}  # extra penalty

# ─── Privileged account names ───────────────────────────────────────────────
PRIVILEGED_ACCOUNTS = {
    "root", "admin", "administrator", "system", "sa",
    "oracle", "postgres", "mysql", "guest",
}

# ─── Thresholds ─────────────────────────────────────────────────────────────
BRUTE_FORCE_THRESHOLD = 10
HIGH_ATTEMPT_THRESHOLD = 50


@dataclass
class RiskFactor:
    description: str
    score_delta: int
    rule: str


@dataclass
class RuleResult:
    risk_score: float
    risk_level: str
    risk_factors: list[RiskFactor]
    flags: dict[str, bool] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "risk_factors": [
                {
                    "description": f.description,
                    "score_delta": f.score_delta,
                    "rule": f.rule,
                }
                for f in self.risk_factors
            ],
            "flags": self.flags,
        }


class RuleEngine:
    """Evaluate deterministic security rules against a ParsedAlert."""

    def analyze(self, parsed: ParsedAlert) -> RuleResult:
        factors: list[RiskFactor] = []
        flags: dict[str, bool] = {}
        score = 0

        # ── Rule 1: Brute-force detection ────────────────────────────────
        attempts = parsed.attempt_count or 0
        if attempts >= BRUTE_FORCE_THRESHOLD:
            flags["possible_bruteforce"] = True
            delta = min(30, 20 + (attempts // 10))
            factors.append(RiskFactor(
                description=f"Repeated failed authentication ({attempts} attempts)",
                score_delta=delta,
                rule="BRUTE_FORCE_DETECTION",
            ))
            score += delta
        elif attempts > 0:
            delta = min(15, attempts * 2)
            factors.append(RiskFactor(
                description=f"Failed authentication attempts detected ({attempts})",
                score_delta=delta,
                rule="FAILED_LOGIN",
            ))
            score += delta

        # ── Rule 2: High attempt volume ─────────────────────────────────
        if attempts >= HIGH_ATTEMPT_THRESHOLD:
            flags["high_volume_attack"] = True
            factors.append(RiskFactor(
                description=f"Very high attempt count ({attempts}) — sustained attack pattern",
                score_delta=20,
                rule="HIGH_ATTEMPT_VOLUME",
            ))
            score += 20

        # ── Rule 3: Sensitive service on destination port ────────────────
        dest_port = parsed.destination_port
        if dest_port and dest_port in SENSITIVE_PORTS:
            service = SENSITIVE_PORTS[dest_port]
            flags["sensitive_service"] = True
            delta = 20 if dest_port in VERY_SENSITIVE_PORTS else 12
            factors.append(RiskFactor(
                description=f"Sensitive service targeted: {service} (port {dest_port})",
                score_delta=delta,
                rule="SENSITIVE_SERVICE_TARGETED",
            ))
            score += delta

        # ── Rule 4: Privileged account targeted ──────────────────────────
        if parsed.username and parsed.username.lower() in PRIVILEGED_ACCOUNTS:
            flags["privileged_account_targeted"] = True
            factors.append(RiskFactor(
                description=f"Privileged account targeted: '{parsed.username}'",
                score_delta=15,
                rule="PRIVILEGED_ACCOUNT_TARGETED",
            ))
            score += 15

        # ── Rule 5: Alert type risk ──────────────────────────────────────
        alert_type_scores = {
            "brute_force_attempt": 25,
            "exploit_attempt": 35,
            "malware_detected": 40,
            "c2_communication": 40,
            "dos_attack": 30,
            "port_scan_comprehensive": 18,
            "port_scan_targeted": 14,
            "port_scan": 10,
            "sensitive_service_detected": 12,
            "failed_login": 8,
            "successful_login": 5,
            "policy_violation": 10,
            "connection_event": 5,
        }
        if parsed.alert_type in alert_type_scores:
            delta = alert_type_scores[parsed.alert_type]
            factors.append(RiskFactor(
                description=f"Alert type classification: {parsed.alert_type.replace('_', ' ').title()}",
                score_delta=delta,
                rule="ALERT_TYPE_RISK",
            ))
            score += delta

        # ── Rule 6: Port scan — many open ports ──────────────────────────
        open_ports = parsed.extra.get("open_ports", [])
        if len(open_ports) >= 10:
            flags["port_scan_detected"] = True
            factors.append(RiskFactor(
                description=f"{len(open_ports)} open ports discovered — systematic scan pattern",
                score_delta=15,
                rule="MANY_OPEN_PORTS",
            ))
            score += 15
        elif len(open_ports) >= 3:
            factors.append(RiskFactor(
                description=f"{len(open_ports)} open ports discovered",
                score_delta=8,
                rule="MULTIPLE_OPEN_PORTS",
            ))
            score += 8

        # ── Rule 7: Multiple sensitive ports open ─────────────────────────
        sensitive_open = parsed.extra.get("sensitive_open_ports", [])
        if len(sensitive_open) >= 2:
            flags["multiple_sensitive_services"] = True
            factors.append(RiskFactor(
                description=f"Multiple sensitive services exposed: {', '.join(p['service_name'] for p in sensitive_open[:5])}",
                score_delta=15,
                rule="MULTIPLE_SENSITIVE_SERVICES",
            ))
            score += 15

        # ── Rule 8: Suricata severity ─────────────────────────────────────
        if parsed.source == "suricata" and parsed.severity:
            sev_scores = {"CRITICAL": 30, "HIGH": 20, "MEDIUM": 10, "LOW": 5}
            delta = sev_scores.get(parsed.severity, 5)
            factors.append(RiskFactor(
                description=f"Suricata alert severity: {parsed.severity}",
                score_delta=delta,
                rule="SURICATA_SEVERITY",
            ))
            score += delta

        # ── Rule 9: Multiple unique source IPs ───────────────────────────
        unique_ips = parsed.extra.get("unique_source_ips", 0)
        if unique_ips > 1:
            factors.append(RiskFactor(
                description=f"Activity from {unique_ips} distinct source IPs",
                score_delta=10,
                rule="MULTIPLE_SOURCE_IPS",
            ))
            score += 10

        # Cap at 100
        score = min(100, score)

        # Determine level
        if score >= 80:
            level = "CRITICAL"
        elif score >= 60:
            level = "HIGH"
        elif score >= 30:
            level = "MEDIUM"
        else:
            level = "LOW"

        return RuleResult(
            risk_score=float(score),
            risk_level=level,
            risk_factors=factors,
            flags=flags,
        )
