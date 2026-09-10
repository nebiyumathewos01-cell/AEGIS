"""Demo scenarios — 20 realistic security alert examples."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.alert import AlertCreate
from app.services.alert_service import create_alert, save_analysis
from app.services.audit_service import log_action
from app.parsers import parse_alert
from app.rules import RuleEngine
from app.ai import AIAnalyzer

router = APIRouter(prefix="/api/demo", tags=["demo"])

SCENARIOS = [
    {
        "id": "ssh_brute_force",
        "title": "SSH Brute-Force Attack",
        "description": "25 failed SSH login attempts against admin from a single source IP over 90 seconds.",
        "source": "auth", "risk_level_hint": "CRITICAL",
        "raw": "\n".join([
            f"Jun 14 10:31:{i:02d} webserver sshd[1234]: Failed password for admin from 192.168.1.50 port {54312+i} ssh2"
            for i in range(25)
        ]),
    },
    {
        "id": "port_scan_full",
        "title": "Comprehensive Port Scan",
        "description": "Nmap scan revealing 12 open ports including SSH, RDP, SMB, MySQL on internal server.",
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
        "id": "suricata_c2",
        "title": "Suspected C2 Communication",
        "description": "Suricata IDS alerts for botnet C2 beacon traffic from an internal host.",
        "source": "suricata", "risk_level_hint": "CRITICAL",
        "raw": (
            "06/14/2024-11:42:07.221893  [**] [1:2013028:7] ET TROJAN Possible Botnet C2 HTTP POST "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 10.0.0.45:49832 -> 185.220.101.47:443\n"
            "06/14/2024-11:42:09.334521  [**] [1:2013028:7] ET TROJAN Possible Botnet C2 HTTP POST "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 10.0.0.45:49833 -> 185.220.101.47:443\n"
            "06/14/2024-11:42:31.556712  [**] [1:2008446:3] ET TROJAN C2 Checkin "
            "[**] [Classification: Trojan Activity] [Priority: 1] {TCP} 10.0.0.45:49834 -> 185.220.101.47:80\n"
            "06/14/2024-11:43:01.221893  [**] [1:2013028:7] ET TROJAN Possible Botnet C2 HTTP POST "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 10.0.0.45:49835 -> 185.220.101.47:443\n"
        ),
    },
    {
        "id": "repeated_auth",
        "title": "Repeated Authentication Failures",
        "description": "Failed logins from multiple IPs targeting root and admin accounts.",
        "source": "auth", "risk_level_hint": "MEDIUM",
        "raw": (
            "Jun 14 14:22:11 mailserver sshd[4521]: Failed password for invalid user root from 203.0.113.12 port 51234 ssh2\n"
            "Jun 14 14:22:14 mailserver sshd[4521]: Failed password for invalid user root from 203.0.113.15 port 51235 ssh2\n"
            "Jun 14 14:22:18 mailserver sshd[4521]: Failed password for invalid user root from 198.51.100.7 port 51236 ssh2\n"
            "Jun 14 14:22:21 mailserver sshd[4522]: Failed password for invalid user administrator from 198.51.100.9 port 51238 ssh2\n"
            "Jun 14 14:22:25 mailserver sshd[4522]: Failed password for invalid user administrator from 203.0.113.12 port 51239 ssh2\n"
            "Jun 14 14:22:31 mailserver sshd[4523]: Failed password for ubuntu from 198.51.100.7 port 51240 ssh2\n"
        ),
    },
    {
        "id": "suspicious_external",
        "title": "Suspicious External IP Communication",
        "description": "Repeated blocked outbound connections to a suspicious IP range on non-standard ports.",
        "source": "generic", "risk_level_hint": "MEDIUM",
        "raw": (
            "2024-06-14 16:05:11 FIREWALL DENY outbound TCP 10.0.1.22:52001 -> 91.108.4.0:8443 reason=policy_block\n"
            "2024-06-14 16:05:44 FIREWALL DENY outbound TCP 10.0.1.22:52002 -> 91.108.4.0:8443 reason=policy_block\n"
            "2024-06-14 16:06:12 FIREWALL DENY outbound TCP 10.0.1.22:52003 -> 91.108.4.0:8443 reason=policy_block\n"
            "2024-06-14 16:07:55 FIREWALL ALLOW inbound TCP 91.108.4.0:443 -> 10.0.1.22:52006\n"
            "2024-06-14 16:08:10 IDS ALERT high_risk_ip src=91.108.4.0 dst=10.0.1.22 signature=Known_Bad_IP\n"
        ),
    },
    {
        "id": "rdp_bruteforce",
        "title": "RDP Brute-Force Attempt",
        "description": "Repeated failed Remote Desktop Protocol login attempts from external IP.",
        "source": "generic", "risk_level_hint": "HIGH",
        "raw": (
            "2024-06-15 08:14:01 SECURITY FAILED_LOGIN protocol=RDP user=Administrator src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:03 SECURITY FAILED_LOGIN protocol=RDP user=Administrator src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:05 SECURITY FAILED_LOGIN protocol=RDP user=admin src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:07 SECURITY FAILED_LOGIN protocol=RDP user=admin src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:09 SECURITY FAILED_LOGIN protocol=RDP user=Administrator src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:11 SECURITY FAILED_LOGIN protocol=RDP user=guest src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:13 SECURITY FAILED_LOGIN protocol=RDP user=Administrator src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:15 SECURITY FAILED_LOGIN protocol=RDP user=admin src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:17 SECURITY FAILED_LOGIN protocol=RDP user=Administrator src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:19 SECURITY FAILED_LOGIN protocol=RDP user=Administrator src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:21 SECURITY FAILED_LOGIN protocol=RDP user=Administrator src=185.234.219.50 dst=10.0.0.5:3389\n"
            "2024-06-15 08:14:23 SECURITY FAILED_LOGIN protocol=RDP user=admin src=185.234.219.50 dst=10.0.0.5:3389\n"
        ),
    },
    {
        "id": "malware_detected",
        "title": "Malware Detection — Trojan",
        "description": "Suricata detected known trojan malware signature on internal host traffic.",
        "source": "suricata", "risk_level_hint": "CRITICAL",
        "raw": (
            "06/15/2024-09:33:14.112233  [**] [1:2019284:3] ET MALWARE Win32/Emotet CnC Checkin "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 10.0.0.87:51234 -> 91.195.240.117:443\n"
            "06/15/2024-09:33:44.334455  [**] [1:2019284:3] ET MALWARE Win32/Emotet CnC Checkin "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 10.0.0.87:51235 -> 91.195.240.117:443\n"
            "06/15/2024-09:34:14.556677  [**] [1:2019284:3] ET MALWARE Win32/Emotet Data Exfil "
            "[**] [Classification: Trojan Activity] [Priority: 1] {TCP} 10.0.0.87:51236 -> 91.195.240.117:80\n"
        ),
    },
    {
        "id": "dos_attack",
        "title": "Denial of Service Attack",
        "description": "High-volume TCP SYN flood attack detected targeting web server.",
        "source": "suricata", "risk_level_hint": "HIGH",
        "raw": (
            "06/15/2024-10:01:00.000001  [**] [1:2101411:2] GPL SCAN SYN FIN "
            "[**] [Classification: Attempted Information Leak] [Priority: 2] {TCP} 198.51.100.50:0 -> 10.0.0.10:80\n"
            "06/15/2024-10:01:00.000050  [**] [1:2101411:2] GPL SCAN SYN FIN "
            "[**] [Classification: Attempted Information Leak] [Priority: 2] {TCP} 198.51.100.51:0 -> 10.0.0.10:80\n"
            "06/15/2024-10:01:00.000100  [**] [1:2101411:2] GPL SCAN SYN FIN "
            "[**] [Classification: Attempted Information Leak] [Priority: 2] {TCP} 198.51.100.52:0 -> 10.0.0.10:80\n"
            "06/15/2024-10:01:00.000150  [**] [1:2402000:5] ET DROP Spamhaus DROP Listed Traffic Inbound "
            "[**] [Classification: Misc Attack] [Priority: 2] {TCP} 198.51.100.53:0 -> 10.0.0.10:80\n"
        ),
    },
    {
        "id": "sql_injection",
        "title": "SQL Injection Attempt",
        "description": "Web application firewall detected SQL injection patterns in HTTP requests.",
        "source": "suricata", "risk_level_hint": "HIGH",
        "raw": (
            "06/15/2024-11:22:33.445566  [**] [1:2006445:8] ET WEB_SPECIFIC_APPS Generic SQL Injection "
            "[**] [Classification: Web Application Attack] [Priority: 2] {TCP} 203.0.113.77:54321 -> 10.0.0.20:80\n"
            "06/15/2024-11:22:34.556677  [**] [1:2006446:5] ET WEB_SPECIFIC_APPS SQL Injection UNION SELECT "
            "[**] [Classification: Web Application Attack] [Priority: 2] {TCP} 203.0.113.77:54322 -> 10.0.0.20:80\n"
            "06/15/2024-11:22:35.667788  [**] [1:2006447:4] ET WEB_SPECIFIC_APPS SQL Injection Blind "
            "[**] [Classification: Web Application Attack] [Priority: 2] {TCP} 203.0.113.77:54323 -> 10.0.0.20:80\n"
        ),
    },
    {
        "id": "ftp_bruteforce",
        "title": "FTP Brute-Force Attack",
        "description": "Multiple failed FTP authentication attempts against file server.",
        "source": "generic", "risk_level_hint": "MEDIUM",
        "raw": (
            "2024-06-15 12:00:01 FTP FAILED_LOGIN user=ftpuser src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:02 FTP FAILED_LOGIN user=ftpuser src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:03 FTP FAILED_LOGIN user=admin src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:04 FTP FAILED_LOGIN user=admin src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:05 FTP FAILED_LOGIN user=root src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:06 FTP FAILED_LOGIN user=root src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:07 FTP FAILED_LOGIN user=anonymous src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:08 FTP FAILED_LOGIN user=anonymous src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:09 FTP FAILED_LOGIN user=ftpuser src=172.16.0.50 dst=10.0.0.30:21\n"
            "2024-06-15 12:00:10 FTP FAILED_LOGIN user=admin src=172.16.0.50 dst=10.0.0.30:21\n"
        ),
    },
    {
        "id": "nmap_stealth",
        "title": "Stealthy Nmap SYN Scan",
        "description": "Nmap SYN stealth scan against DMZ server — reconnaissance activity.",
        "source": "nmap", "risk_level_hint": "MEDIUM",
        "raw": (
            "Starting Nmap 7.94 at 2024-06-15 13:00:00 UTC\n"
            "Nmap scan report for 192.168.10.5\nHost is up (0.0008s latency).\n"
            "PORT    STATE    SERVICE\n"
            "22/tcp  open     ssh\n"
            "80/tcp  open     http\n"
            "443/tcp open     https\n"
            "8080/tcp open    http-proxy\n"
            "8443/tcp filtered https-alt\n"
            "3306/tcp closed  mysql\n"
            "Nmap done: 1 IP address (1 host up) scanned in 3.21 seconds\n"
        ),
    },
    {
        "id": "lateral_movement",
        "title": "Lateral Movement — SMB",
        "description": "Suspicious SMB connections between internal hosts suggesting lateral movement.",
        "source": "suricata", "risk_level_hint": "CRITICAL",
        "raw": (
            "06/15/2024-14:11:01.123456  [**] [1:2103251:4] GPL NETBIOS SMB-DS DCERPC LSASS MS04-011 overflow attempt "
            "[**] [Classification: Attempted Administrator Privilege Gain] [Priority: 1] {TCP} 10.0.0.87:1025 -> 10.0.0.92:445\n"
            "06/15/2024-14:11:05.234567  [**] [1:2103251:4] GPL NETBIOS SMB-DS DCERPC LSASS MS04-011 overflow attempt "
            "[**] [Classification: Attempted Administrator Privilege Gain] [Priority: 1] {TCP} 10.0.0.87:1026 -> 10.0.0.93:445\n"
            "06/15/2024-14:11:09.345678  [**] [1:2103251:4] GPL NETBIOS SMB-DS DCERPC LSASS MS04-011 overflow attempt "
            "[**] [Classification: Attempted Administrator Privilege Gain] [Priority: 1] {TCP} 10.0.0.87:1027 -> 10.0.0.94:445\n"
        ),
    },
    {
        "id": "data_exfiltration",
        "title": "Potential Data Exfiltration",
        "description": "Large outbound data transfers to external IP outside business hours.",
        "source": "generic", "risk_level_hint": "HIGH",
        "raw": (
            "2024-06-15 02:14:11 NETFLOW src=10.0.0.55 dst=185.199.108.153 bytes=524288000 proto=TCP dport=443 duration=120s\n"
            "2024-06-15 02:16:11 NETFLOW src=10.0.0.55 dst=185.199.108.153 bytes=314572800 proto=TCP dport=443 duration=80s\n"
            "2024-06-15 02:18:11 NETFLOW src=10.0.0.55 dst=185.199.108.153 bytes=209715200 proto=TCP dport=443 duration=60s\n"
            "2024-06-15 02:20:11 DLP ALERT type=large_upload user=jsmith host=10.0.0.55 size=1GB destination=external\n"
        ),
    },
    {
        "id": "privilege_escalation",
        "title": "Privilege Escalation Attempt",
        "description": "Sudo privilege escalation attempts detected on Linux server.",
        "source": "auth", "risk_level_hint": "HIGH",
        "raw": (
            "Jun 15 15:30:01 appserver sudo[9821]: pam_unix(sudo:auth): authentication failure; logname=webuser uid=1001 euid=0 tty=/dev/pts/0 ruser=webuser rhost= user=webuser\n"
            "Jun 15 15:30:05 appserver sudo[9822]: webuser : 3 incorrect password attempts ; TTY=pts/0 ; PWD=/home/webuser ; USER=root ; COMMAND=/bin/bash\n"
            "Jun 15 15:30:10 appserver sudo[9823]: pam_unix(sudo:auth): authentication failure; logname=webuser uid=1001 euid=0\n"
            "Jun 15 15:30:15 appserver sudo[9824]: webuser : 3 incorrect password attempts ; TTY=pts/0 ; PWD=/home/webuser ; USER=root ; COMMAND=/bin/sh\n"
            "Jun 15 15:30:20 appserver su[9825]: FAILED su for root by webuser\n"
            "Jun 15 15:30:25 appserver su[9826]: FAILED su for root by webuser\n"
        ),
    },
    {
        "id": "dns_tunneling",
        "title": "DNS Tunneling Detection",
        "description": "Suricata detected DNS tunneling patterns — possible data exfiltration over DNS.",
        "source": "suricata", "risk_level_hint": "HIGH",
        "raw": (
            "06/15/2024-16:00:01.111222  [**] [1:2027758:2] ET POLICY DNS Query to .onion proxy domain "
            "[**] [Classification: Potentially Bad Traffic] [Priority: 2] {UDP} 10.0.0.66:53421 -> 8.8.8.8:53\n"
            "06/15/2024-16:00:02.222333  [**] [1:2027865:1] ET TROJAN DNS Lookup for Known Malware Domain "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {UDP} 10.0.0.66:53422 -> 8.8.8.8:53\n"
            "06/15/2024-16:00:03.333444  [**] [1:2027866:1] ET TROJAN DNS Tunneling Detected "
            "[**] [Classification: Trojan Activity] [Priority: 1] {UDP} 10.0.0.66:53423 -> 8.8.8.8:53\n"
        ),
    },
    {
        "id": "web_shell",
        "title": "Web Shell Upload Attempt",
        "description": "Suricata detected web shell upload attempt against web server.",
        "source": "suricata", "risk_level_hint": "CRITICAL",
        "raw": (
            "06/15/2024-17:05:11.445566  [**] [1:2014819:5] ET WEB_SERVER PHP Web Shell Activity "
            "[**] [Classification: Web Application Attack] [Priority: 1] {TCP} 203.0.113.99:55001 -> 10.0.0.20:80\n"
            "06/15/2024-17:05:12.556677  [**] [1:2014820:3] ET WEB_SERVER Possible PHP Shell in HTTP POST "
            "[**] [Classification: Web Application Attack] [Priority: 1] {TCP} 203.0.113.99:55002 -> 10.0.0.20:80\n"
            "06/15/2024-17:05:14.667788  [**] [1:2014821:2] ET WEB_SERVER cmd.exe in HTTP POST "
            "[**] [Classification: Web Application Attack] [Priority: 1] {TCP} 203.0.113.99:55003 -> 10.0.0.20:80\n"
        ),
    },
    {
        "id": "ransomware_activity",
        "title": "Ransomware Activity Detected",
        "description": "Network traffic patterns consistent with ransomware encryption and C2 beaconing.",
        "source": "suricata", "risk_level_hint": "CRITICAL",
        "raw": (
            "06/15/2024-18:00:01.112233  [**] [1:2025797:2] ET TROJAN Possible Ransomware CnC Beacon "
            "[**] [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 10.0.0.77:49901 -> 185.220.101.20:443\n"
            "06/15/2024-18:00:31.223344  [**] [1:2025798:1] ET TROJAN Ransomware File Encryption Activity "
            "[**] [Classification: Trojan Activity] [Priority: 1] {TCP} 10.0.0.77:49902 -> 185.220.101.20:443\n"
            "06/15/2024-18:01:01.334455  [**] [1:2025799:1] ET TROJAN Ransomware Key Exchange "
            "[**] [Classification: Trojan Activity] [Priority: 1] {TCP} 10.0.0.77:49903 -> 185.220.101.20:8443\n"
        ),
    },
    {
        "id": "insider_threat",
        "title": "Insider Threat — After Hours Access",
        "description": "Employee accessing sensitive systems outside normal business hours from unusual location.",
        "source": "auth", "risk_level_hint": "MEDIUM",
        "raw": (
            "Jun 15 23:45:01 corpserver sshd[7741]: Accepted password for jsmith from 41.128.0.55 port 62341 ssh2\n"
            "Jun 15 23:45:05 corpserver sshd[7741]: pam_unix(sshd:session): session opened for user jsmith by (uid=0)\n"
            "Jun 15 23:46:10 corpserver sudo[7755]: jsmith : TTY=pts/0 ; PWD=/var/db ; USER=root ; COMMAND=/bin/cat customers.sql\n"
            "Jun 15 23:47:20 corpserver sudo[7756]: jsmith : TTY=pts/0 ; PWD=/var/db ; USER=root ; COMMAND=/usr/bin/scp customers.sql 41.128.0.55:/tmp/\n"
            "Jun 15 23:48:01 corpserver sshd[7741]: Disconnected from 41.128.0.55 port 62341\n"
        ),
    },
    {
        "id": "port_scan_udp",
        "title": "UDP Port Scan",
        "description": "Nmap UDP scan targeting internal DNS and SNMP services.",
        "source": "nmap", "risk_level_hint": "MEDIUM",
        "raw": (
            "Starting Nmap 7.94 at 2024-06-16 07:00:00 UTC\n"
            "Nmap scan report for 10.0.0.1\nHost is up.\n"
            "PORT     STATE         SERVICE\n"
            "53/udp   open          domain\n"
            "67/udp   open|filtered dhcps\n"
            "68/udp   open|filtered dhcpc\n"
            "69/udp   open|filtered tftp\n"
            "123/udp  open          ntp\n"
            "161/udp  open          snmp\n"
            "162/udp  open|filtered snmptrap\n"
            "500/udp  open|filtered isakmp\n"
            "Nmap done: 1 IP address (1 host up) scanned in 15.43 seconds\n"
        ),
    },
    {
        "id": "successful_breach",
        "title": "Successful Login After Brute Force",
        "description": "Successful SSH login detected immediately after a series of failed attempts — possible breach.",
        "source": "auth", "risk_level_hint": "CRITICAL",
        "raw": (
            "Jun 16 09:00:01 prodserver sshd[8801]: Failed password for admin from 45.141.84.80 port 41000 ssh2\n"
            "Jun 16 09:00:03 prodserver sshd[8801]: Failed password for admin from 45.141.84.80 port 41001 ssh2\n"
            "Jun 16 09:00:05 prodserver sshd[8801]: Failed password for admin from 45.141.84.80 port 41002 ssh2\n"
            "Jun 16 09:00:07 prodserver sshd[8801]: Failed password for admin from 45.141.84.80 port 41003 ssh2\n"
            "Jun 16 09:00:09 prodserver sshd[8801]: Failed password for admin from 45.141.84.80 port 41004 ssh2\n"
            "Jun 16 09:00:11 prodserver sshd[8801]: Failed password for admin from 45.141.84.80 port 41005 ssh2\n"
            "Jun 16 09:00:13 prodserver sshd[8801]: Accepted password for admin from 45.141.84.80 port 41006 ssh2\n"
            "Jun 16 09:00:13 prodserver sshd[8801]: pam_unix(sshd:session): session opened for user admin by (uid=0)\n"
            "Jun 16 09:00:15 prodserver sudo[8802]: admin : TTY=pts/0 ; PWD=/root ; USER=root ; COMMAND=/bin/bash\n"
        ),
    },
]


@router.get("/scenarios")
def list_scenarios(current_user: User = Depends(get_current_user)):
    return [{"id": s["id"], "title": s["title"], "description": s["description"],
             "source": s["source"], "risk_level_hint": s["risk_level_hint"]}
            for s in SCENARIOS]


@router.get("/scenarios/{sid}/raw")
def get_raw(sid: str, current_user: User = Depends(get_current_user)):
    s = next((x for x in SCENARIOS if x["id"] == sid), None)
    if not s:
        raise HTTPException(404, "Scenario not found")
    return {"id": s["id"], "title": s["title"], "source": s["source"], "raw_alert": s["raw"]}


@router.post("/scenarios/{sid}/load")
async def load_scenario(
    sid: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = next((x for x in SCENARIOS if x["id"] == sid), None)
    if not s:
        raise HTTPException(404, "Scenario not found")
    alert = create_alert(db, AlertCreate(raw_alert=s["raw"], source=s["source"]),
                         owner_id=current_user.id)
    parsed = parse_alert(alert.raw_alert, source_hint=alert.source)
    rule_result = RuleEngine().analyze(parsed)
    ai_result = await AIAnalyzer().analyze(parsed, rule_result)
    save_analysis(db, alert_id=alert.id, owner_id=current_user.id,
                  summary=ai_result.summary,
                  threat_interpretation=ai_result.threat_interpretation,
                  evidence=ai_result.evidence,
                  risk_explanation=ai_result.risk_explanation,
                  recommendations=ai_result.recommendations,
                  ai_model=ai_result.ai_model,
                  is_ai_generated=ai_result.is_ai_generated)
    await log_action(db, user=current_user, action="ALERT_CREATED",
                     detail=f"Demo scenario loaded: {s['title']} (alert #{alert.id})",
                     request=request)
    return {"scenario_id": sid, "alert_id": alert.id,
            "risk_level": alert.risk_level, "risk_score": alert.risk_score}


@router.post("/load-all")
async def load_all_scenarios(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Load all 20 scenarios at once for a full demo workspace."""
    results = []
    for s in SCENARIOS:
        try:
            alert = create_alert(db, AlertCreate(raw_alert=s["raw"], source=s["source"]),
                                 owner_id=current_user.id)
            parsed = parse_alert(alert.raw_alert, source_hint=alert.source)
            rule_result = RuleEngine().analyze(parsed)
            ai_result = await AIAnalyzer().analyze(parsed, rule_result)
            save_analysis(db, alert_id=alert.id, owner_id=current_user.id,
                          summary=ai_result.summary,
                          threat_interpretation=ai_result.threat_interpretation,
                          evidence=ai_result.evidence,
                          risk_explanation=ai_result.risk_explanation,
                          recommendations=ai_result.recommendations,
                          ai_model=ai_result.ai_model,
                          is_ai_generated=ai_result.is_ai_generated)
            results.append({"scenario_id": s["id"], "alert_id": alert.id,
                            "risk_level": alert.risk_level})
        except Exception as e:
            results.append({"scenario_id": s["id"], "error": str(e)})
    await log_action(db, user=current_user, action="DEMO_LOADED",
                     detail=f"Loaded all {len(SCENARIOS)} demo scenarios",
                     request=request)
    return {"loaded": len(results), "results": results}
