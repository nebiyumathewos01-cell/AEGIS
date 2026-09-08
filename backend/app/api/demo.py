"""Demo scenarios — 5 realistic security alert examples."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.alert import AlertCreate
from app.services.alert_service import create_alert, save_analysis
from app.parsers import parse_alert
from app.rules import RuleEngine
from app.ai import AIAnalyzer

router = APIRouter(prefix="/api/demo", tags=["demo"])

SCENARIOS = [
    {
        "id": "ssh_brute_force", "title": "SSH Brute-Force Attack",
        "description": "25 failed SSH login attempts against admin from a single source IP.",
        "source": "auth", "risk_level_hint": "HIGH",
        "raw": "\n".join([
            f"Jun 14 10:31:{i:02d} webserver sshd[1234]: Failed password for admin from 192.168.1.50 port {54312+i} ssh2"
            for i in range(25)
        ]),
    },
    {
        "id": "port_scan", "title": "Comprehensive Port Scan",
        "description": "Nmap scan revealing 12 open ports including SSH, RDP, SMB, MySQL.",
        "source": "nmap", "risk_level_hint": "HIGH",
        "raw": (
            "Starting Nmap 7.94 at 2024-06-14 09:15:00 UTC\n"
            "Nmap scan report for 10.0.0.15\nHost is up.\n"
            "PORT     STATE SERVICE\n"
            "21/tcp   open  ftp\n22/tcp   open  ssh\n23/tcp   open  telnet\n"
            "25/tcp   open  smtp\n80/tcp   open  http\n443/tcp  open  https\n"
            "445/tcp  open  microsoft-ds\n1433/tcp open  ms-sql-s\n"
            "3306/tcp open  mysql\n3389/tcp open  ms-wbt-server\n"
            "5432/tcp open  postgresql\n6379/tcp open  redis\n"
        ),
    },
    {
        "id": "suricata_c2", "title": "Suspected C2 Communication",
        "description": "Suricata IDS alert for botnet C2 beacon traffic.",
        "source": "suricata", "risk_level_hint": "CRITICAL",
        "raw": (
            "06/14/2024-11:42:07.221893  [**] [1:2013028:7] ET TROJAN Possible Botnet C2 HTTP POST "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 10.0.0.45:49832 -> 185.220.101.47:443\n"
            "06/14/2024-11:42:09.334521  [**] [1:2013028:7] ET TROJAN Possible Botnet C2 HTTP POST "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 10.0.0.45:49833 -> 185.220.101.47:443\n"
            "06/14/2024-11:42:31.556712  [**] [1:2008446:3] ET TROJAN C2 Checkin "
            "[**] [Classification: Trojan Activity] [Priority: 1] {TCP} 10.0.0.45:49834 -> 185.220.101.47:80\n"
        ),
    },
    {
        "id": "repeated_auth", "title": "Repeated Authentication Failures",
        "description": "Failed logins from multiple IPs targeting root and admin accounts.",
        "source": "auth", "risk_level_hint": "MEDIUM",
        "raw": (
            "Jun 14 14:22:11 mailserver sshd[4521]: Failed password for invalid user root from 203.0.113.12 port 51234 ssh2\n"
            "Jun 14 14:22:14 mailserver sshd[4521]: Failed password for invalid user root from 203.0.113.15 port 51235 ssh2\n"
            "Jun 14 14:22:18 mailserver sshd[4521]: Failed password for invalid user root from 198.51.100.7 port 51236 ssh2\n"
            "Jun 14 14:22:21 mailserver sshd[4521]: Failed password for invalid user root from 203.0.113.22 port 51237 ssh2\n"
            "Jun 14 14:22:25 mailserver sshd[4522]: Failed password for invalid user administrator from 198.51.100.9 port 51238 ssh2\n"
            "Jun 14 14:22:28 mailserver sshd[4522]: Failed password for invalid user administrator from 203.0.113.12 port 51239 ssh2\n"
            "Jun 14 14:22:31 mailserver sshd[4523]: Failed password for ubuntu from 198.51.100.7 port 51240 ssh2\n"
            "Jun 14 14:22:35 mailserver sshd[4523]: Failed password for ubuntu from 203.0.113.15 port 51241 ssh2\n"
        ),
    },
    {
        "id": "suspicious_external", "title": "Suspicious External IP Communication",
        "description": "Repeated blocked outbound connections to a suspicious IP range.",
        "source": "generic", "risk_level_hint": "MEDIUM",
        "raw": (
            "2024-06-14 16:05:11 FIREWALL DENY outbound TCP 10.0.1.22:52001 -> 91.108.4.0:8443 reason=policy_block\n"
            "2024-06-14 16:05:44 FIREWALL DENY outbound TCP 10.0.1.22:52002 -> 91.108.4.0:8443 reason=policy_block\n"
            "2024-06-14 16:06:12 FIREWALL DENY outbound TCP 10.0.1.22:52003 -> 91.108.4.0:8443 reason=policy_block\n"
            "2024-06-14 16:07:55 FIREWALL ALLOW inbound TCP 91.108.4.0:443 -> 10.0.1.22:52006\n"
            "2024-06-14 16:08:10 IDS ALERT high_risk_ip src=91.108.4.0 dst=10.0.1.22 signature=Known_Bad_IP\n"
        ),
    },
]


@router.get("/scenarios")
def list_scenarios():
    return [{"id": s["id"], "title": s["title"], "description": s["description"],
             "source": s["source"], "risk_level_hint": s["risk_level_hint"]}
            for s in SCENARIOS]


@router.get("/scenarios/{sid}/raw")
def get_raw(sid: str):
    s = next((x for x in SCENARIOS if x["id"] == sid), None)
    if not s:
        raise HTTPException(404, "Scenario not found")
    return {"id": s["id"], "title": s["title"], "source": s["source"], "raw_alert": s["raw"]}


@router.post("/scenarios/{sid}/load")
async def load_scenario(sid: str, db: Session = Depends(get_db)):
    s = next((x for x in SCENARIOS if x["id"] == sid), None)
    if not s:
        raise HTTPException(404, "Scenario not found")
    payload = AlertCreate(raw_alert=s["raw"], source=s["source"])
    alert = create_alert(db, payload)
    # Run AI analysis
    parsed = parse_alert(alert.raw_alert, source_hint=alert.source)
    rule_result = RuleEngine().analyze(parsed)
    ai_result = await AIAnalyzer().analyze(parsed, rule_result)
    save_analysis(db, alert_id=alert.id,
                  summary=ai_result.summary,
                  threat_interpretation=ai_result.threat_interpretation,
                  evidence=ai_result.evidence,
                  risk_explanation=ai_result.risk_explanation,
                  recommendations=ai_result.recommendations,
                  ai_model=ai_result.ai_model,
                  is_ai_generated=ai_result.is_ai_generated)
    return {"scenario_id": sid, "alert_id": alert.id,
            "risk_level": alert.risk_level, "risk_score": alert.risk_score}
