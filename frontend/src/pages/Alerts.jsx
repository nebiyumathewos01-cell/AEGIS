import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, RefreshCw, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAlerts } from '../hooks/useAlerts'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { formatAlertType } from '../utils/risk'
import { fmtDate } from '../utils/format'

const RISK_LEVELS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const STATUSES    = ['', 'new', 'investigating', 'confirmed', 'false_positive', 'resolved']

export default function Alerts() {
  const navigate = useNavigate()
  const [search, setSearch]       = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [status, setStatus]       = useState('')
  const [page, setPage]           = useState(0)
  const limit = 20

  const { data, loading, refresh } = useAlerts({
    search: search || undefined,
    risk_level: riskLevel || undefined,
    status: status || undefined,
    skip: page * limit,
    limit,
  })

  const totalPages = Math.ceil(data.total / limit)
  const hasFilters = search || riskLevel || status

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-cyber-text">Alerts</h1>
          <p className="text-sm text-cyber-muted mt-0.5">{data.total} total alerts in your workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-ghost p-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/alerts/new')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            New Alert
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyber-muted" />
          <input
            className="input pl-8 py-2"
            placeholder="Search by type, IP, or content..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-cyber-muted" />
          <select className="input w-36 py-2" value={riskLevel}
            onChange={e => { setRiskLevel(e.target.value); setPage(0) }}>
            {RISK_LEVELS.map(l => <option key={l} value={l}>{l || 'All Risks'}</option>)}
          </select>
          <select className="input w-44 py-2" value={status}
            onChange={e => { setStatus(e.target.value); setPage(0) }}>
            {STATUSES.map(s => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All Statuses'}</option>)}
          </select>
          {hasFilters && (
            <button className="btn-ghost text-sm px-3 py-2"
              onClick={() => { setSearch(''); setRiskLevel(''); setStatus(''); setPage(0) }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No alerts found"
              message={hasFilters ? "Try adjusting your filters." : "Submit your first security alert to get started."}
              action={
                !hasFilters && (
                  <button className="btn-primary text-sm" onClick={() => navigate('/alerts/new')}>
                    Submit Alert
                  </button>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyber-border bg-cyber-bg/50">
                    {['#', 'Time', 'Source', 'Alert Type', 'Source IP', 'Score', 'Risk', 'Status'].map(h => (
                      <th key={h} className="text-left text-xs text-cyber-muted font-semibold
                                             uppercase tracking-wide py-3 px-4 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-border/30">
                  {data.items.map(a => (
                    <tr key={a.id} onClick={() => navigate(`/alerts/${a.id}`)}
                      className="hover:bg-cyber-border/10 cursor-pointer transition-colors group">
                      <td className="py-3.5 px-4 font-mono text-xs text-cyber-muted group-hover:text-cyber-accent transition-colors">
                        #{a.id}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-cyber-muted whitespace-nowrap">{fmtDate(a.created_at)}</td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs uppercase font-mono bg-cyber-bg border border-cyber-border px-2 py-0.5 rounded text-cyber-muted">
                          {a.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-cyber-text font-medium">{formatAlertType(a.alert_type)}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-cyber-accent">{a.source_ip ?? '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-cyber-text">{Math.round(a.risk_score)}</td>
                      <td className="py-3.5 px-4"><RiskBadge level={a.risk_level} /></td>
                      <td className="py-3.5 px-4"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-cyber-border bg-cyber-bg/30">
                <span className="text-xs text-cyber-muted">
                  Page {page + 1} of {totalPages} · {data.total} alerts
                </span>
                <div className="flex gap-1">
                  <button className="btn-ghost p-1.5" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="btn-ghost p-1.5" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

