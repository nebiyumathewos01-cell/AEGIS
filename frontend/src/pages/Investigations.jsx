import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, AlertTriangle, CheckCircle, XCircle, Bot, RefreshCw } from 'lucide-react'
import { useAlerts } from '../hooks/useAlerts'
import { getPendingApprovals, approveAgentAction, rejectAgentAction } from '../services/api'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { formatAlertType } from '../utils/risk'
import { fmtDate } from '../utils/format'

export default function Investigations() {
  const navigate = useNavigate()
  const { data, loading, refresh: refreshAlerts } = useAlerts({ status: 'investigating', limit: 50 })
  const [approvals, setApprovals] = useState([])
  const [loadingApprovals, setLoadingApprovals] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  async function loadApprovals() {
    setLoadingApprovals(true)
    try {
      const res = await getPendingApprovals()
      setApprovals(res.actions || [])
    } catch {
      // Gracefully handle if no agent sessions yet
    } finally {
      setLoadingApprovals(false)
    }
  }

  useEffect(() => {
    loadApprovals()
  }, [])

  async function handleApprove(actionId) {
    setActionLoading(true)
    try {
      await approveAgentAction(actionId, '')
      await loadApprovals()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(actionId) {
    const note = window.prompt('Enter reason for rejecting this action:')
    if (!note || !note.trim()) return
    setActionLoading(true)
    try {
      await rejectAgentAction(actionId, note.trim())
      await loadApprovals()
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <PageHeader
          title="Investigations"
          subtitle="Alerts and actions under active SOC investigation"
        />
        <button
          onClick={() => { refreshAlerts(); loadApprovals() }}
          className="btn-ghost p-2"
          title="Refresh investigations"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Pending Approvals Callout Banner */}
      {approvals.length > 0 && (
        <div
          className="rounded-lg p-4 mb-6"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderLeft: '4px solid #f59e0b',
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" style={{ color: '#f59e0b' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  Human Approval Gate: {approvals.length} {approvals.length === 1 ? 'Action' : 'Actions'} Pending Approval
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  The Agentic SOC Assistant proposed state-changing actions. Human authorization is strictly required before execution.
                </p>
              </div>
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded font-mono font-bold animate-pulse"
              style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}
            >
              Action Required
            </span>
          </div>

          <div className="space-y-2">
            {approvals.map(action => (
              <div
                key={action.id}
                className="flex items-center justify-between gap-3 p-3 rounded text-xs"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>
                      {action.action_label}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                      style={{
                        background: action.risk_level === 'high' ? 'rgba(255,34,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: action.risk_level === 'high' ? '#ff2244' : '#f59e0b',
                      }}
                    >
                      {action.risk_level} risk
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                    {action.reasoning}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(action.id)}
                    disabled={actionLoading}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded font-medium transition-all"
                    style={{
                      background: 'rgba(0,212,170,0.15)',
                      color: '#00d4aa',
                      border: '1px solid rgba(0,212,170,0.4)',
                    }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(action.id)}
                    disabled={actionLoading}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded font-medium transition-all"
                    style={{
                      background: 'rgba(255,34,68,0.12)',
                      color: '#ff2244',
                      border: '1px solid rgba(255,34,68,0.3)',
                    }}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => navigate(`/agent/${action.session_id}`)}
                    className="btn-ghost p-1.5"
                    title="View Agent Session"
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Investigations List */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
          Active Alert Investigations ({data.total})
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No active investigations"
          message="Set an alert status to 'Investigating' or trigger an Agent Investigation to track it here."
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
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/agent/${a.id}`) }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-semibold transition-all mr-2"
                style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}
              >
                <Bot className="w-3.5 h-3.5" /> Agent
              </button>
              <StatusBadge status={a.status} />
              <ChevronRight className="w-4 h-4 text-cyber-muted shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


