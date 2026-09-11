const RISK_COLORS = {
  LOW: '#00d4aa', MEDIUM: '#f59e0b', HIGH: '#ff6b35', CRITICAL: '#ff2244',
}

export default function RiskScoreBar({ score, level }) {
  const color = RISK_COLORS[level?.toUpperCase()] ?? '#00d4aa'
  const pct   = Math.min(100, Math.max(0, score))
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-3xl font-black" style={{ color }}>{Math.round(pct)}</span>
        <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>/ 100</span>
      </div>
      <div className="h-2 rounded" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
