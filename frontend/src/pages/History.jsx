import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History, ChevronRight, Shield, AlertTriangle,
  ShieldAlert, Activity, Clock, RefreshCw,
  Calendar, TrendingUp, CheckCircle, Search
} from 'lucide-react'
import { getAlerts } from '../services/api'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { formatAlertType, riskColor } from '../utils/risk'
import { fmtDate, fmtTime, fmtRelative } from '../utils/format'
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns'

// ── Group alerts by date label ────────────────────────────────────────────────
function groupByDate(alerts) {
  const groups = {}
  alerts.forEach(a => {
    const date = parseISO(a.created_at)
    let label
    if (isToday(date))           label = 'Today'
    else if (isYesterday(date))  label = 'Yesterday'
    else if (isThisWeek(date))   label = 'This Week'
    else if (isThisMonth(date))  label = 'This Month'
    else                         label = format(date, 'MMMM yyyy')
    if (!groups[label]) groups[label] = []
    groups[label].push(a)
  })
  return groups
}

// ── Risk mini bar ─────────────────────────────────────────────────────────────
function RiskBar({ score, level }) {
  const color = riskColor(level)
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-cyber-border rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{Math.round(score)}</span>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <div className="p-2 bg-cyber-bg border border-cyber-border rounded-lg shrink-0">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-cyber-text">{value}</p>
        <p className="text-xs text-cyber-muted">{label}</p>
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const navigate  = useNavigate()
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await getAlerts({ limit: 200, skip: 0 })
      setAlerts(res.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Filter
  const filtered = alerts.filter(a => {
    const matchSearch = !search ||
      a.alert_type.toLowerCase().includes(search.toLowerCase()) ||
      (a.source_ip || '').includes(search)
    const matchFilter = !filter || a.risk_level === filter
    return matchSearch && matchFilter
  })

  const groups = groupByDate(filtered)

  // Stats
  const total    = alerts.length
  const critical = alerts.filter(a => a.risk_level === 'CRITICAL').length
  const resolved = alerts.filter(a => a.status === 'resolved').length
  const avgScore = total > 0
    ? Math.round(alerts.reduce((s, a) => s + a.risk_score, 0) / total)
    : 0

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-cyber-text flex items-center gap-2">
            <History className="w-5 h-5 text-cyber-accent" />
            Investigation History
          </h1>
          <p className="text-sm text-cyber-muted mt-0.5">
            Complete log of all alerts you have analyzed
          </p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-1.5 text-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Shield}       label="Total Analyzed"  value={total}    color="text-cyber-accent" />
        <StatCard icon={ShieldAlert}  label="Critical Alerts" value={critical}  color="text-risk-critical" />
        <StatCard icon={CheckCircle}  label="Resolved"        value={resolved}  color="text-risk-low" />
        <StatCard icon={TrendingUp}   label="Avg Risk Score"  value={avgScore}  color="text-risk-medium" />
      </div>

      {/* Filters */}
      <div className="card py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyber-muted" />
          <input
            className="input pl-8 py-2 text-sm"
            placeholder="Search by type or IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(l => (
            <button
              key={l}
              onClick={() => setFilter(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                filter === l
                  ? 'bg-cyber-accent/10 text-cyber-accent border-cyber-accent/30'
                  : 'text-cyber-muted border-cyber-border hover:text-cyber-text'
              }`}
            >
              {l || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <History className="w-10 h-10 text-cyber-muted mx-auto mb-3" />
          <p className="text-cyber-text font-medium">No history yet</p>
          <p className="text-sm text-cyber-muted mt-1">
            Alerts you analyze will appear here
          </p>
          <button className="btn-primary text-sm mt-4" onClick={() => navigate('/alerts/new')}>
            Analyze your first alert
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyber-muted" />
                  <span className="text-sm font-semibold text-cyber-muted">{label}</span>
                </div>
                <div className="flex-1 h-px bg-cyber-border" />
                <span className="text-xs text-cyber-muted">{items.length} alert{items.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Alert cards */}
              <div className="space-y-2">
                {items.map(a => (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/alerts/${a.id}`)}
                    className="card py-3 flex items-center gap-4 cursor-pointer
                               hover:border-cyber-accent/30 transition-all group"
                  >
                    {/* Risk color strip */}
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: riskColor(a.risk_level) }}
                    />

                    {/* Time */}
                    <div className="w-16 shrink-0 text-right">
                      <p className="text-xs font-mono text-cyber-muted">{fmtTime(a.created_at)}</p>
                    </div>

                    {/* Source badge */}
                    <span className="text-[10px] font-mono uppercase text-cyber-muted
                                     bg-cyber-bg border border-cyber-border px-1.5 py-0.5 rounded shrink-0">
                      {a.source}
                    </span>

                    {/* Alert type */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-cyber-text truncate">
                        {formatAlertType(a.alert_type)}
                      </p>
                      {a.source_ip && (
                        <p className="text-xs font-mono text-cyber-accent mt-0.5">{a.source_ip}</p>
                      )}
                    </div>

                    {/* Risk bar */}
                    <div className="hidden sm:block w-28 shrink-0">
                      <RiskBar score={a.risk_score} level={a.risk_level} />
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      <RiskBadge level={a.risk_level} />
                      <StatusBadge status={a.status} />
                    </div>

                    <ChevronRight className="w-4 h-4 text-cyber-muted group-hover:text-cyber-accent
                                             transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

