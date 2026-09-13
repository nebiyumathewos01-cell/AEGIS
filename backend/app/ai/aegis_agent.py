"""
AEGIS Agentic AI — Autonomous Security Investigation Engine

The agent autonomously decides which tools to run, executes them,
evaluates the results, and loops until it reaches a confident conclusion.

Architecture:
    Alert → Agent decides tools → Run tools → Evaluate findings
         → Decide if more info needed → Loop or conclude
         → Generate final investigation report

The agent is fully transparent — every step, decision, and reasoning
is logged and shown to the analyst.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from sqlalchemy.orm import Session

from app.ai.agent_tools import (
    search_related_alerts,
    lookup_threat_intelligence,
    evaluate_risk_with_context,
    build_attack_timeline,
    lookup_cve,
    generate_final_assessment,
)

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 6  # prevent infinite loops


@dataclass
class AgentStep:
    step_number: int
    action: str          # thinking | tool_call | observation | decision | conclusion
    tool_name: str | None = None
    reasoning: str = ""
    result: Any = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "step_number": self.step_number,
            "action": self.action,
            "tool_name": self.tool_name,
            "reasoning": self.reasoning,
            "result": self.result,
            "timestamp": self.timestamp,
        }


@dataclass
class AgentResult:
    alert_id: int
    steps: list[AgentStep]
    final_assessment: dict
    investigation_report: dict
    total_steps: int
    confidence: str
    verdict: str
    completed: bool = True

    def to_dict(self) -> dict:
        return {
            "alert_id": self.alert_id,
            "steps": [s.to_dict() for s in self.steps],
            "final_assessment": self.final_assessment,
            "investigation_report": self.investigation_report,
            "total_steps": self.total_steps,
            "confidence": self.confidence,
            "verdict": self.verdict,
            "completed": self.completed,
        }


class AEGISAgent:
    """
    Autonomous investigation agent.
    
    Decision loop:
    1. Assess the alert — what do I know?
    2. Decide what information I need
    3. Call tools to gather information
    4. Evaluate findings — is this enough?
    5. If not — decide what else to investigate
    6. If yes — write final report
    """

    def __init__(self, db: Session, owner_id: int):
        self.db = db
        self.owner_id = owner_id
        self.steps: list[AgentStep] = []
        self.tool_results: list[dict] = []
        self.step_counter = 0

    def _step(self, action: str, reasoning: str,
              tool_name: str | None = None, result: Any = None) -> AgentStep:
        self.step_counter += 1
        s = AgentStep(
            step_number=self.step_counter,
            action=action,
            tool_name=tool_name,
            reasoning=reasoning,
            result=result,
        )
        self.steps.append(s)
        logger.info("Agent Step %d [%s]: %s", self.step_counter, action, reasoning[:80])
        return s

    def _decide_tools(self, alert_data: dict) -> list[str]:
        """Decide which tools to run based on alert characteristics."""
        tools = []
        alert_type = alert_data.get("alert_type", "")
        source_ip  = alert_data.get("source_ip")
        attempt_count = alert_data.get("attempt_count", 0)

        # Always search for related alerts
        tools.append("search_related_alerts")

        # Always check threat intel if there's a source IP
        if source_ip:
            tools.append("threat_intelligence")

        # Always build timeline
        tools.append("build_timeline")

        # CVE lookup for specific attack types
        if any(t in alert_type for t in (
            "brute_force", "sql_injection", "exploit", "c2",
            "lateral_movement", "dos", "malware", "port_scan"
        )):
            tools.append("cve_lookup")

        # Deep risk evaluation always
        tools.append("evaluate_risk")

        return tools

    def _needs_more_investigation(self, findings_so_far: dict) -> tuple[bool, str]:
        """
        Decide if agent needs more investigation.
        Returns (needs_more, reason)
        """
        ti = findings_so_far.get("threat_intel", {})
        related = findings_so_far.get("related_count", 0)
        risk_score = findings_so_far.get("risk_score", 0)

        # High-confidence situation — no more needed
        if ti.get("malicious_count", 0) >= 10 and related >= 3:
            return False, "Sufficient evidence gathered — threat confirmed by multiple sources."

        # Inconclusive — check if we should dig deeper
        if risk_score >= 80 and related == 0:
            return True, "High risk but no corroborating alerts — search for campaign evidence."

        # Default — enough data
        return False, "Adequate evidence gathered for confident assessment."

    async def investigate(self, alert: Any) -> AgentResult:
        """
        Full autonomous investigation of an alert.
        Returns complete AgentResult with all steps and final report.
        """
        alert_data = json.loads(alert.parsed_data) if alert.parsed_data else {}
        alert_data["alert_type"] = alert.alert_type
        alert_data["source_ip"]  = alert.source_ip
        alert_data["risk_level"] = alert.risk_level
        alert_data["risk_score"] = alert.risk_score

        # ── Phase 1: Initial assessment ───────────────────────────────────
        self._step(
            "thinking",
            f"Starting autonomous investigation of Alert #{alert.id}. "
            f"Type: {alert.alert_type}. Source IP: {alert.source_ip or 'N/A'}. "
            f"Initial risk: {alert.risk_level} ({alert.risk_score}/100). "
            f"Deciding investigation strategy..."
        )

        # Decide tools
        tools_to_run = self._decide_tools(alert_data)
        self._step(
            "decision",
            f"Investigation plan: I will run {len(tools_to_run)} tools in sequence — "
            f"{', '.join(tools_to_run)}. "
            f"I will re-evaluate after each tool and decide if more investigation is needed.",
        )

        # ── Phase 2: Execute tools ────────────────────────────────────────
        findings: dict = {}
        related_alerts_data = []

        for tool_name in tools_to_run:

            # ── Tool: search_related_alerts ──────────────────────────────
            if tool_name == "search_related_alerts":
                self._step(
                    "thinking",
                    f"Searching for past alerts from {alert.source_ip or 'same attack type'} "
                    f"to determine if this is part of a campaign..."
                )
                result = search_related_alerts(
                    self.db,
                    owner_id=self.owner_id,
                    source_ip=alert.source_ip,
                    alert_type=alert.alert_type,
                    exclude_alert_id=alert.id,
                )
                self.tool_results.append(result)
                related_alerts_data = result["result"].get("alerts", [])
                findings["related_count"] = result["result"].get("count", 0)
                self._step(
                    "observation",
                    result["summary"],
                    tool_name="search_related_alerts",
                    result=result["result"],
                )

            # ── Tool: threat_intelligence ────────────────────────────────
            elif tool_name == "threat_intelligence" and alert.source_ip:
                self._step(
                    "thinking",
                    f"Checking threat intelligence for {alert.source_ip} — "
                    f"is this IP known to be malicious?"
                )
                result = await lookup_threat_intelligence(alert.source_ip)
                self.tool_results.append(result)
                findings["threat_intel"] = result["result"]
                self._step(
                    "observation",
                    result["summary"],
                    tool_name="threat_intelligence",
                    result=result["result"],
                )
                # Intermediate decision
                mal = result["result"].get("malicious_count", 0)
                if mal >= 5:
                    self._step(
                        "decision",
                        f"Threat intel confirms {alert.source_ip} is a known threat actor "
                        f"({mal} vendor detections). Escalating investigation priority."
                    )

            # ── Tool: build_timeline ─────────────────────────────────────
            elif tool_name == "build_timeline":
                self._step(
                    "thinking",
                    "Building chronological attack timeline to identify patterns and timing..."
                )
                result = build_attack_timeline(alert.raw_alert, related_alerts_data)
                self.tool_results.append(result)
                findings["timeline"] = result["result"]
                self._step(
                    "observation",
                    result["summary"],
                    tool_name="build_timeline",
                    result=result["result"],
                )

            # ── Tool: cve_lookup ─────────────────────────────────────────
            elif tool_name == "cve_lookup":
                self._step(
                    "thinking",
                    f"Looking up known vulnerabilities and weaknesses for {alert.alert_type}..."
                )
                result = await lookup_cve(alert.alert_type, alert.protocol)
                self.tool_results.append(result)
                findings["cves"] = result["result"].get("cves", [])
                self._step(
                    "observation",
                    result["summary"],
                    tool_name="cve_lookup",
                    result=result["result"],
                )

            # ── Tool: evaluate_risk ───────────────────────────────────────
            elif tool_name == "evaluate_risk":
                self._step(
                    "thinking",
                    "Re-evaluating risk score with all gathered intelligence — "
                    "threat intel, related alerts, and timeline patterns..."
                )
                result = evaluate_risk_with_context(
                    alert_data,
                    threat_intel=findings.get("threat_intel"),
                    related_alert_count=findings.get("related_count", 0),
                )
                self.tool_results.append(result)
                findings["risk_score"] = result["result"].get("final_score", alert.risk_score)
                findings["risk_result"] = result["result"]
                self._step(
                    "observation",
                    result["summary"],
                    tool_name="evaluate_risk",
                    result=result["result"],
                )

        # ── Phase 3: Should I investigate more? ───────────────────────────
        needs_more, reason = self._needs_more_investigation(findings)
        self._step("decision", reason)

        if needs_more:
            # Additional investigation iteration
            self._step(
                "thinking",
                "Initial investigation inconclusive — running additional checks..."
            )
            # Try broader search
            broader = search_related_alerts(
                self.db,
                owner_id=self.owner_id,
                alert_type=alert.alert_type,
                exclude_alert_id=alert.id,
                limit=20,
            )
            if broader["result"]["count"] > findings.get("related_count", 0):
                self.tool_results.append(broader)
                findings["related_count"] = broader["result"]["count"]
                self._step(
                    "observation",
                    f"Broader search: {broader['summary']}",
                    tool_name="search_related_alerts",
                    result=broader["result"],
                )
                # Re-evaluate risk with updated count
                re_eval = evaluate_risk_with_context(
                    alert_data,
                    threat_intel=findings.get("threat_intel"),
                    related_alert_count=findings["related_count"],
                )
                self.tool_results.append(re_eval)
                findings["risk_score"] = re_eval["result"].get("final_score")
                findings["risk_result"] = re_eval["result"]
                self._step(
                    "observation",
                    f"Updated risk assessment: {re_eval['summary']}",
                    tool_name="evaluate_risk",
                    result=re_eval["result"],
                )

        # ── Phase 4: Final synthesis ──────────────────────────────────────
        self._step(
            "thinking",
            "All evidence gathered. Synthesizing findings into final investigation report..."
        )

        final = generate_final_assessment(
            alert_data, self.tool_results, findings.get("risk_result")
        )
        self.tool_results.append(final)
        final_data = final["result"]

        # ── Build investigation report ────────────────────────────────────
        report = self._build_report(alert, alert_data, findings, final_data)

        self._step(
            "conclusion",
            f"Investigation complete. "
            f"Verdict: {final_data.get('verdict', 'See report')}. "
            f"Confidence: {final_data.get('confidence', 'MEDIUM')} "
            f"({final_data.get('confidence_score', 50)}%). "
            f"Used {len(self.tool_results)} tools over {self.step_counter} steps.",
            result=final_data,
        )

        return AgentResult(
            alert_id=alert.id,
            steps=self.steps,
            final_assessment=final_data,
            investigation_report=report,
            total_steps=self.step_counter,
            confidence=final_data.get("confidence", "MEDIUM"),
            verdict=final_data.get("verdict", "Investigation complete"),
            completed=True,
        )

    def _build_report(
        self,
        alert: Any,
        alert_data: dict,
        findings: dict,
        final_data: dict,
    ) -> dict:
        """Build structured investigation report from all findings."""
        # Recommendations based on findings
        recommendations = []
        src = alert.source_ip or "the source"

        if findings.get("threat_intel", {}).get("malicious_count", 0) > 0:
            recommendations.append(
                f"IMMEDIATE: Block {src} — confirmed malicious by threat intelligence."
            )
        if findings.get("related_count", 0) >= 3:
            recommendations.append(
                f"CAMPAIGN ALERT: {findings['related_count']} related alerts detected — "
                f"review all activity from {src}."
            )
        recommendations += [
            f"Review all authentication logs for activity from {src}.",
            "Verify whether any sessions from this source are still active.",
            "Cross-reference this IP against your firewall and proxy logs.",
            "Update threat intelligence blocklists with this indicator.",
        ]

        cves = findings.get("cves", [])
        if cves:
            recommendations.append(
                f"Address known weaknesses: {', '.join(c['cve'] for c in cves[:3])}."
            )

        # Evidence from all tools
        evidence_lines = []
        if alert.source_ip:
            evidence_lines.append(f"• Source IP: {alert.source_ip}")
        if alert.username:
            evidence_lines.append(f"• Target account: {alert.username}")
        if alert.attempt_count:
            evidence_lines.append(f"• Events recorded: {alert.attempt_count}")
        if alert.protocol:
            evidence_lines.append(f"• Protocol/Service: {alert.protocol}")
        if findings.get("related_count", 0) > 0:
            evidence_lines.append(f"• Related past alerts: {findings['related_count']}")
        ti = findings.get("threat_intel", {})
        if ti.get("malicious_count", 0) > 0:
            evidence_lines.append(f"• Threat intel detections: {ti['malicious_count']} vendors")

        risk_r = findings.get("risk_result", {})
        return {
            "summary": (
                f"AEGIS autonomous investigation of {alert.alert_type.replace('_', ' ').title()} "
                f"from {alert.source_ip or 'unknown source'}. "
                f"Final risk: {final_data.get('final_risk_level', alert.risk_level)} "
                f"({int(final_data.get('final_risk_score', alert.risk_score))}/100). "
                f"Confidence: {final_data.get('confidence', 'MEDIUM')}."
            ),
            "verdict":          final_data.get("verdict", ""),
            "confidence":       final_data.get("confidence", "MEDIUM"),
            "confidence_score": final_data.get("confidence_score", 50),
            "final_risk_level": final_data.get("final_risk_level", alert.risk_level),
            "final_risk_score": final_data.get("final_risk_score", alert.risk_score),
            "evidence":         "\n".join(evidence_lines),
            "key_findings":     final_data.get("key_findings", []),
            "recommendations":  recommendations[:8],
            "tools_used":       final_data.get("tools_used", []),
            "risk_factors":     risk_r.get("all_factors", []),
            "cves_found":       findings.get("cves", []),
            "related_alerts":   findings.get("related_count", 0),
            "threat_confirmed": ti.get("malicious_count", 0) > 0,
        }
