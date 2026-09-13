"""
AEGIS Agent Tools — each tool the agent can call during investigation.

Every tool returns a structured result with:
  - tool_name: what tool ran
  - result: the data found
  - summary: plain-English one-line summary for the reasoning chain
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.alert import Alert
from app.parsers import parse_alert
from app.rules import RuleEngine

settings = get_settings()
_rule_engine = RuleEngine()


# ── Tool result wrapper ───────────────────────────────────────────────────────

def tool_result(name: str, data: Any, summary: str) -> dict:
    return {
        "tool_name": name,
        "result": data,
        "summary": summary,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Tool 1: Search related alerts ────────────────────────────────────────────

def search_related_alerts(
    db: Session,
    owner_id: int,
    source_ip: str | None = None,
    alert_type: str | None = None,
    exclude_alert_id: int | None = None,
    limit: int = 10,
) -> dict:
    """Find past alerts related by source IP or alert type."""
    q = db.query(Alert).filter(Alert.owner_id == owner_id)

    conditions = []
    if source_ip:
        conditions.append(Alert.source_ip == source_ip)
    if alert_type:
        conditions.append(Alert.alert_type == alert_type)

    if not conditions:
        return tool_result(
            "search_related_alerts",
            {"alerts": [], "count": 0},
            "No search criteria — skipped related alert search."
        )

    from sqlalchemy import or_
    q = q.filter(or_(*conditions))
    if exclude_alert_id:
        q = q.filter(Alert.id != exclude_alert_id)

    alerts = q.order_by(Alert.created_at.desc()).limit(limit).all()

    results = [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "source_ip": a.source_ip,
            "risk_level": a.risk_level,
            "risk_score": a.risk_score,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]

    count = len(results)
    if count == 0:
        summary = f"No related alerts found for IP {source_ip or 'N/A'}."
    elif count == 1:
        summary = f"Found 1 related alert from {source_ip} — risk: {results[0]['risk_level']}."
    else:
        levels = [r["risk_level"] for r in results]
        highest = "CRITICAL" if "CRITICAL" in levels else "HIGH" if "HIGH" in levels else levels[0]
        summary = (
            f"Found {count} related alerts from {source_ip or alert_type}. "
            f"Highest risk: {highest}. This suggests a pattern."
        )

    return tool_result("search_related_alerts", {"alerts": results, "count": count}, summary)


# ── Tool 2: Threat intelligence lookup ───────────────────────────────────────

async def lookup_threat_intelligence(ioc: str) -> dict:
    """Query VirusTotal or return demo data for an IP/domain."""
    if not ioc:
        return tool_result(
            "threat_intelligence",
            {},
            "No IOC provided for threat intelligence lookup."
        )

    # Try VirusTotal if key available
    if settings.virustotal_api_key:
        try:
            import re
            is_ip = bool(re.match(r"^\d+\.\d+\.\d+\.\d+$", ioc))
            endpoint = "ip_addresses" if is_ip else "domains"
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"https://www.virustotal.com/api/v3/{endpoint}/{ioc}",
                    headers={"x-apikey": settings.virustotal_api_key},
                )
                resp.raise_for_status()
                data = resp.json()
                attrs = data.get("data", {}).get("attributes", {})
                stats = attrs.get("last_analysis_stats", {})
                malicious = stats.get("malicious", 0)
                suspicious = stats.get("suspicious", 0)

                ti_data = {
                    "ioc": ioc,
                    "malicious_count": malicious,
                    "suspicious_count": suspicious,
                    "country": attrs.get("country", "Unknown"),
                    "asn_owner": attrs.get("as_owner", "Unknown"),
                    "reputation": attrs.get("reputation", 0),
                    "source": "virustotal",
                }

                if malicious >= 10:
                    summary = f"THREAT CONFIRMED: {ioc} flagged by {malicious} security vendors as malicious."
                elif malicious > 0:
                    summary = f"SUSPICIOUS: {ioc} flagged by {malicious} vendors. Investigate further."
                else:
                    summary = f"CLEAN: {ioc} — no malicious detections on VirusTotal."

                return tool_result("threat_intelligence", ti_data, summary)
        except Exception:
            pass

    # Demo/fallback data
    private_ranges = ["192.168.", "10.", "172.16.", "172.17.", "172.18.",
                      "172.19.", "172.2", "127.", "::1", "localhost"]
    is_private = any(ioc.startswith(p) for p in private_ranges)

    if is_private:
        data = {"ioc": ioc, "malicious_count": 0, "reputation": "Private",
                "source": "local", "note": "Private/internal IP — not in public threat feeds"}
        summary = f"{ioc} is a private/internal IP address — not routable on the public internet."
    else:
        data = {"ioc": ioc, "malicious_count": 0,
                "source": "demo", "note": "No VirusTotal API key configured"}
        summary = f"No threat intelligence available for {ioc} — configure VirusTotal API key for live data."

    return tool_result("threat_intelligence", data, summary)


# ── Tool 3: Deep risk re-evaluation ──────────────────────────────────────────

def evaluate_risk_with_context(
    parsed_data: dict,
    threat_intel: dict | None = None,
    related_alert_count: int = 0,
) -> dict:
    """Re-evaluate risk score with additional context from other tools."""
    from app.parsers.base import ParsedAlert

    # Reconstruct ParsedAlert from dict
    p = ParsedAlert()
    p.source_ip         = parsed_data.get("source_ip")
    p.destination_ip    = parsed_data.get("destination_ip")
    p.source_port       = parsed_data.get("source_port")
    p.destination_port  = parsed_data.get("destination_port")
    p.protocol          = parsed_data.get("protocol")
    p.username          = parsed_data.get("username")
    p.attempt_count     = parsed_data.get("attempt_count")
    p.alert_type        = parsed_data.get("alert_type", "security_event")
    p.severity          = parsed_data.get("severity")
    p.source            = parsed_data.get("source", "generic")
    p.extra             = {k: v for k, v in parsed_data.items()
                           if k not in ("source_ip", "destination_ip", "source_port",
                                        "destination_port", "protocol", "username",
                                        "attempt_count", "alert_type", "severity",
                                        "source", "timestamp")}

    base_result = _rule_engine.analyze(p)

    # Bonus scoring from agent context
    bonus = 0
    bonus_factors = []

    if threat_intel and threat_intel.get("malicious_count", 0) >= 5:
        bonus += 20
        bonus_factors.append(f"+20 Threat intel: IP flagged by {threat_intel['malicious_count']} vendors")
    elif threat_intel and threat_intel.get("malicious_count", 0) > 0:
        bonus += 10
        bonus_factors.append(f"+10 Threat intel: IP has {threat_intel['malicious_count']} malicious detections")

    if related_alert_count >= 5:
        bonus += 15
        bonus_factors.append(f"+15 Attack campaign: {related_alert_count} related alerts detected")
    elif related_alert_count >= 2:
        bonus += 8
        bonus_factors.append(f"+8 Repeated activity: {related_alert_count} related alerts")

    final_score = min(100, base_result.risk_score + bonus)
    if final_score >= 80:    level = "CRITICAL"
    elif final_score >= 60:  level = "HIGH"
    elif final_score >= 30:  level = "MEDIUM"
    else:                    level = "LOW"

    all_factors = [{"description": f.description, "score_delta": f.score_delta}
                   for f in base_result.risk_factors]
    for bf in bonus_factors:
        delta = int(bf.split("+")[1].split(" ")[0])
        all_factors.append({"description": bf.split(" ", 1)[1], "score_delta": delta})

    result = {
        "base_score":   base_result.risk_score,
        "bonus_score":  bonus,
        "final_score":  final_score,
        "risk_level":   level,
        "all_factors":  all_factors,
    }
    summary = (
        f"Risk re-evaluated: {final_score}/100 ({level}). "
        f"Base score: {int(base_result.risk_score)}, agent bonus: +{bonus}."
    )
    return tool_result("evaluate_risk", result, summary)


# ── Tool 4: Build attack timeline ────────────────────────────────────────────

def build_attack_timeline(
    raw_alert: str,
    related_alerts: list[dict] | None = None,
) -> dict:
    """Extract and sequence events to build a chronological attack timeline."""
    import re
    lines = [l.strip() for l in raw_alert.splitlines() if l.strip()]
    _TS_RE = re.compile(r"\d{2}:\d{2}:\d{2}")

    events = []
    for i, line in enumerate(lines[:30]):
        ts_match = _TS_RE.search(line)
        events.append({
            "sequence": i + 1,
            "time": ts_match.group(0) if ts_match else f"Event {i+1}",
            "event": line[:120],
        })

    # Add related alert timestamps
    if related_alerts:
        for ra in related_alerts[:5]:
            ts = ra.get("created_at", "")
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    events.append({
                        "sequence": len(events) + 1,
                        "time": dt.strftime("%Y-%m-%d %H:%M:%S"),
                        "event": f"[Related Alert #{ra['id']}] {ra['alert_type']} — {ra['risk_level']}",
                        "related": True,
                    })
                except ValueError:
                    pass

    # Detect patterns
    patterns = []
    total = len(lines)
    if total >= 10:
        patterns.append(f"High frequency: {total} events detected")
    if total >= 25:
        patterns.append("Sustained attack pattern — activity over extended period")
    unique_lines = len(set(lines))
    if unique_lines < total * 0.3:
        patterns.append("Repetitive pattern — likely automated tooling")

    result = {
        "events": events[:25],
        "total_events": total,
        "patterns_detected": patterns,
    }
    summary = (
        f"Timeline built: {total} events. "
        + (f"Patterns: {'; '.join(patterns)}." if patterns else "No unusual patterns detected.")
    )
    return tool_result("build_timeline", result, summary)


# ── Tool 5: CVE / vulnerability lookup ───────────────────────────────────────

async def lookup_cve(alert_type: str, protocol: str | None = None) -> dict:
    """Look up known CVEs related to the detected attack type."""
    # Static knowledge base — no external API needed
    CVE_DB: dict[str, list[dict]] = {
        "brute_force_attempt": [
            {"cve": "CWE-307", "name": "Improper Restriction of Excessive Authentication Attempts",
             "description": "System allows unlimited login attempts without lockout.",
             "severity": "HIGH", "mitigation": "Implement account lockout after 5-10 failed attempts."},
            {"cve": "CWE-521", "name": "Weak Password Requirements",
             "description": "System does not enforce strong password policy.",
             "severity": "MEDIUM", "mitigation": "Enforce NIST SP 800-63B password standards."},
        ],
        "port_scan": [
            {"cve": "CWE-200", "name": "Information Exposure",
             "description": "Open ports reveal service details to attackers.",
             "severity": "MEDIUM", "mitigation": "Close unnecessary ports and use port knocking."},
        ],
        "sql_injection": [
            {"cve": "CWE-89", "name": "SQL Injection",
             "description": "User input not properly sanitized before database queries.",
             "severity": "CRITICAL", "mitigation": "Use parameterized queries and prepared statements."},
            {"cve": "CVE-2012-2122", "name": "MySQL Authentication Bypass",
             "description": "Authentication timing attack on certain MySQL versions.",
             "severity": "HIGH", "mitigation": "Update MySQL to latest version."},
        ],
        "c2_communication": [
            {"cve": "CWE-912", "name": "Hidden Functionality — C2 Channel",
             "description": "Malware maintains covert communication channel to attacker.",
             "severity": "CRITICAL", "mitigation": "Isolate host immediately and run full forensic analysis."},
        ],
        "exploit_attempt": [
            {"cve": "CWE-119", "name": "Buffer Overflow",
             "description": "Memory corruption vulnerability being exploited.",
             "severity": "CRITICAL", "mitigation": "Apply latest security patches immediately."},
        ],
        "lateral_movement": [
            {"cve": "CVE-2017-0144", "name": "EternalBlue / SMB",
             "description": "Critical SMB vulnerability used for lateral movement.",
             "severity": "CRITICAL", "mitigation": "Patch MS17-010 and disable SMBv1."},
        ],
        "dos_attack": [
            {"cve": "CWE-400", "name": "Uncontrolled Resource Consumption",
             "description": "System susceptible to resource exhaustion attacks.",
             "severity": "HIGH", "mitigation": "Implement rate limiting and traffic shaping."},
        ],
        "malware_detected": [
            {"cve": "CWE-494", "name": "Download of Code Without Integrity Check",
             "description": "Malicious code executed on endpoint.",
             "severity": "CRITICAL", "mitigation": "Isolate endpoint and conduct forensic investigation."},
        ],
    }

    # Normalize alert type
    for key in CVE_DB:
        if key in alert_type:
            cves = CVE_DB[key]
            summary = (
                f"Found {len(cves)} relevant weakness/CVE for {alert_type}: "
                f"{', '.join(c['cve'] for c in cves)}. "
                f"Highest severity: {max(c['severity'] for c in cves)}."
            )
            return tool_result("cve_lookup", {"cves": cves, "alert_type": alert_type}, summary)

    return tool_result(
        "cve_lookup",
        {"cves": [], "alert_type": alert_type},
        f"No specific CVEs found for {alert_type} in knowledge base."
    )


# ── Tool 6: Generate investigation summary ────────────────────────────────────

def generate_final_assessment(
    alert_data: dict,
    tool_results: list[dict],
    risk_result: dict | None = None,
) -> dict:
    """Synthesize all tool findings into a final investigation assessment."""
    alert_type = alert_data.get("alert_type", "security_event")
    source_ip  = alert_data.get("source_ip", "unknown")

    # Collect key findings from all tools
    findings = []
    confidence_score = 50  # base confidence

    for tr in tool_results:
        name = tr.get("tool_name", "")
        result = tr.get("result", {})

        if name == "search_related_alerts":
            count = result.get("count", 0)
            if count > 0:
                findings.append(f"{count} related alerts from same source — pattern confirmed")
                confidence_score += min(20, count * 3)

        elif name == "threat_intelligence":
            mal = result.get("malicious_count", 0)
            if mal > 0:
                findings.append(f"Threat intel: IP flagged by {mal} security vendors")
                confidence_score += min(25, mal * 2)

        elif name == "cve_lookup":
            cves = result.get("cves", [])
            if cves:
                findings.append(f"Known weaknesses: {', '.join(c['cve'] for c in cves[:3])}")

        elif name == "build_timeline":
            patterns = result.get("patterns_detected", [])
            if patterns:
                findings.extend(patterns[:2])

    confidence_score = min(95, confidence_score)

    if confidence_score >= 80:    confidence_label = "HIGH"
    elif confidence_score >= 60:  confidence_label = "MEDIUM"
    else:                         confidence_label = "LOW"

    final_risk = risk_result.get("risk_level", "HIGH") if risk_result else "HIGH"
    final_score = risk_result.get("final_score", 70) if risk_result else 70

    assessment = {
        "verdict": f"{final_risk} — {alert_type.replace('_', ' ').title()} confirmed",
        "confidence": confidence_label,
        "confidence_score": confidence_score,
        "final_risk_level": final_risk,
        "final_risk_score": final_score,
        "key_findings": findings,
        "source_ip": source_ip,
        "alert_type": alert_type,
        "tools_used": [tr["tool_name"] for tr in tool_results],
    }

    summary = (
        f"Investigation complete. Verdict: {final_risk}. "
        f"Confidence: {confidence_label} ({confidence_score}%). "
        f"{len(findings)} supporting findings."
    )
    return tool_result("final_assessment", assessment, summary)
