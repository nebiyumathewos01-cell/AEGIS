import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight } from 'lucide-react'
import { useAlerts } from '../hooks/useAlerts'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { formatAlertType } from '../utils/risk'
import { fmtDate } from '../utils/format'

export default function Investigations() {
  const navigate = useNavigate()
  const { data, loading } = useAlerts({ status: 'investigating', limit: 50 })

  return (
    <div className="p-6">
      <PageHeader
        title="Investigations"
        subtitle="Alerts currently under active investigation"
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No active investigations"
          message="Set an alert status to 'Investigating' to track it here."
          action={
            <button className="btn-secondary text-sm" onClick={() => navigate('/alerts')}>
              View All Alerts
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.items.map(a => (
            <div
              key={a.id}
              className="card hover:border-cyber-accent/50 cursor-pointer transition-colors flex items-center gap-4"
              onClick={() => navigate(`/alerts/${a.id}`)}
            >
              <BookOpen className="w-5 h-5 text-cyber-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-cyber-text">{formatAlertType(a.alert_type)}</span>
                  <RiskBadge level={a.risk_level} />
                </div>
                <p className="text-xs text-cyber-muted mt-0.5">
                  {a.source_ip ? `From ${a.source_ip} · ` : ''}
                  {fmtDate(a.created_at)}
                </p>
              </div>
              <StatusBadge status={a.status} />
              <ChevronRight className="w-4 h-4 text-cyber-muted shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
