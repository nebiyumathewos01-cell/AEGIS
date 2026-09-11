import { ShieldOff } from 'lucide-react'

export default function EmptyState({ title = 'No data', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <ShieldOff className="w-8 h-8 mb-3" style={{ color: 'var(--muted)' }} />
      <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</p>
      {message && <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--muted)' }}>{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
