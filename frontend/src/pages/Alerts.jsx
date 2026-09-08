import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Plus, RefreshCw } from 'lucide-react'
import { useAlerts } from '../hooks/useAlerts'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { formatAlertType } from '../utils/risk'
import { fmtDate } from '../utils/format'

const RISK_LEVELS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const STATUSES    = ['', 'new', 'investigating', 'confirmed', 'false_positive', 'resolved']

export default function Alerts() {
  const navigate = useNavigate()
  const [search, setSearch]         = useState('')
  const [riskLevel, setRiskLevel]   = useState('')
  const [status, setStatus]         = useState('')
  const [page, setPage]             = useState(0)
  const limit = 20

  const { data, loading, refresh } = useAlerts({
    search: search || undefined,
    risk_level: riskLevel || undefined,
    status: status || undefined,
    skip: page * limit,
    limit,
  })

  const totalPages = Math.ceil(data.total / limit)

  return (
    <div className="p-6">
      <PageHeader
        title="Alerts"
        subtitle={`${data.total} total alerts`}
        actions={
          <>
            <button onClick={refresh} className="btn-ghost flex items-center gap-1.5 text-sm">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => navigate('/alerts/new')} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> New Alert
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyber-muted" />
          <input
            className="input pl-8"
            placeholder="Search alerts…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
        </div>

        <select
          className="input w-36"
          value={riskLevel}
          onChange={e => { setRiskLevel(e.target.value); setPage(0) }}
        >
          {RISK_LEVELS.map(l => (
            <option key={l} value={l}>{l || 'All Risks'}</option>
          ))}
        </select>

        <select
          className="input w-40"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(0) }}
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>

        {(search || riskLevel || status) && (
          <button
            className="btn-ghost text-sm"
            onClick={() => { setSearch(''); setRiskLevel(''); setStatus(''); setPage(0) }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : data.items.length === 0 ? (
          <EmptyState
            title="No alerts found"
            message="Try adjusting your filters, or submit a new alert."
            action={
              <button className="btn-primary text-sm" onClick={() => navigate('/alerts/new')}>
                Submit Alert
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyber-border">
                    {['ID', 'Time', 'Source', 'Type', 'Source IP', 'Risk Score', 'Level', 'Status'].map(h => (
                      <th key={h} className="text-left text-xs text-cyber-muted font-medium pb-2.5 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(a => (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/alerts/${a.id}`)}
                      className="border-b border-cyber-border/40 hover:bg-cyber-border/20 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-cyber-muted">#{a.id}</td>
                      <td className="py-3 pr-4 text-xs text-cyber-muted whitespace-nowrap">{fmtDate(a.created_at)}</td>
                      <td className="py-3 pr-4 text-xs uppercase text-cyber-muted">{a.source}</td>
                      <td className="py-3 pr-4 text-cyber-text font-medium">{formatAlertType(a.alert_type)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-cyber-accent">{a.source_ip ?? '—'}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-cyber-text">{Math.round(a.risk_score)}</td>
                      <td className="py-3 pr-4"><RiskBadge level={a.risk_level} /></td>
                      <td className="py-3"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-cyber-border">
                <span className="text-xs text-cyber-muted">
                  Page {page + 1} of {totalPages} · {data.total} total
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary text-xs px-3 py-1"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn-secondary text-xs px-3 py-1"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
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
