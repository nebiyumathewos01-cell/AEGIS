"""
AI Analyzer — generates structured, multilingual security explanations.

Architecture:
  Raw Alert → Parser → Rule Engine → Risk Score → AI Explanation

The AI receives structured evidence + environment profile + language preference.
It never sees raw logs.
"""
from __future__ import annotations
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.ai.prompts import (
    SYSTEM_PROMPT, LANGUAGES, DEFAULT_LANGUAGE, get_analysis_prompt
)
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
    language: str = "en"


class AIAnalyzer:

    async def analyze(
        self,
        parsed: ParsedAlert,
        rule_result: RuleResult,
        language: str = "en",
        env_context: str = "",
    ) -> AnalysisResult:
        # Validate language
        if language not in LANGUAGES:
            language = DEFAULT_LANGUAGE

        evidence_dict = parsed.to_dict()
        evidence_dict["risk_score"] = rule_result.risk_score
        evidence_dict["risk_level"] = rule_result.risk_level

        risk_factors_text = "\n".join(
            f"  +{f.score_delta} — {f.description}"
            for f in rule_result.risk_factors
        ) or "No specific factors calculated."

        prompt = get_analysis_prompt(
            evidence_json=json.dumps(evidence_dict, indent=2, default=str),
            risk_score=int(rule_result.risk_score),
            risk_level=rule_result.risk_level,
            risk_factors_text=risk_factors_text,
            language=language,
            env_context=env_context,
        )

        # Try Ollama first
        result = await self._try_ollama(prompt, language)
        if result:
            return result

        # Try OpenAI
        if settings.openai_api_key:
            result = await self._try_openai(prompt, language)
            if result:
                return result

        # Rule-based fallback
        logger.info("Using rule-based fallback (language=%s)", language)
        return self._rule_based_fallback(parsed, rule_result, language, env_context)

    # ── Ollama ────────────────────────────────────────────────────────────────
    async def _try_ollama(self, prompt: str, language: str) -> AnalysisResult | None:
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
                result = self._parse_ai_json(data.get("response", ""), language)
                if result:
                    result.ai_model = f"ollama/{settings.ollama_model}"
                    result.is_ai_generated = True
                    return result
        except (httpx.ConnectError, httpx.TimeoutException):
            logger.debug("Ollama not available")
        except Exception as e:
            logger.warning("Ollama error: %s", e)
        return None

    # ── OpenAI ────────────────────────────────────────────────────────────────
    async def _try_openai(self, prompt: str, language: str) -> AnalysisResult | None:
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
                raw = data["choices"][0]["message"]["content"]
                result = self._parse_ai_json(raw, language)
                if result:
                    result.ai_model = settings.openai_model
                    result.is_ai_generated = True
                    return result
        except Exception as e:
            logger.warning("OpenAI error: %s", e)
        return None

    # ── JSON parser ───────────────────────────────────────────────────────────
    def _parse_ai_json(self, text: str, language: str) -> AnalysisResult | None:
        text = re.sub(r"```json\s*|\s*```", "", text).strip()
        try:
            data: dict[str, Any] = json.loads(text)
            lang = LANGUAGES.get(language, LANGUAGES["en"])
            labels = lang["labels"]

            # Try localized keys first, fall back to English keys
            def get_field(key: str, fallback: str) -> Any:
                return data.get(labels[key]) or data.get(fallback, "")

            recommendations = get_field("recommendations", "recommendations")
            if isinstance(recommendations, str):
                recommendations = [r.strip() for r in recommendations.split("\n") if r.strip()]

            return AnalysisResult(
                summary=str(get_field("summary", "summary")),
                threat_interpretation=str(get_field("threat_interpretation", "threat_interpretation")),
                evidence=str(get_field("evidence", "evidence")),
                risk_explanation=str(get_field("risk_explanation", "risk_explanation")),
                recommendations=recommendations,
                ai_model="",
                is_ai_generated=True,
                language=language,
            )
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning("Could not parse AI JSON: %s", e)
            return None

    # ── Rule-based fallback (multilingual) ────────────────────────────────────
    def _rule_based_fallback(
        self,
        parsed: ParsedAlert,
        rule_result: RuleResult,
        language: str = "en",
        env_context: str = "",
    ) -> AnalysisResult:
        alert_type_labels = {
            "brute_force_attempt":      "SSH Brute-Force Attack",
            "failed_login":             "Failed Authentication",
            "successful_login":         "Successful Login",
            "port_scan":                "Port Scan",
            "port_scan_targeted":       "Targeted Port Scan",
            "port_scan_comprehensive":  "Comprehensive Port Scan",
            "malware_detected":         "Malware Detection",
            "exploit_attempt":          "Exploit Attempt",
            "dos_attack":               "Denial of Service",
            "c2_communication":         "Command & Control Communication",
            "ransomware_activity":      "Ransomware Activity",
            "data_exfiltration":        "Data Exfiltration",
            "lateral_movement":         "Lateral Movement",
            "privilege_escalation":     "Privilege Escalation",
            "suricata_alert":           "Intrusion Detection Alert",
        }
        label = alert_type_labels.get(
            parsed.alert_type,
            parsed.alert_type.replace("_", " ").title()
        )

        # Evidence bullet list
        evidence_lines = []
        if parsed.source_ip:      evidence_lines.append(f"• Source IP: {parsed.source_ip}")
        if parsed.destination_ip: evidence_lines.append(f"• Destination IP: {parsed.destination_ip}")
        if parsed.protocol and parsed.destination_port:
            evidence_lines.append(f"• Service: {parsed.protocol} port {parsed.destination_port}")
        elif parsed.protocol:
            evidence_lines.append(f"• Protocol: {parsed.protocol}")
        if parsed.username:       evidence_lines.append(f"• Target account: {parsed.username}")
        if parsed.attempt_count:  evidence_lines.append(f"• {parsed.attempt_count} event(s) recorded")
        if parsed.severity:       evidence_lines.append(f"• Sensor severity: {parsed.severity}")
        for key in ("signature", "category"):
            val = parsed.extra.get(key)
            if val:
                evidence_lines.append(f"• {key.title()}: {val}")
        open_ports = parsed.extra.get("open_ports", [])
        if open_ports:
            port_summary = ", ".join(str(p["port"]) for p in open_ports[:8])
            evidence_lines.append(f"• Open ports: {port_summary}")
        evidence_text = "\n".join(evidence_lines) or "• Limited evidence extracted."

        # Recommendations
        src = parsed.source_ip or "the source"
        base_recs = {
            "brute_force_attempt": [
                f"Review SSH authentication logs for the time window of the attack.",
                f"Verify whether {src} is an authorised host.",
                "Check whether any login attempt succeeded after the failures.",
                "Consider implementing account lockout and rate limiting on SSH.",
                f"Evaluate blocking {src} at the firewall.",
            ],
            "port_scan": [
                f"Identify whether {src} belongs to an authorised scanner.",
                "Review firewall logs for connections established after the scan.",
                "Check whether any sensitive services are unnecessarily exposed.",
                f"Cross-reference {src} with threat intelligence feeds.",
                "Review network segmentation around the scanned host.",
            ],
            "malware_detected": [
                "Isolate the affected host immediately.",
                "Capture memory and disk forensic artefacts before remediation.",
                "Identify the initial infection vector.",
                "Scan other hosts in the same segment for similar indicators.",
                "Submit file hashes to threat intelligence platforms.",
            ],
        }

        # Add environment-specific step if profile available
        recs = base_recs.get(parsed.alert_type, [
            "Review the full alert context in your log management platform.",
            f"Confirm whether {src} is authorised.",
            "Assess whether any systems were successfully compromised.",
            "Review related activity from the same source in the same window.",
            "Escalate to a senior analyst if the alert cannot be dismissed.",
        ])

        if env_context and env_context != "No environment profile configured":
            recs.append(
                f"Apply environment-specific hardening based on your stack: {env_context[:120]}"
            )

        # Summaries per language
        summary_en = (
            f"{label} detected"
            + (f" from {parsed.source_ip}" if parsed.source_ip else "")
            + (f" targeting '{parsed.username}'" if parsed.username else "")
            + f". Risk: {rule_result.risk_level} ({int(rule_result.risk_score)}/100)."
        )
        summary_am = (
            f"{label} ተገኝቷል"
            + (f" ከ {parsed.source_ip}" if parsed.source_ip else "")
            + (f" '{parsed.username}'ን ያነጣጠረ" if parsed.username else "")
            + f"። ስጋት: {rule_result.risk_level} ({int(rule_result.risk_score)}/100)።"
        )
        summary_om = (
            f"{label} argame"
            + (f" irraa {parsed.source_ip}" if parsed.source_ip else "")
            + (f" '{parsed.username}' irratti" if parsed.username else "")
            + f". Balaa: {rule_result.risk_level} ({int(rule_result.risk_score)}/100)."
        )

        summaries = {"en": summary_en, "am": summary_am, "om": summary_om}
        summary = summaries.get(language, summary_en)

        factors_desc = "; ".join(f.description for f in rule_result.risk_factors[:3])
        risk_explanation = (
            f"The risk score of {int(rule_result.risk_score)}/100 ({rule_result.risk_level}) "
            f"was determined by: {factors_desc}."
            if factors_desc
            else f"Score: {int(rule_result.risk_score)}/100 ({rule_result.risk_level})."
        )

        threat_interp = (
            f"This pattern is consistent with {label.lower()} activity. "
            f"The evidence suggests automated or deliberate attack behaviour. "
            f"(Interpretation — confirm by reviewing full log context.)"
        )

        return AnalysisResult(
            summary=summary,
            threat_interpretation=threat_interp,
            evidence=evidence_text,
            risk_explanation=risk_explanation,
            recommendations=recs,
            ai_model="rule-based-fallback",
            is_ai_generated=False,
            language=language,
        )
