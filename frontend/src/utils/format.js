import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'MMM d, yyyy HH:mm')
  } catch {
    return iso
  }
}

export function fmtRelative(iso) {
  if (!iso) return '—'
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

export function fmtTime(iso) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'HH:mm:ss')
  } catch {
    return iso
  }
}
