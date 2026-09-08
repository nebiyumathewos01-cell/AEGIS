"""
AI Analyzer — generates structured security explanations.

Architecture:
  Raw Alert → Parser → Structured Evidence → Rule Engine → Risk Score → AI Explanation

The AI never sees the raw log. It only receives structured, validated evidence
from the parser and rule engine. This prevents hallucination of security details.

Provider priority:
  1. Ollama (local, privacy-preserving)
  2. OpenAI-compatible API (if configured)
  3. Rule-based fallback (always available, no external dependency)
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.ai.prompts import SYSTEM_PROMPT, ANALYSIS_PROMPT_TEMPLATE
from app.config import get_settings
from app.parsers.base import ParsedAlert
from app.rules.engine import RuleResult

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class AnalysisResult:
    summary: str
    threat_interpretation: str
    evidence: str
    risk_explanation: str
    recommendations: list[str]
    ai_model: str
    is_ai_generated: bool


class AIAnalyzer:
    """Coordinate AI explanation generation with graceful degradation."""

    async def analyze(self, parsed: ParsedAlert, rule_result: RuleResult) -> AnalysisResult:
        evidence_dict = parsed.to_dict()
        evidence_dict["risk_score"] = rule_result.risk_score
        evidence_dict["risk_level"] = rule_result.risk_level

        risk_factors_text = "\n".join(
            f"  +{f.score_delta} — {f.description}"
            for f in rule_result.risk_factors
        )

        prompt = ANALYSIS_PROMPT_TEMPLATE.format(
            evidence_json=json.dumps(evidence_dict, indent=2, default=str),
            risk_score=int(rule_result.risk_score),
            risk_level=rule_result.risk_level,
            risk_factors_text=risk_factors_text or "No specific factors calculated.",
        )

        # Try Ollama first
        result = await self._try_ollama(prompt)
        if result:
            return result

        # Try OpenAI-compatible API
        if settings.openai_api_key:
            result = await self._try_openai(prompt)
            if result:
                return result

        # Deterministic fallback
        logger.info("Using rule-based analysis fallback")
        return self._rule_based_fallback(parsed, rule_result)

    # ── Ollama ───────────────────────────────────────────────────────────────
    async def _try_ollama(self, prompt: str) -> AnalysisResult | None:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={
                        "model": settings.ollama_model,
                        "prompt": f"{SYSTEM_PROMPT}\n\n{prompt}",
                        "stream": False,
                        "format": "json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                raw_response = data.get("response", "")
                parsed_resp = self._parse_ai_json(raw_response)
                if parsed_resp:
                    parsed_resp.ai_model = f"ollama/{settings.ollama_model}"
                    parsed_resp.is_ai_generated = True
                    return parsed_resp
        except (httpx.ConnectError, httpx.TimeoutException):
            logger.debug("Ollama not available, trying next provider")
        except Exception as e:
            logger.warning("Ollama error: %s", e)
        return None

    # ── OpenAI-compatible ────────────────────────────────────────────────────
    async def _try_openai(self, prompt: str) -> AnalysisResult | None:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.openai_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt},
                        ],
                        "response_format": {"type": "json_object"},
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                raw_response = data["choices"][0]["message"]["content"]
                parsed_resp = self._parse_ai_json(raw_response)
                if parsed_resp:
                    parsed_resp.ai_model = settings.openai_model
                    parsed_resp.is_ai_generated = True
                    return parsed_resp
        except Exception as e:
            logger.warning("OpenAI API error: %s", e)
        return None

    # ── JSON parser ──────────────────────────────────────────────────────────
    def _parse_ai_json(self, text: str) -> AnalysisResult | None:
        # Strip markdown code fences if present
        text = re.sub(r"```json\s*|\s*```", "", text).strip()
        try:
            data: dict[str, Any] = json.loads(text)
            recommendations = data.get("recommendations", [])
            if isinstance(recommendations, str):
                recommendations = [r.strip() for r in recommendations.split("\n") if r.strip()]
            return AnalysisResult(
                summary=str(data.get("summary", "")),
                threat_interpretation=str(data.get("threat_interpretation", "")),
                evidence=str(data.get("evidence", "")),
                risk_explanation=str(data.get("risk_explanation", "")),
                recommendations=recommendations,
                ai_model="",
                is_ai_generated=True,
            )
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning("Could not parse AI JSON response: %s", e)
            return None

    # ── Rule-based fallback ──────────────────────────────────────────────────
    def _rule_based_fallback(
        self, parsed: ParsedAlert, rule_result: RuleResult
    ) -> AnalysisResult:
        alert_type_labels = {
            "brute_force_attempt": "SSH Brute-Force Attack",
            "failed_login": "Failed Authentication",
            "successful_login": "Successful Login",
            "port_scan": "Port Scan",
            "port_scan_targeted": "Targeted Port Scan",
            "port_scan_comprehensive": "Comprehensive Port Scan",
            "malware_detected": "Malware Detection",
            "exploit_attempt": "Exploit Attempt",
            "dos_attack": "Denial of Service Attack",
            "c2_communication": "Command & Control Communication",
            "policy_violation": "Policy Violation",
            "suricata_alert": "Intrusion Detection Alert",
            "auth_event": "Authentication Event",
        }
        label = alert_type_labels.get(parsed.alert_type, parsed.alert_type.replace("_", " ").title())

        # Build evidence bullet list
        evidence_lines = []
        if parsed.source_ip:
            evidence_lines.append(f"• Source IP: {parsed.source_ip}")
        if parsed.destination_ip:
            evidence_lines.append(f"• Destination IP: {parsed.destination_ip}")
        if parsed.protocol and parsed.destination_port:
            evidence_lines.append(f"• Service: {parsed.protocol} port {parsed.destination_port}")
        elif parsed.protocol:
            evidence_lines.append(f"• Protocol: {parsed.protocol}")
        if parsed.username:
            evidence_lines.append(f"• Target account: {parsed.username}")
        if parsed.attempt_count:
            evidence_lines.append(f"• {parsed.attempt_count} event(s) recorded")
        if parsed.severity:
            evidence_lines.append(f"• Severity reported by sensor: {parsed.severity}")
        for extra_key in ("signature", "category"):
            val = parsed.extra.get(extra_key)
            if val:
                evidence_lines.append(f"• {extra_key.title()}: {val}")
        open_ports = parsed.extra.get("open_ports", [])
        if open_ports:
            port_summary = ", ".join(str(p["port"]) for p in open_ports[:8])
            evidence_lines.append(f"• Open ports discovered: {port_summary}")

        evidence_text = "\n".join(evidence_lines) if evidence_lines else "• Limited evidence extracted from alert."

        # Recommendations based on alert type
        rec_map: dict[str, list[str]] = {
            "brute_force_attempt": [
                "Review SSH authentication logs for the full time window of the activity.",
                "Determine whether source IP {src} is an authorised host.",
                "Verify whether any login attempts succeeded after the failed attempts.",
                "Consider implementing account lockout and rate limiting on the SSH service.",
                "Evaluate whether blocking or rate-limiting source IP {src} is appropriate.",
            ],
            "failed_login": [
                "Review authentication logs for the affected account and source.",
                "Confirm whether the source IP is authorised to access this service.",
                "Check whether repeated failures triggered any existing lockout policy.",
                "Notify the account owner to confirm whether they initiated these attempts.",
                "Review other activity from the same source IP in the same time window.",
            ],
            "port_scan": [
                "Identify whether the source IP {src} belongs to an authorised scanner.",
                "Confirm whether this is a scheduled internal vulnerability scan.",
                "Review firewall logs to see what connections were established after the scan.",
                "If external, consider whether to block or alert on further activity.",
                "Check for follow-on exploitation attempts from the same source.",
            ],
            "port_scan_comprehensive": [
                "Treat this as hostile reconnaissance unless an authorised scan can be confirmed.",
                "Review all connections from source IP {src} in the hours following the scan.",
                "Check whether any discovered open ports represent unnecessary attack surface.",
                "Cross-reference source IP with threat-intelligence feeds.",
                "Review network segmentation to ensure critical hosts are not reachable from this source.",
            ],
            "malware_detected": [
                "Isolate the affected host immediately to prevent lateral movement.",
                "Capture a memory image and disk forensic artefacts before remediation.",
                "Identify the initial infection vector (email, download, lateral movement).",
                "Scan other hosts in the same network segment for similar indicators.",
                "Submit file hashes to threat-intelligence platforms for broader context.",
            ],
            "exploit_attempt": [
                "Verify whether the target system was patched against the relevant vulnerability.",
                "Review application logs on the target for indicators of successful exploitation.",
                "Isolate the target system if exploitation cannot be ruled out.",
                "Identify and block the source IP at the perimeter.",
                "Review patch management records for the affected service.",
            ],
            "dos_attack": [
                "Confirm the impact on service availability from the target host.",
                "Enable rate limiting or traffic shaping at the perimeter.",
                "Notify upstream provider if the volume exceeds local mitigation capability.",
                "Review whether the attack is distributed and whether multiple source IPs are involved.",
                "Document the duration and impact for incident reporting.",
            ],
        }

        raw_recs = rec_map.get(
            parsed.alert_type,
            [
                "Review the full alert context in your log management platform.",
                "Confirm whether the source IP is authorised.",
                "Assess whether any systems were successfully accessed or compromised.",
                "Review related activity from the same source in the same time window.",
                "Escalate to a senior analyst if the alert cannot be confirmed as a false positive.",
            ],
        )
        src = parsed.source_ip or "the source"
        recommendations = [r.replace("{src}", src) for r in raw_recs]

        # Threat interpretation
        threat_map = {
            "brute_force_attempt": (
                f"This pattern is consistent with an automated brute-force attack against "
                f"{'the ' + parsed.protocol + ' service' if parsed.protocol else 'a remote service'}. "
                f"The high frequency of failed attempts from a single source suggests automated tooling. "
                f"(Interpretation — confirm by reviewing log timestamps and inter-attempt intervals.)"
            ),
            "port_scan": (
                "Systematic probing of multiple ports is characteristic of reconnaissance activity. "
                "An attacker or automated scanner may be mapping available services before attempting exploitation. "
                "(Interpretation — verify whether this matches any scheduled internal scans.)"
            ),
            "malware_detected": (
                "The intrusion detection system has identified traffic or behaviour associated with known malware. "
                "This may indicate an active infection, command-and-control communication, or lateral movement. "
                "(Interpretation — confirmation requires endpoint forensic investigation.)"
            ),
        }
        threat_interp = threat_map.get(
            parsed.alert_type,
            f"The activity pattern associated with this {label} alert warrants investigation. "
            f"The risk score of {int(rule_result.risk_score)} reflects the factors identified by the rule engine. "
            f"(Interpretation — further context is required to confirm or dismiss this alert.)",
        )

        summary = (
            f"{label} detected"
            + (f" from {parsed.source_ip}" if parsed.source_ip else "")
            + (f" targeting {parsed.username}" if parsed.username else "")
            + f". Risk level: {rule_result.risk_level} ({int(rule_result.risk_score)}/100)."
        )

        risk_factors_desc = "; ".join(f.description for f in rule_result.risk_factors[:3])
        risk_explanation = (
            f"The risk score of {int(rule_result.risk_score)}/100 ({rule_result.risk_level}) "
            f"was determined by the following factors: {risk_factors_desc}."
            if risk_factors_desc
            else f"The risk score of {int(rule_result.risk_score)}/100 ({rule_result.risk_level}) "
                 f"was assigned based on the alert type and available evidence."
        )

        return AnalysisResult(
            summary=summary,
            threat_interpretation=threat_interp,
            evidence=evidence_text,
            risk_explanation=risk_explanation,
            recommendations=recommendations,
            ai_model="rule-based-fallback",
            is_ai_generated=False,
        )
