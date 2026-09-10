import { riskBadgeClass } from '../utils/risk'

export default function RiskBadge({ level }) {
  if (!level) return null
  return (
    <span className={riskBadgeClass(level)}>
      {level}
    </span>
  )
}

