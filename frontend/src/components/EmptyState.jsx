import { ShieldOff } from 'lucide-react'

export default function EmptyState({ title = 'No data', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <ShieldOff className="w-10 h-10 text-cyber-muted mb-3" />
      <p className="text-cyber-text font-medium">{title}</p>
      {message && <p className="text-sm text-cyber-muted mt-1 max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
