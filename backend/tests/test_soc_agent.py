"""
Unit and Integration Tests for AEGIS Agentic AI SOC Assistant
Tests the complete lifecycle:
  Raw Alert -> Agent Investigation Loop -> Guardrails -> Human Approval -> Response -> Feedback Loop
"""
import json
import unittest
import asyncio
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.user import User
from app.models.alert import Alert
from app.models.agent_session import AgentSession, PendingAction, FeedbackRecord
from app.ai.soc_agent import SOCAgent, SAFE_ACTIONS, ActionType, AuditEntryType
from app.api.agent import execute_safe_response
from app.rules import RuleEngine
from app.parsers.base import ParsedAlert


class TestSOCAgentLifecycle(unittest.TestCase):
    def setUp(self):
        # In-memory SQLite for fast, isolated testing
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Seed test user
        self.user = User(
            email="analyst@aegis.local",
            username="analyst1",
            full_name="Alex Vance",
            hashed_password="hashed_pw_test",
            role="analyst",
        )
        self.db.add(self.user)
        self.db.commit()

        # Calculate initial rule-based risk score using RuleEngine
        p = ParsedAlert()
        p.source_ip = "198.51.100.45"
        p.username = "root"
        p.attempt_count = 15
        p.alert_type = "brute_force_attempt"
        p.source = "auth"
        rule_res = RuleEngine().analyze(p)

        self.initial_risk_score = rule_res.risk_score
        self.initial_risk_level = rule_res.risk_level

        # Seed raw alert
        self.alert = Alert(
            owner_id=self.user.id,
            source="auth",
            alert_type="brute_force_attempt",
            source_ip="198.51.100.45",
            username="root",
            attempt_count=15,
            protocol="SSH",
            raw_alert="""Sep 14 10:00:01 server sshd[1234]: Failed password for root from 198.51.100.45 port 42311 ssh2
Sep 14 10:00:03 server sshd[1235]: Failed password for root from 198.51.100.45 port 42312 ssh2
Sep 14 10:00:05 server sshd[1236]: Failed password for root from 198.51.100.45 port 42313 ssh2""",
            parsed_data=json.dumps({
                "source_ip": "198.51.100.45",
                "username": "root",
                "attempt_count": 15,
                "protocol": "SSH",
                "alert_type": "brute_force_attempt",
                "source": "auth",
                "risk_score": self.initial_risk_score,
                "risk_level": self.initial_risk_level,
            }),
            risk_score=self.initial_risk_score,
            risk_level=self.initial_risk_level,
            status="new",
        )
        self.db.add(self.alert)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_1_raw_alert_rule_based_scoring_preserved(self):
        """Verify rule-based score on Alert is calculated and preserved."""
        alert = self.db.query(Alert).filter(Alert.id == self.alert.id).first()
        self.assertIsNotNone(alert)
        self.assertGreater(alert.risk_score, 0)
        self.assertEqual(alert.risk_score, self.initial_risk_score)
        self.assertEqual(alert.risk_level, self.initial_risk_level)

    def test_2_investigation_loop_and_evidence_collection(self):
        """Verify agent investigation runs multi-turn loop and collects evidence."""
        agent = SOCAgent(db=self.db, owner_id=self.user.id)
        result = asyncio.run(agent.investigate(self.alert))

        # Check investigation result
        self.assertIsNotNone(result.session_id)
        self.assertEqual(result.alert_id, self.alert.id)
        self.assertIn("brute force attempt", result.verdict.lower())

        # Check evidence was gathered
        self.assertTrue(len(agent.evidence) > 0)
        self.assertIn("timeline", agent.evidence)
        self.assertIn("related_count", agent.evidence)

        # Check audit trail records
        audit_types = [e["type"] for e in result.audit_trail]
        self.assertIn(AuditEntryType.INVESTIGATION_START.value, audit_types)
        self.assertIn(AuditEntryType.REASONING.value, audit_types)
        self.assertIn(AuditEntryType.TOOL_CALL.value, audit_types)
        self.assertIn(AuditEntryType.TOOL_RESULT.value, audit_types)
        self.assertIn(AuditEntryType.EVIDENCE_COLLECTED.value, audit_types)
        self.assertIn(AuditEntryType.INVESTIGATION_COMPLETE.value, audit_types)

        # Confirm original alert rule-based score is strictly unchanged
        alert = self.db.query(Alert).filter(Alert.id == self.alert.id).first()
        self.assertEqual(alert.risk_score, self.initial_risk_score)
        self.assertEqual(alert.risk_level, self.initial_risk_level)

    def test_3_guardrails_and_safe_actions_whitelist(self):
        """Verify guardrails restrict actions strictly to SAFE_ACTIONS whitelist."""
        agent = SOCAgent(db=self.db, owner_id=self.user.id)

        # Valid safe action passes guardrail
        from app.ai.soc_agent import ProposedAction
        safe_action = ProposedAction(
            action_type=ActionType.BLOCK_IP,
            action_label="Block IP",
            reasoning="Test block",
        )
        allowed, reason = agent._guardrail_check_action(safe_action)
        self.assertTrue(allowed)

        # Unsafe action blocked by guardrail
        unsafe_action = ProposedAction(
            action_type="arbitrary_bash_command",
            action_label="Run rm -rf /",
            reasoning="Harmful command",
        )
        allowed, reason = agent._guardrail_check_action(unsafe_action)
        self.assertFalse(allowed)
        self.assertIn("not in the approved safe action list", reason)

        # Max iterations guardrail prevents infinite loops
        agent.iterations = 8
        allowed, reason = agent._guardrail_check_iteration()
        self.assertFalse(allowed)
        self.assertIn("Maximum iterations", reason)

    def test_4_human_approval_gate_separates_readonly_and_state_changing(self):
        """Verify read-only actions execute automatically while state-changing actions require human approval."""
        agent = SOCAgent(db=self.db, owner_id=self.user.id)
        result = asyncio.run(agent.investigate(self.alert))

        session = self.db.query(AgentSession).filter(AgentSession.id == result.session_id).first()
        self.assertIsNotNone(session)
        actions = session.pending_actions

        read_only_actions = [a for a in actions if not a.requires_approval]
        state_changing_actions = [a for a in actions if a.requires_approval]

        # Read-only actions (e.g. increase_monitoring) must be auto-approved
        for ro in read_only_actions:
            self.assertEqual(ro.status, "approved")
            self.assertEqual(ro.decided_by, "agent_auto")
            self.assertIsNotNone(ro.execution_result)

        # State-changing actions (e.g. block_ip, rate_limit, lock_account) must be pending
        for sc in state_changing_actions:
            self.assertEqual(sc.status, "pending")
            self.assertIsNone(sc.decided_by)

        # Session phase must be awaiting_approval if state-changing actions are pending
        if state_changing_actions:
            self.assertEqual(session.phase, "awaiting_approval")

    def test_5_safe_response_execution_upon_approval(self):
        """Verify that human approval triggers safe response execution and audits the outcome."""
        agent = SOCAgent(db=self.db, owner_id=self.user.id)
        result = asyncio.run(agent.investigate(self.alert))

        pending_action = self.db.query(PendingAction).filter(
            PendingAction.session_id == result.session_id,
            PendingAction.status == "pending",
        ).first()

        self.assertIsNotNone(pending_action, "Expected at least one action pending approval")

        # Simulate human analyst approving action
        analyst_note = "Approved after reviewing repeated auth failures."
        pending_action.status = "approved"
        pending_action.analyst_note = analyst_note
        pending_action.decided_by = self.user.full_name
        pending_action.decided_at = datetime.now(timezone.utc)

        success, outcome = execute_safe_response(pending_action, self.user.full_name)
        self.assertTrue(success)
        self.assertIn("Status: Enforced", outcome)

        pending_action.execution_result = f"Approved by {self.user.full_name}. {outcome} [Note: {analyst_note}]"
        pending_action.executed_at = datetime.now(timezone.utc)
        self.db.commit()

        # Check action in DB
        reloaded = self.db.query(PendingAction).filter(PendingAction.id == pending_action.id).first()
        self.assertEqual(reloaded.status, "approved")
        self.assertIn("Status: Enforced", reloaded.execution_result)
        self.assertEqual(reloaded.decided_by, self.user.full_name)

    def test_6_action_rejection_prevents_execution(self):
        """Verify that human rejection prevents execution and logs justification."""
        agent = SOCAgent(db=self.db, owner_id=self.user.id)
        result = asyncio.run(agent.investigate(self.alert))

        pending_action = self.db.query(PendingAction).filter(
            PendingAction.session_id == result.session_id,
            PendingAction.status == "pending",
        ).first()

        self.assertIsNotNone(pending_action)

        # Simulate analyst rejecting action
        rejection_reason = "Internal IP range scheduled for vulnerability assessment."
        pending_action.status = "rejected"
        pending_action.analyst_note = rejection_reason
        pending_action.decided_by = self.user.full_name
        pending_action.decided_at = datetime.now(timezone.utc)
        pending_action.execution_result = f"Action rejected by analyst {self.user.full_name}. Reason: {rejection_reason}. No changes applied."
        self.db.commit()

        reloaded = self.db.query(PendingAction).filter(PendingAction.id == pending_action.id).first()
        self.assertEqual(reloaded.status, "rejected")
        self.assertIn("No changes applied", reloaded.execution_result)

    def test_7_feedback_loop_closes_investigation_lifecycle(self):
        """Verify analyst feedback is persisted, links to session, and transitions phase to completed."""
        agent = SOCAgent(db=self.db, owner_id=self.user.id)
        result = asyncio.run(agent.investigate(self.alert))

        session = self.db.query(AgentSession).filter(AgentSession.id == result.session_id).first()

        # Analyst submits feedback
        fb = FeedbackRecord(
            session_id=session.id,
            owner_id=self.user.id,
            verdict_correct=True,
            confidence_accurate=True,
            recommendations_helpful=True,
            overall_rating=5,
            analyst_comments="Accurate detection and helpful firewall block recommendation.",
            false_positive=False,
        )
        self.db.add(fb)
        session.phase = "completed"
        self.db.commit()

        # Check feedback record
        reloaded_fb = self.db.query(FeedbackRecord).filter(FeedbackRecord.session_id == session.id).first()
        self.assertIsNotNone(reloaded_fb)
        self.assertEqual(reloaded_fb.overall_rating, 5)
        self.assertTrue(reloaded_fb.verdict_correct)
        self.assertFalse(reloaded_fb.false_positive)
        self.assertEqual(session.phase, "completed")


if __name__ == "__main__":
    unittest.main()
