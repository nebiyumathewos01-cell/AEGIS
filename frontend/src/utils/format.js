import { formatDistanceToNow } from 'date-fns'

/**
 * Standardizes any ISO/SQL timestamp string into a valid UTC Date object.
 * Handles both '2026-09-15T15:07:00' and '2026-09-15 15:07:00'.
 * Assumes naive timestamps from backend are in UTC.
 */
export function parseUtcDate(iso) {
  if (!iso) return null
  if (iso instanceof Date) return iso
  try {
    let s = String(iso).trim().replace(' ', 'T')
    // If no timezone offset (+/- or Z), append Z so it is treated as UTC
    if (!s.endsWith('Z') && !s.includes('+') && !s.slice(-6).includes('-')) {
      s += 'Z'
    }
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/**
 * Formats timestamp in Ethiopia Time (East Africa Time, UTC+3).
 * Example: 'Sep 15, 2026, 18:07 EAT'
 */
export function fmtDate(iso, includeTimezone = true) {
  if (!iso) return '—'
  const date = parseUtcDate(iso)
  if (!date) return String(iso)

  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Addis_Ababa',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)

    return includeTimezone ? `${formatted} EAT` : formatted
  } catch {
    return date.toLocaleString()
  }
}

/**
 * Formats relative elapsed time accurately against current time.
 * If logged within the last 60 seconds, returns 'just now'.
 */
export function fmtRelative(iso) {
  if (!iso) return '—'
  const date = parseUtcDate(iso)
  if (!date) return '—'

  try {
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSec >= -5 && diffSec < 60) {
      return 'just now'
    }
    if (diffSec >= 60 && diffSec < 3600) {
      const mins = Math.floor(diffSec / 60)
      return `${mins} min${mins > 1 ? 's' : ''} ago`
    }

    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return '—'
  }
}

/**
 * Formats exact time only in Ethiopia Time (HH:mm:ss EAT).
 */
export function fmtTime(iso) {
  if (!iso) return '—'
  const date = parseUtcDate(iso)
  if (!date) return '—'

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Addis_Ababa',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date) + ' EAT'
  } catch {
    return date.toLocaleTimeString()
  }
}
