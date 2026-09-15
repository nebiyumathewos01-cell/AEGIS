export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function riskBadgeClass(level) {
  const map = {
    LOW: 'badge-low',
    MEDIUM: 'badge-medium',
    HIGH: 'badge-high',
    CRITICAL: 'badge-critical',
  }
  return map[level?.toUpperCase()] ?? 'badge-low'
}

export function riskColor(level) {
  const map = {
    LOW: '#3fb950',
    MEDIUM: '#d29922',
    HIGH: '#f85149',
    CRITICAL: '#ff0000',
  }
  return map[level?.toUpperCase()] ?? '#3fb950'
}

export function riskBarColor(level) {
  const map = {
    LOW: 'bg-risk-low',
    MEDIUM: 'bg-risk-medium',
    HIGH: 'bg-risk-high',
    CRITICAL: 'bg-risk-critical',
  }
  return map[level?.toUpperCase()] ?? 'bg-risk-low'
}

export function statusBadgeClass(status) {
  const map = {
    new: 'status-new',
    investigating: 'status-investigating',
    confirmed: 'status-confirmed',
    false_positive: 'status-false_positive',
    resolved: 'status-resolved',
  }
  return map[status?.toLowerCase()] ?? 'status-new'
}

const ALERT_TYPE_NAMES = {
  brute_force_attempt: 'SSH Brute Force',
  ssh_bruteforce:      'SSH Brute Force',
  port_scan:           'Port Scan (SYN Recon)',
  nmap_scan:           'Nmap Port Scan',
  suspicious_login:    'Suspicious Admin Login',
  sqli_attempt:        'SQL Injection (SQLi)',
  web_attack_sqli:     'SQL Injection Attack',
  xss_attempt:         'Cross-Site Scripting (XSS)',
  web_attack_xss:      'Cross-Site Scripting Attack',
  dos_attack:          'Denial of Service (DoS)',
  privilege_escalation:'Privilege Escalation',
  ransomware_detected: 'Ransomware Activity',
  c2_communication:    'Command & Control (C2)',
  malware_detected:    'Malware Execution',
  unauthorized_access: 'Unauthorized Access Attempt',
  password_spraying:   'Password Spraying Attack',
}

export function formatAlertType(type) {
  if (!type) return 'Security Event'
  const key = type.toLowerCase().trim()
  if (ALERT_TYPE_NAMES[key]) {
    return ALERT_TYPE_NAMES[key]
  }
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
