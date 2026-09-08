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

export function formatAlertType(type) {
  return (type ?? 'Unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
