"""
AEGIS Agentic SOC Assistant — Full Investigation Loop

Architecture:
    Raw Alert
        ↓
    Agent Investigation Loop (autonomous, read-only)
        ↓ collects evidence iteratively
    Guardrails (validate every action before it runs)
        ↓ state-changing actions go to approval queue
    Human Approval Gate (analyst approves/rejects/modifies)
        ↓ only approved safe actions proceed
    Safe Response Executor (predefined actions only)
        ↓ results recorded
    Feedback Loop (analyst rates investigation quality)
        ↓
    Complete Audit Trail (every step preserved forever)

Key principle: Rule-based risk scoring is UNCHANGED.
Agent focuses on: investigation, correlation, explanation, response.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

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

MAX_ITERATIONS = 8  # guardrail: prevent infinite loops


# ── Enums ─────────────────────────────────────────────────────────────────────

class AuditEntryType(str, Enum):
    INVESTIGATION_START  = "investigation_start"
    REASONING            = "reasoning"
    TOOL_CALL            = "tool_call"
    TOOL_RESULT          = "tool_result"
    EVIDENCE_COLLECTED   = "evidence_collected"
    GUARDRAIL_CHECK      = "guardrail_check"
    GUARDRAIL_BLOCKED    = "guardrail_blocked"
    DECISION             = "decision"
    LOOP_CONTINUE        = "loop_continue"
    LOOP_STOP            = "loop_stop"
    ACTION_PROPOSED      = "action_proposed"
    AWAITING_APPROVAL    = "awaiting_approval"
    ANALYST_APPROVED     = "analyst_approved"
    ANALYST_REJECTED     = "analyst_rejected"
    RESPONSE_EXECUTED    = "response_executed"
    RESPONSE_FAILED      = "response_failed"
    FEEDBACK_RECEIVED    = "feedback_received"
    INVESTIGATION_COMPLETE = "investigation_complete"


class ActionType(str, Enum):
    BLOCK_IP           = "block_ip"
    RATE_LIMIT         = "rate_limit"
    LOCK_ACCOUNT       = "lock_account"
    INCREASE_MONITORING = "increase_monitoring"
    NOTIFY             = "notify"
    ISOLATE_HOST       = "isolate_host"
    COLLECT_FORENSICS  = "collect_forensics"


# ── Safe action definitions ───────────────────────────────────────────────────
# Only these actions can ever be proposed by the agent.
# No arbitrary code execution. No system calls beyond these templates.

SAFE_ACTIONS: dict[str, dict] = {
    ActionType.BLOCK_IP: {
        "label": "Block source IP at firewall",
        "risk": "low",
        "description": "Add IP to firewall deny list",
        "reversible": True,
        "requires_approval": True,
    },
    ActionType.RATE_LIMIT: {
        "label": "Enable rate limiting on affected service",
        "risk": "low",
        "description": "Limit connection attempts per minute",
        "reversible": True,
        "requires_approval": True,
    },
    ActionType.LOCK_ACCOUNT: {
        "label": "Temporarily lock targeted account",
        "risk": "medium",
        "description": "Disable account until investigation complete",
        "reversible": True,
        "requires_approval": True,
    },
    ActionType.INCREASE_MONITORING: {
        "label": "Increase logging verbosity for this source",
        "risk": "low",
        "description": "Enable enhanced logging — read-only, no system change",
        "reversible": True,
        "requires_approval": False,  # read-only monitoring is automatic
    },
    ActionType.NOTIFY: {
        "label": "Send notification to security team",
        "risk": "low",
        "description": "Alert on-call analyst via configured channel",
        "reversible": False,
        "requires_approval": True,
    },
    ActionType.ISOLATE_HOST: {
        "label": "Isolate affected host from network",
        "risk": "high",
        "description": "Block all network access to/from host",
        "reversible": True,
        "requires_approval": True,
    },
    ActionType.COLLECT_FORENSICS: {
        "label": "Trigger forensic data collection",
        "risk": "low",
        "description": "Snapshot logs, processes, and connections — read-only",
        "reversible": True,
        "requires_approval": False,  # read-only
    },
}


# ── Audit trail entry ─────────────────────────────────────────────────────────

@dataclass
class AuditEntry:
    entry_type: str
    content:    str
    data:       Any = None
    tool_name:  str | None = None
    timestamp:  str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "type":      self.entry_type,
            "content":   self.content,
            "data":      self.data,
            "tool_name": self.tool_name,
            "timestamp": self.timestamp,
        }


# ── Proposed action ───────────────────────────────────────────────────────────

@dataclass
class ProposedAction:
    action_type:  str
    action_label: str
    reasoning:    str
    command:      str | None = None
    action_data:  dict | None = None
    risk_level:   str = "low"
    requires_approval: bool = True

    def to_dict(self) -> dict:
        return {
            "action_type":      self.action_type,
            "action_label":     self.action_label,
            "reasoning":        self.reasoning,
            "command":          self.command,
            "action_data":      self.action_data,
            "risk_level":       self.risk_level,
            "requires_approval": self.requires_approval,
        }


# ── Investigation result ──────────────────────────────────────────────────────

@dataclass
class SOCInvestigationResult:
    session_id:     int | None
    alert_id:       int
    phase:          str
    verdict:        str
    confidence_score: float
    confidence_label: str
    final_risk_level: str
    final_risk_score: float
    audit_trail:    list[dict]
    evidence_summary: str
    investigation_report: dict
    proposed_actions: list[dict]
    iterations_used: int

    def to_dict(self) -> dict:
        return {
            "session_id":           self.session_id,
            "alert_id":             self.alert_id,
            "phase":                self.phase,
            "verdict":              self.verdict,
            "confidence_score":     self.confidence_score,
            "confidence_label":     self.confidence_label,
            "final_risk_level":     self.final_risk_level,
            "final_risk_score":     self.final_risk_score,
            "audit_trail":          self.audit_trail,
            "evidence_summary":     self.evidence_summary,
            "investigation_report": self.investigation_report,
            "proposed_actions":     self.proposed_actions,
            "iterations_used":      self.iterations_used,
        }


# ── Main SOC Agent ────────────────────────────────────────────────────────────

class SOCAgent:
    """
    Full Agentic SOC Assistant.

    Investigation loop:
    1. Read alert → form initial hypothesis
    2. Decide tools → run tools (read-only, automatic)
    3. Evaluate evidence → check guardrails
    4. Decide: enough evidence? → stop or continue loop
    5. Propose actions → apply guardrails
    6. State-changing actions → human approval queue
    7. Read-only actions → execute automatically
    8. Record all results in audit trail
    """

    def __init__(self, db: Session, owner_id: int):
        self.db           = db
        self.owner_id     = owner_id
        self.audit_trail: list[AuditEntry] = []
        self.evidence:    dict = {}
        self.iterations   = 0

    # ── Audit helpers ────────────────────────────────────────────────────────

    def _audit(self, entry_type: str, content: str,
               data: Any = None, tool_name: str | None = None) -> AuditEntry:
        entry = AuditEntry(entry_type, content, data, tool_name)
        self.audit_trail.append(entry)
        logger.info("[SOCAgent] %s: %s", entry_type, content[:80])
        return entry

    # ── Guardrails ───────────────────────────────────────────────────────────

    def _guardrail_check_action(self, action: ProposedAction) -> tuple[bool, str]:
        """
        Validate a proposed action against safety guardrails.
        Returns (allowed, reason).
        """
        # Check action is in safe list
        if action.action_type not in SAFE_ACTIONS:
            reason = f"Action '{action.action_type}' is not in the approved safe action list."
            self._audit(AuditEntryType.GUARDRAIL_BLOCKED, reason)
            return False, reason

        # Check risk level — high-risk actions get extra scrutiny
        safe_def = SAFE_ACTIONS[action.action_type]
        if safe_def["risk"] == "high":
            self._audit(
                AuditEntryType.GUARDRAIL_CHECK,
                f"HIGH RISK action proposed: {action.action_label}. "
                f"Will require explicit analyst approval with justification."
            )

        self._audit(
            AuditEntryType.GUARDRAIL_CHECK,
            f"Guardrail PASSED for action: {action.action_label} "
            f"(risk: {safe_def['risk']}, requires_approval: {safe_def['requires_approval']})"
        )
        return True, "Guardrail check passed"

    def _guardrail_check_iteration(self) -> tuple[bool, str]:
        """Prevent infinite loops — max iterations guardrail."""
        if self.iterations >= MAX_ITERATIONS:
            reason = f"Maximum iterations ({MAX_ITERATIONS}) reached — stopping investigation loop."
            self._audit(AuditEntryType.GUARDRAIL_BLOCKED, reason)
            return False, reason
        return True, "OK"

    # ── Investigation loop ───────────────────────────────────────────────────

    async def investigate(self, alert: Any) -> SOCInvestigationResult:
        """
        Full autonomous investigation with guardrails.
        Read-only tools run automatically.
        State-changing actions go to approval queue.
        """
        from app.models.agent_session import AgentSession, PendingAction

        alert_data = json.loads(alert.parsed_data) if alert.parsed_data else {}
        alert_data["alert_type"] = alert.alert_type
        alert_data["source_ip"]  = alert.source_ip
        alert_data["risk_level"] = alert.risk_level
        alert_data["risk_score"] = alert.risk_score

        # Create session record
        session = AgentSession(
            alert_id=alert.id,
            owner_id=self.owner_id,
            phase="investigating",
            iteration=1,
        )
        self.db.add(session)
        self.db.flush()
        self.db.refresh(session)

        self._audit(
            AuditEntryType.INVESTIGATION_START,
            f"SOC Agent starting investigation of Alert #{alert.id}. "
            f"Type: {alert.alert_type}. Source: {alert.source_ip or 'N/A'}. "
            f"Initial risk: {alert.risk_level} ({alert.risk_score}/100). "
            f"Phase 1: Autonomous evidence collection (read-only)."
        )

        # Load environment profile to adapt agent proposals
        from app.models.environment_profile import EnvironmentProfile
        self.env_profile = self.db.query(EnvironmentProfile).filter(
            EnvironmentProfile.owner_id == self.owner_id
        ).first()
        env_desc = self.env_profile.to_context_string() if self.env_profile else "Default Linux"
        self._audit(
            AuditEntryType.REASONING,
            f"Active Environment Profile recognized: {env_desc}. "
            f"Remediation actions and command templates will be customized to this environment."
        )

        # ── Phase 1: Investigation loop ──────────────────────────────────
        proposed_actions: list[ProposedAction] = []
        tool_results: list[dict] = []
        related_data = []

        while True:
            self.iterations += 1
            session.iteration = self.iterations

            # Guardrail: max iterations
            allowed, reason = self._guardrail_check_iteration()
            if not allowed:
                self._audit(AuditEntryType.LOOP_STOP, reason)
                break

            self._audit(
                AuditEntryType.REASONING,
                f"Iteration {self.iterations}: Deciding what to investigate next. "
                f"Evidence so far: {list(self.evidence.keys()) or 'none yet'}."
            )

            # Decide which tools still needed
            tools_needed = self._decide_next_tools(alert_data)
            if not tools_needed:
                self._audit(AuditEntryType.LOOP_STOP,
                            "All relevant tools have been run. Stopping investigation loop.")
                break

            # Run each tool (all read-only — automatic, no approval needed)
            for tool_name in tools_needed:
                result = await self._run_tool(tool_name, alert, alert_data, related_data)
                if result:
                    tool_results.append(result)

            # Evaluate: do we have enough evidence?
            enough, reason = self._evaluate_evidence_sufficiency(alert_data)
            if enough:
                self._audit(AuditEntryType.LOOP_STOP,
                            f"Investigation loop complete: {reason}")
                break
            else:
                self._audit(AuditEntryType.LOOP_CONTINUE,
                            f"Continuing investigation: {reason}")

        # ── Phase 2: Propose actions ─────────────────────────────────────
        self._audit(
            AuditEntryType.DECISION,
            "Evidence collection complete. Entering Phase 2: Action proposal with guardrails."
        )

        raw_proposals = self._propose_actions(alert_data, self.evidence)
        for proposal in raw_proposals:
            allowed, reason = self._guardrail_check_action(proposal)
            if not allowed:
                continue

            self._audit(
                AuditEntryType.ACTION_PROPOSED,
                f"Proposing action: {proposal.action_label}. "
                f"Reasoning: {proposal.reasoning}. "
                f"Requires approval: {proposal.requires_approval}.",
                data=proposal.to_dict(),
            )

            safe_def = SAFE_ACTIONS.get(proposal.action_type, {})

            if proposal.requires_approval and safe_def.get("requires_approval", True):
                # Goes to human approval queue
                pa = PendingAction(
                    session_id=session.id,
                    owner_id=self.owner_id,
                    action_type=proposal.action_type,
                    action_label=proposal.action_label,
                    action_data=json.dumps(proposal.action_data or {}),
                    command=proposal.command,
                    risk_level=proposal.risk_level,
                    requires_approval=True,
                    reasoning=proposal.reasoning,
                    status="pending",
                )
                self.db.add(pa)
                self._audit(
                    AuditEntryType.AWAITING_APPROVAL,
                    f"Action '{proposal.action_label}' added to approval queue. "
                    f"Analyst must review before execution."
                )
            else:
                # Read-only or pre-approved — execute automatically
                pa = PendingAction(
                    session_id=session.id,
                    owner_id=self.owner_id,
                    action_type=proposal.action_type,
                    action_label=proposal.action_label,
                    action_data=json.dumps(proposal.action_data or {}),
                    command=proposal.command,
                    risk_level=proposal.risk_level,
                    requires_approval=False,
                    reasoning=proposal.reasoning,
                    status="approved",
                    decided_at=datetime.now(timezone.utc),
                    decided_by="agent_auto",
                    execution_result="Executed automatically (read-only action — no approval required)",
                    executed_at=datetime.now(timezone.utc),
                )
                self.db.add(pa)
                self._audit(
                    AuditEntryType.RESPONSE_EXECUTED,
                    f"Auto-executed read-only action: {proposal.action_label}"
                )

            proposed_actions.append(proposal)

        self.db.flush()

        # ── Phase 3: Final assessment ─────────────────────────────────────
        final = generate_final_assessment(alert_data, tool_results,
                                          self.evidence.get("risk_result"))
        final_data = final["result"]
        report = self._build_investigation_report(alert, alert_data, self.evidence,
                                                   final_data, proposed_actions)

        # Calculate confidence
        conf_score = final_data.get("confidence_score", 50)
        conf_label = final_data.get("confidence", "MEDIUM")

        evidence_summary = self._build_evidence_summary(alert, self.evidence)

        self._audit(
            AuditEntryType.INVESTIGATION_COMPLETE,
            f"Investigation complete after {self.iterations} iteration(s). "
            f"Verdict: {final_data.get('verdict', 'N/A')}. "
            f"Confidence: {conf_label} ({conf_score}%). "
            f"Actions in approval queue: {sum(1 for p in proposed_actions if p.requires_approval)}.",
            data={"verdict": final_data.get("verdict"), "confidence": conf_label}
        )

        # Update session
        session.phase             = "awaiting_approval" if any(p.requires_approval for p in proposed_actions) else "completed"
        session.verdict           = final_data.get("verdict", "")
        session.confidence_score  = conf_score
        session.confidence_label  = conf_label
        session.final_risk_level  = final_data.get("final_risk_level", alert.risk_level)
        session.final_risk_score  = final_data.get("final_risk_score", alert.risk_score)
        session.audit_trail       = json.dumps([e.to_dict() for e in self.audit_trail])
        session.evidence_summary  = evidence_summary
        session.investigation_report = json.dumps(report)
        self.db.flush()

        return SOCInvestigationResult(
            session_id=session.id,
            alert_id=alert.id,
            phase=session.phase,
            verdict=session.verdict,
            confidence_score=conf_score,
            confidence_label=conf_label,
            final_risk_level=session.final_risk_level,
            final_risk_score=session.final_risk_score,
            audit_trail=[e.to_dict() for e in self.audit_trail],
            evidence_summary=evidence_summary,
            investigation_report=report,
            proposed_actions=[p.to_dict() for p in proposed_actions],
            iterations_used=self.iterations,
        )

    # ── Tool runner ──────────────────────────────────────────────────────────

    async def _run_tool(self, tool_name: str, alert: Any,
                         alert_data: dict, related_data: list) -> dict | None:
        self._audit(AuditEntryType.TOOL_CALL,
                    f"Running tool: {tool_name}", tool_name=tool_name)
        result = None
        try:
            if tool_name == "search_related_alerts":
                result = search_related_alerts(
                    self.db, self.owner_id,
                    source_ip=alert.source_ip,
                    alert_type=alert.alert_type,
                    exclude_alert_id=alert.id,
                )
                self.evidence["related_count"] = result["result"].get("count", 0)
                self.evidence["related_alerts"] = result["result"].get("alerts", [])
                related_data.extend(self.evidence["related_alerts"])

            elif tool_name == "threat_intelligence" and alert.source_ip:
                result = await lookup_threat_intelligence(alert.source_ip)
                self.evidence["threat_intel"] = result["result"]

            elif tool_name == "build_timeline":
                result = build_attack_timeline(
                    alert.raw_alert,
                    self.evidence.get("related_alerts", [])
                )
                self.evidence["timeline"] = result["result"]

            elif tool_name == "cve_lookup":
                result = await lookup_cve(alert.alert_type, alert.protocol)
                self.evidence["cves"] = result["result"].get("cves", [])

            elif tool_name in ("evaluate_risk", "inspect_rule_engine"):
                result = evaluate_risk_with_context(
                    alert_data,
                    threat_intel=self.evidence.get("threat_intel"),
                    related_alert_count=self.evidence.get("related_count", 0),
                )
                self.evidence["risk_result"] = result["result"]
                self.evidence["risk_score"]  = alert.risk_score  # RuleEngine sole authority

            if result:
                self._audit(
                    AuditEntryType.TOOL_RESULT,
                    result["summary"],
                    data=result["result"],
                    tool_name=tool_name,
                )
                self._audit(
                    AuditEntryType.EVIDENCE_COLLECTED,
                    f"Evidence from {tool_name} stored. "
                    f"Total evidence keys: {list(self.evidence.keys())}."
                )

        except Exception as e:
            logger.warning("Tool %s failed: %s", tool_name, e)
            self._audit(AuditEntryType.TOOL_RESULT,
                        f"Tool {tool_name} failed: {e}", tool_name=tool_name)

        return result

    # ── Tool decision ────────────────────────────────────────────────────────

    def _decide_next_tools(self, alert_data: dict) -> list[str]:
        """Decide which tools still need to run."""
        needed = []
        alert_type = alert_data.get("alert_type", "")

        if "related_count" not in self.evidence:
            needed.append("search_related_alerts")
        if "threat_intel" not in self.evidence and alert_data.get("source_ip"):
            needed.append("threat_intelligence")
        if "timeline" not in self.evidence:
            needed.append("build_timeline")
        if "cves" not in self.evidence and any(
            k in alert_type for k in ("brute", "sql", "exploit", "c2", "lateral",
                                       "malware", "scan", "dos", "ransomware")
        ):
            needed.append("cve_lookup")
        if "risk_result" not in self.evidence:
            needed.append("inspect_rule_engine")

        # Second iteration: if TI shows threat, search broader
        if (self.iterations == 2 and
                self.evidence.get("threat_intel", {}).get("malicious_count", 0) > 0 and
                self.evidence.get("related_count", 0) == 0):
            needed = ["search_related_alerts"]  # broader search

        return needed

    # ── Evidence sufficiency ─────────────────────────────────────────────────

    def _evaluate_evidence_sufficiency(self, alert_data: dict) -> tuple[bool, str]:
        """Decide if we have enough evidence to form a confident verdict."""
        has_ti      = "threat_intel" in self.evidence
        has_related = "related_count" in self.evidence
        has_risk    = "risk_result" in self.evidence
        has_timeline = "timeline" in self.evidence

        if has_ti and has_related and has_risk and has_timeline:
            mal = self.evidence.get("threat_intel", {}).get("malicious_count", 0)
            related = self.evidence.get("related_count", 0)
            if mal >= 5 or related >= 3:
                return True, "High-confidence evidence from multiple sources."
            if has_ti and has_related:
                return True, "Sufficient evidence gathered from all primary sources."

        if self.iterations >= 3:
            return True, f"Maximum useful iterations reached ({self.iterations})."

        missing = [k for k in ["threat_intel", "related_count", "risk_result", "timeline"]
                   if k not in self.evidence]
        return False, f"Missing evidence: {missing}. Continuing investigation."

    # ── Action proposal ──────────────────────────────────────────────────────

    def _propose_actions(self, alert_data: dict,
                          evidence: dict) -> list[ProposedAction]:
        """Propose actions based on evidence. Only safe predefined actions."""
        actions = []
        alert_type = alert_data.get("alert_type", "")
        source_ip  = alert_data.get("source_ip", "")
        username   = alert_data.get("username", "")
        risk_score = evidence.get("risk_score", alert_data.get("risk_score", 0))
        ti         = evidence.get("threat_intel", {})
        related    = evidence.get("related_count", 0)

        # Always: increase monitoring (read-only, auto)
        actions.append(ProposedAction(
            action_type=ActionType.INCREASE_MONITORING,
            action_label=f"Enable enhanced logging for {source_ip or 'source'}",
            reasoning="Increased logging helps correlate future activity from this source.",
            requires_approval=False,
            risk_level="low",
        ))

        # Determine environment commands
        cloud = ((getattr(self.env_profile, "cloud", "") or "")).lower()
        firewall = ((getattr(self.env_profile, "firewall", "") or "")).lower()
        env_lower = f"{cloud} {firewall}"

        if "aws" in env_lower:
            block_cmd = f"aws ec2 authorize-security-group-ingress --group-id <sg-id> --protocol all --cidr {source_ip}/32 --description 'AEGIS Block'"
            lock_cmd = f"# AWS IAM / Identity: aws iam update-login-profile --user-name {username} --password-reset-required"
            rate_cmd = "aws wafv2 create-rate-based-rule --name aegis-rate-limit --rate-limit 100"
            fw_label = "AWS Security Group"
        elif "azure" in env_lower:
            block_cmd = f"az network nsg rule create --nsg-name <nsg> --name AEGISBlock --priority 100 --source-address-prefixes {source_ip}"
            lock_cmd = f"# Azure AD / Entra ID: Disable-AzADUser -UserPrincipalName {username}"
            rate_cmd = "# Azure Front Door / App Gateway: Configure WAF rate limiting"
            fw_label = "Azure NSG"
        elif "windows" in env_lower:
            block_cmd = f"netsh advfirewall firewall add rule name='AEGIS Block' dir=in action=block remoteip={source_ip}"
            lock_cmd = f"Disable-ADAccount -Identity {username}"
            rate_cmd = "# Windows Server: Configure IIS Dynamic IP Restrictions"
            fw_label = "Windows Defender Firewall"
        else:
            block_cmd = f"sudo iptables -A INPUT -s {source_ip} -j DROP && sudo iptables-save"
            lock_cmd = f"sudo passwd -l {username}"
            rate_cmd = f"fail2ban-client set sshd banip {source_ip or '<ip>'}"
            fw_label = "iptables firewall"

        # Block IP if confirmed malicious or high risk + related alerts
        if source_ip and (ti.get("malicious_count", 0) >= 3 or
                          (risk_score >= 70 and related >= 2)):
            actions.append(ProposedAction(
                action_type=ActionType.BLOCK_IP,
                action_label=f"Block {source_ip} at {fw_label}",
                reasoning=(
                    f"IP {source_ip} has {ti.get('malicious_count', 0)} threat intel detections "
                    f"and {related} related alerts. Blocking recommended to stop ongoing activity."
                ),
                command=block_cmd,
                action_data={"ip": source_ip},
                requires_approval=True,
                risk_level="low",
            ))

        # Rate limit for brute force
        if any(t in alert_type for t in ("brute_force", "failed_login")) and risk_score >= 50:
            actions.append(ProposedAction(
                action_type=ActionType.RATE_LIMIT,
                action_label="Apply rate limiting to authentication service",
                reasoning=(
                    f"Brute force pattern detected ({alert_data.get('attempt_count', 0)} attempts). "
                    f"Rate limiting will slow future attempts."
                ),
                command=rate_cmd,
                requires_approval=True,
                risk_level="low",
            ))

        # Lock account for targeted privileged accounts
        if username and username.lower() in {"admin", "root", "administrator", "sa"}:
            if risk_score >= 60:
                actions.append(ProposedAction(
                    action_type=ActionType.LOCK_ACCOUNT,
                    action_label=f"Temporarily lock account '{username}'",
                    reasoning=(
                        f"Privileged account '{username}' is under attack. "
                        f"Temporary lock prevents unauthorized access during investigation."
                    ),
                    command=lock_cmd,
                    action_data={"username": username},
                    requires_approval=True,
                    risk_level="medium",
                ))

        # Isolate host for C2, malware, ransomware
        if any(t in alert_type for t in ("c2", "malware", "ransomware", "lateral")) and risk_score >= 70:
            actions.append(ProposedAction(
                action_type=ActionType.ISOLATE_HOST,
                action_label=f"Isolate affected host {alert_data.get('destination_ip') or source_ip or 'host'}",
                reasoning=(
                    f"Evidence of {alert_type.replace('_', ' ')} detected. "
                    f"Host isolation prevents lateral spread while investigation continues."
                ),
                requires_approval=True,
                risk_level="high",
            ))

        # Forensic collection for serious threats
        if risk_score >= 70:
            actions.append(ProposedAction(
                action_type=ActionType.COLLECT_FORENSICS,
                action_label="Collect forensic evidence from affected systems",
                reasoning="High-risk alert requires forensic evidence preservation for post-incident analysis.",
                command="journalctl --since '1 hour ago' > /tmp/aegis_forensics.log",
                requires_approval=False,
                risk_level="low",
            ))

        # Notify team for CRITICAL
        if risk_score >= 80 or ti.get("malicious_count", 0) >= 10:
            actions.append(ProposedAction(
                action_type=ActionType.NOTIFY,
                action_label="Notify security team — CRITICAL incident",
                reasoning=f"Risk score {int(risk_score)}/100 meets CRITICAL threshold for immediate team notification.",
                requires_approval=True,
                risk_level="low",
            ))

        return actions

    # ── Report builders ──────────────────────────────────────────────────────

    def _build_evidence_summary(self, alert: Any, evidence: dict) -> str:
        lines = []
        if alert.source_ip:     lines.append(f"• Source IP: {alert.source_ip}")
        if alert.username:      lines.append(f"• Target account: {alert.username}")
        if alert.attempt_count: lines.append(f"• Events recorded: {alert.attempt_count}")
        if alert.protocol:      lines.append(f"• Protocol: {alert.protocol}")

        ti = evidence.get("threat_intel", {})
        if ti.get("malicious_count", 0) > 0:
            lines.append(f"• Threat intel: {ti['malicious_count']} malicious detections")
        related = evidence.get("related_count", 0)
        if related > 0:
            lines.append(f"• Related past alerts: {related}")
        cves = evidence.get("cves", [])
        if cves:
            lines.append(f"• Known weaknesses: {', '.join(c['cve'] for c in cves[:3])}")
        patterns = evidence.get("timeline", {}).get("patterns_detected", [])
        if patterns:
            lines.extend([f"• Pattern: {p}" for p in patterns[:2]])

        return "\n".join(lines) if lines else "• Limited evidence available."

    def _build_investigation_report(self, alert: Any, alert_data: dict,
                                     evidence: dict, final_data: dict,
                                     proposed_actions: list) -> dict:
        src = alert.source_ip or "unknown source"
        key_findings = final_data.get("key_findings", [])

        # Add evidence-based findings
        ti = evidence.get("threat_intel", {})
        if ti.get("malicious_count", 0) > 0:
            key_findings.insert(0, f"CONFIRMED THREAT: {src} flagged by {ti['malicious_count']} threat intelligence vendors")
        related = evidence.get("related_count", 0)
        if related > 0:
            key_findings.append(f"Attack campaign evidence: {related} related alerts from same source")

        return {
            "summary": (
                f"SOC Agent completed {self.iterations}-iteration investigation of "
                f"{alert.alert_type.replace('_', ' ').title()} from {src}. "
                f"Final risk: {final_data.get('final_risk_level', alert.risk_level)} "
                f"({int(final_data.get('final_risk_score', alert.risk_score))}/100). "
                f"Confidence: {final_data.get('confidence', 'MEDIUM')} ({final_data.get('confidence_score', 50)}%). "
                f"{len([a for a in proposed_actions if a.requires_approval])} actions pending analyst approval."
            ),
            "verdict":           final_data.get("verdict", ""),
            "confidence":        final_data.get("confidence", "MEDIUM"),
            "confidence_score":  final_data.get("confidence_score", 50),
            "final_risk_level":  alert.risk_level,
            "final_risk_score":  alert.risk_score,
            "rule_risk_level":   alert.risk_level,
            "rule_risk_score":   alert.risk_score,
            "rule_factors":      alert.risk_factors or [],
            "evidence_summary":  self._build_evidence_summary(alert, evidence),
            "key_findings":      key_findings,
            "cves_found":        evidence.get("cves", []),
            "related_alerts":    evidence.get("related_count", 0),
            "threat_confirmed":  ti.get("malicious_count", 0) > 0,
            "iterations_used":   self.iterations,
            "actions_proposed":  len(proposed_actions),
            "actions_requiring_approval": len([a for a in proposed_actions if a.requires_approval]),
            "risk_factors":      alert.risk_factors or evidence.get("risk_result", {}).get("all_factors", []),
        }
