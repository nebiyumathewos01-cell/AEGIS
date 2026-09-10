import { riskColor } from '../utils/risk'

export default function RiskScoreBar({ score, level }) {
  const color = riskColor(level)
  const pct = Math.min(100, Math.max(0, score))

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-2xl font-bold" style={{ color }}>{Math.round(pct)}</span>
        <span className="text-xs text-cyber-muted font-mono">/ 100</span>
      </div>
      <div className="h-2 bg-cyber-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

