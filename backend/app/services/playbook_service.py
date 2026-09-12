"""
Automated Response & Playbook Generator.

Generates a step-by-step response plan tailored to:
  - The detected threat type
  - The user's Environment Profile

ALL actions are suggestions only — analyst must approve each step.
AEGIS never executes anything automatically.
"""
from __future__ import annotations
from typing import Any

# ── Step categories ───────────────────────────────────────────────────────────
CAT_BLOCK      = "block"
CAT_RATE_LIMIT = "rate_limit"
CAT_ACCOUNT    = "account"
CAT_MONITOR    = "monitor"
CAT_PATCH      = "patch"
CAT_ISOLATE    = "isolate"
CAT_NOTIFY     = "notify"
CAT_FORENSICS  = "forensics"

CATEGORY_LABELS = {
    CAT_BLOCK:      "Block / Deny",
    CAT_RATE_LIMIT: "Rate Limiting",
    CAT_ACCOUNT:    "Account Control",
    CAT_MONITOR:    "Increase Monitoring",
    CAT_PATCH:      "Patch / Harden",
    CAT_ISOLATE:    "Isolate / Contain",
    CAT_NOTIFY:     "Notify",
    CAT_FORENSICS:  "Forensic Collection",
}

SEVERITY_COLORS = {
    CAT_BLOCK:      "#ff2244",
    CAT_RATE_LIMIT: "#ff6b35",
    CAT_ACCOUNT:    "#f59e0b",
    CAT_MONITOR:    "#00d4aa",
    CAT_PATCH:      "#a855f7",
    CAT_ISOLATE:    "#ff2244",
    CAT_NOTIFY:     "#8888bb",
    CAT_FORENSICS:  "#00d4aa",
}


def _step(category: str, action: str, command: str | None = None,
          risk: str = "low", requires_approval: bool = True) -> dict[str, Any]:
    return {
        "category": category,
        "category_label": CATEGORY_LABELS.get(category, category),
        "color": SEVERITY_COLORS.get(category, "#8888bb"),
        "action": action,
        "command": command,
        "risk": risk,          # low / medium / high
        "requires_approval": requires_approval,
        "status": "pending",   # pending / approved / skipped / done
    }


def _env(profile: dict, key: str, default: str = "") -> str:
    return (profile.get(key) or default).lower()


def generate_playbook(
    alert_type: str,
    source_ip: str | None,
    username: str | None,
    risk_level: str,
    profile: dict,
) -> list[dict[str, Any]]:
    """
    Generate response steps based on threat + environment.
    Returns ordered list of step dicts.
    """
    steps: list[dict] = []
    ip = source_ip or "<source_ip>"
    user = username or "<username>"
    cloud   = _env(profile, "cloud")
    fw      = _env(profile, "firewall")
    web     = _env(profile, "web_server")
    app     = _env(profile, "app_framework")
    db      = _env(profile, "database")
    os_type = _env(profile, "os")
    ids     = _env(profile, "ids_ips")

    # ── Step builder helpers ──────────────────────────────────────────────────
    def block_ip():
        if "aws" in cloud:
            steps.append(_step(CAT_BLOCK,
                f"Block {ip} in AWS Security Group",
                f"aws ec2 authorize-security-group-ingress --group-id <sg-id> --protocol all --cidr {ip}/32 --description 'AEGIS block'",
                risk="low"))
        elif "azure" in cloud:
            steps.append(_step(CAT_BLOCK,
                f"Block {ip} in Azure NSG",
                f"az network nsg rule create --nsg-name <nsg> --name AEGISBlock --priority 100 --source-address-prefixes {ip}",
                risk="low"))
        elif "gcp" in cloud:
            steps.append(_step(CAT_BLOCK,
                f"Block {ip} in GCP Firewall",
                f"gcloud compute firewall-rules create aegis-block --direction INGRESS --action DENY --source-ranges {ip}",
                risk="low"))
        elif "iptables" in fw or "linux" in os_type:
            steps.append(_step(CAT_BLOCK,
                f"Block {ip} with iptables",
                f"sudo iptables -A INPUT -s {ip} -j DROP && sudo iptables-save > /etc/iptables/rules.v4",
                risk="low"))
        elif "pfsense" in fw:
            steps.append(_step(CAT_BLOCK,
                f"Add {ip} to pfSense block list",
                None, risk="low"))
        else:
            steps.append(_step(CAT_BLOCK,
                f"Block source IP {ip} at the perimeter firewall",
                None, risk="low"))

    def rate_limit_ssh():
        if "nginx" in web:
            steps.append(_step(CAT_RATE_LIMIT,
                "Add SSH/connection rate limiting in Nginx",
                "limit_conn_zone $binary_remote_addr zone=addr:10m; limit_conn addr 10;",
                risk="low"))
        elif "aws" in cloud:
            steps.append(_step(CAT_RATE_LIMIT,
                "Enable AWS WAF rate-based rule",
                "aws wafv2 create-rate-based-rule --name aegis-rate-limit --rate-limit 100",
                risk="low"))
        else:
            steps.append(_step(CAT_RATE_LIMIT,
                "Implement SSH rate limiting (e.g. fail2ban or firewall rule)",
                "sudo apt install fail2ban && sudo systemctl enable fail2ban",
                risk="low"))

    def lock_account():
        if "linux" in os_type or not os_type:
            steps.append(_step(CAT_ACCOUNT,
                f"Lock targeted account '{user}'",
                f"sudo passwd -l {user}",
                risk="medium"))
        elif "windows" in os_type:
            steps.append(_step(CAT_ACCOUNT,
                f"Disable account '{user}' in Active Directory",
                f"Disable-ADAccount -Identity {user}",
                risk="medium"))
        else:
            steps.append(_step(CAT_ACCOUNT,
                f"Disable or lock account '{user}' in your identity system",
                None, risk="medium"))

    def increase_logging():
        if ids and ids != "none":
            steps.append(_step(CAT_MONITOR,
                f"Increase {ids.title()} alert verbosity for this source",
                None, risk="low"))
        if "aws" in cloud:
            steps.append(_step(CAT_MONITOR,
                "Enable enhanced CloudTrail logging and GuardDuty alerts",
                None, risk="low"))
        if db:
            steps.append(_step(CAT_MONITOR,
                f"Enable query logging on {db.title()} for suspicious activity",
                None, risk="low"))
        steps.append(_step(CAT_MONITOR,
            f"Set up real-time alert for repeated activity from {ip}",
            None, risk="low"))

    def collect_forensics():
        steps.append(_step(CAT_FORENSICS,
            "Capture current authentication log snapshot",
            "sudo journalctl -u ssh --since '1 hour ago' > /tmp/aegis_ssh_evidence.log",
            risk="low"))
        steps.append(_step(CAT_FORENSICS,
            "Check for successful logins from same source",
            f"sudo grep '{ip}' /var/log/auth.log | grep -i 'accepted'",
            risk="low"))

    def notify_team():
        steps.append(_step(CAT_NOTIFY,
            "Notify security team of detected incident",
            None, risk="low", requires_approval=True))

    # ── Playbook templates by alert type ──────────────────────────────────────

    if alert_type in ("brute_force_attempt", "failed_login"):
        collect_forensics()
        block_ip()
        rate_limit_ssh()
        if username:
            lock_account()
        increase_logging()
        notify_team()

    elif alert_type in ("port_scan", "port_scan_targeted", "port_scan_comprehensive"):
        steps.append(_step(CAT_BLOCK,
            f"Block {ip} — reconnaissance activity detected",
            None, risk="low"))
        steps.append(_step(CAT_MONITOR,
            "Review what services are exposed on this host",
            "sudo nmap -sV localhost", risk="low"))
        steps.append(_step(CAT_PATCH,
            "Close unnecessary open ports identified in scan",
            None, risk="medium"))
        if "nginx" in web:
            steps.append(_step(CAT_PATCH,
                "Review Nginx server_tokens and exposed headers",
                "nginx -T | grep server_tokens", risk="low"))
        increase_logging()
        notify_team()

    elif alert_type in ("c2_communication", "malware_detected"):
        steps.append(_step(CAT_ISOLATE,
            "Isolate infected host from network immediately",
            None, risk="high", requires_approval=True))
        block_ip()
        steps.append(_step(CAT_FORENSICS,
            "Capture memory image before remediation",
            "sudo avml /tmp/memory.lime", risk="low"))
        steps.append(_step(CAT_FORENSICS,
            "List all active network connections on host",
            "ss -tnp | grep ESTABLISHED", risk="low"))
        steps.append(_step(CAT_PATCH,
            "Run endpoint antivirus/EDR full scan",
            None, risk="low"))
        notify_team()

    elif alert_type == "ransomware_activity":
        steps.append(_step(CAT_ISOLATE,
            "Immediately isolate affected host — prevent spread",
            None, risk="high", requires_approval=True))
        block_ip()
        steps.append(_step(CAT_ISOLATE,
            "Disconnect affected host from network shares",
            None, risk="high"))
        steps.append(_step(CAT_FORENSICS,
            "Check for encrypted files (.locky, .encrypted, etc.)",
            "find / -name '*.encrypted' -o -name '*.locked' 2>/dev/null | head -20",
            risk="low"))
        steps.append(_step(CAT_FORENSICS,
            "Identify ransom note files",
            "find / -name 'README*.txt' -o -name 'DECRYPT*.txt' 2>/dev/null",
            risk="low"))
        notify_team()

    elif alert_type in ("sql_injection", "web_attack", "exploit_attempt"):
        block_ip()
        if "nginx" in web:
            steps.append(_step(CAT_RATE_LIMIT,
                "Add WAF rules in Nginx to block SQLi patterns",
                "# Add to nginx.conf: if ($query_string ~* union.*select) { return 403; }",
                risk="low"))
        if "aws" in cloud:
            steps.append(_step(CAT_PATCH,
                "Enable AWS WAF with OWASP rule group",
                "aws wafv2 associate-web-acl --web-acl-arn <arn> --resource-arn <alb-arn>",
                risk="low"))
        if db:
            steps.append(_step(CAT_FORENSICS,
                f"Check {db.title()} slow query log for injection patterns",
                None, risk="low"))
        steps.append(_step(CAT_PATCH,
            "Verify all DB queries use parameterized statements",
            None, risk="low"))
        notify_team()

    elif alert_type == "data_exfiltration":
        block_ip()
        steps.append(_step(CAT_ISOLATE,
            "Block outbound traffic from source host",
            f"sudo iptables -A OUTPUT -s <host_ip> -j DROP",
            risk="high"))
        steps.append(_step(CAT_FORENSICS,
            "Capture network traffic from affected host",
            f"sudo tcpdump -i eth0 host <host_ip> -w /tmp/aegis_capture.pcap",
            risk="low"))
        if "aws" in cloud:
            steps.append(_step(CAT_FORENSICS,
                "Review AWS S3 access logs and CloudTrail for data access",
                None, risk="low"))
        notify_team()

    elif alert_type == "lateral_movement":
        block_ip()
        steps.append(_step(CAT_ISOLATE,
            "Segment affected network segment immediately",
            None, risk="high"))
        steps.append(_step(CAT_FORENSICS,
            "Check SMB/RPC connections between internal hosts",
            "sudo netstat -an | grep ':445\\|:135' | grep ESTABLISHED",
            risk="low"))
        steps.append(_step(CAT_ACCOUNT,
            "Audit recently used service accounts and credentials",
            None, risk="medium"))
        notify_team()

    elif alert_type == "privilege_escalation":
        if username:
            lock_account()
        steps.append(_step(CAT_FORENSICS,
            "Review sudo/su audit log for unauthorized escalation",
            f"sudo grep '{user}' /var/log/auth.log | grep -i 'sudo\\|su'",
            risk="low"))
        steps.append(_step(CAT_PATCH,
            "Audit sudoers file for unnecessary privileges",
            "sudo cat /etc/sudoers | grep -v '^#'",
            risk="low"))
        increase_logging()
        notify_team()

    elif alert_type == "dos_attack":
        block_ip()
        rate_limit_ssh()
        if "aws" in cloud:
            steps.append(_step(CAT_PATCH,
                "Enable AWS Shield Standard or Advanced protection",
                None, risk="low"))
        steps.append(_step(CAT_MONITOR,
            "Monitor bandwidth and CPU during the attack",
            "vmstat 1 10 && netstat -s | grep segments",
            risk="low"))
        notify_team()

    else:
        # Generic playbook
        collect_forensics()
        block_ip()
        increase_logging()
        notify_team()

    # Add step numbers
    for i, step in enumerate(steps, 1):
        step["step_number"] = i

    return steps
