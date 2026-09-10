import { statusBadgeClass } from '../utils/risk'

const LABELS = {
  new: 'New',
  investigating: 'Investigating',
  confirmed: 'Confirmed',
  false_positive: 'False Positive',
  resolved: 'Resolved',
}

export default function StatusBadge({ status }) {
  if (!status) return null
  return (
    <span className={statusBadgeClass(status)}>
      {LABELS[status] ?? status}
    </span>
  )
}

