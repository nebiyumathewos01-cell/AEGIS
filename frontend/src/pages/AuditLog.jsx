import { useState, useEffect } from 'react'
import {
  LogIn, LogOut, Shield, AlertTriangle, FileText,
  UserPlus, RefreshCw, Activity, Clock, ChevronLeft,
  ChevronRight, User, Search, Filter
} from 'lucide-react'
import { getAuditLogs, getAuditSummary } from '../services/api'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { fmtDate, fmtRelative } from '../utils/format'

const ACTION_META = {
  LOGIN_SUCCESS:   { icon: LogIn,        color: 'text-risk-low',      bg: 'bg-green-950/40 border-green-800/40' },
  LOGIN_FAILED:    { icon: AlertTriangle, color: 'text-risk-high',    bg: 'bg-red-950/40 border-red-800/40' },
  LOGOUT:          { icon: LogOut,       color: 'text-cyber-muted',   bg: 'bg-cyber-bg border-cyber-border' },
  REGISTER:        { icon: UserPlus,     color: 'text-cyber-accent',  bg: 'bg-blue-950/40 border-blue-800/40' },
  ALERT_CREATED:   { icon: Shield,       color: 'text-cyber-accent',  bg: 'bg-blue-950/30 border-blue-800/30' },
  ALERT_ANALYZED:  { icon: Activity,     color: 'text-risk-medium',   bg: 'bg-yellow-950/30 border-yellow-800/30' },
  STATUS_CHANGED:  { icon: RefreshCw,    color: 'text-cyber-muted',   bg: 'bg-cyber-bg border-cyber-border' },
  NOTE_ADDED:      { icon: FileText,     color: 'text-cyber-muted',   bg: 'bg-cyber-bg border-cyber-border' },
  REPORT_EXPORTED: { icon: FileText,     color: 'text-cyber-accent',  bg: 'bg-blue-950/30 border-blue-800/30' },
  DEMO_LOADED:     { icon: Shield,       color: 'text-cyber-accent',  bg: 'bg-blue-950/30 border-blue-800/30' },
  TI_LOOKUP:       { icon: Search,       color: 'text-cyber-muted',   bg: 'bg-cyber-bg border-cyber-border' },
}

function ActionBadge({ action, label }) {
  const meta = ACTION_META[action] ?? { icon: Activity, color: 'text-cyber-muted', bg: 'bg-cyber-bg border-cyber-border' }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${meta.bg} ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className="p-2.5 bg-cyber-bg rounded-lg border border-cyber-border">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-cyber-text">{value}</p>
        <p className="text-xs text-cyber-muted">{label}</p>
      </div>
    </div>
  )
}

const ACTIONS = ['', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER',
                 'ALERT_CREATED', 'ALERT_ANALYZED', 'STATUS_CHANGED',
                 'NOTE_ADDED', 'REPORT_EXPORTED', 'DEMO_LOADED', 'TI_LOOKUP']

export default function AuditLog() {
  const [logs, setLogs]         = useState({ total: 0, items: [] })
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(0)
  const [action, setAction]     = useState('')
  const limit = 25

  async function load() {
    setLoading(true)
    try {
      const [logsRes, sumRes] = await Promise.all([
        getAuditLogs({ skip: page * limit, limit, action: action || undefined }),
        getAuditSummary(),
      ])
      setLogs(logsRes)
      setSummary(sumRes)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, action])

  const totalPages = Math.ceil(logs.total / limit)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Access Control & Audit Log"
        subtitle="Track all authentication events and analyst activity in your workspace"
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-1.5 text-sm">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Activity} label="Total Actions"      value={summary.total_actions}       color="text-cyber-accent" />
          <SummaryCard icon={LogIn}    label="Successful Logins"  value={summary.login_count}         color="text-risk-low" />
          <SummaryCard icon={AlertTriangle} label="Failed Logins" value={summary.failed_login_count}  color="text-risk-high" />
          <SummaryCard icon={Shield}   label="Alerts Created"     value={summary.alerts_created}      color="text-cyber-accent" />
        </div>
      )}

      {/* Last login info */}
      {summary?.last_login && (
        <div className="card flex items-center gap-4 py-3 bg-cyber-bg">
          <Clock className="w-4 h-4 text-cyber-muted shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-cyber-text font-medium">Last Sign-In</p>
            <p className="text-xs text-cyber-muted mt-0.5">
              {fmtDate(summary.last_login)}
              {summary.last_login_ip && (
                <span className="ml-3 font-mono text-cyber-accent">{summary.last_login_ip}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card py-3 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-cyber-muted shrink-0" />
        <select className="input w-52 py-2" value={action}
          onChange={e => { setAction(e.target.value); setPage(0) }}>
          {ACTIONS.map(a => (
            <option key={a} value={a}>
              {a ? ACTION_META[a] ? a.replace('_', ' ') : a : 'All Actions'}
            </option>
          ))}
        </select>
        {action && (
          <button className="btn-ghost text-sm" onClick={() => { setAction(''); setPage(0) }}>
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-cyber-muted">{logs.total} events</span>
      </div>

      {/* Log table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : logs.items.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-8 h-8 text-cyber-muted mx-auto mb-2" />
            <p className="text-sm text-cyber-muted">No audit events found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyber-border bg-cyber-bg/50">
                    {['Time', 'User', 'Action', 'Detail', 'IP Address'].map(h => (
                      <th key={h} className="text-left text-xs text-cyber-muted font-semibold
                                             uppercase tracking-wide py-3 px-4 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-border/30">
                  {logs.items.map(log => (
                    <tr key={log.id} className="hover:bg-cyber-border/10 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="text-xs text-cyber-text font-mono">{fmtDate(log.created_at)}</p>
                        <p className="text-[10px] text-cyber-muted mt-0.5">{fmtRelative(log.created_at)}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        {log.username ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-cyber-accent/20 border border-cyber-accent/30
                                            flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-cyber-accent">
                                {(log.full_name || log.username || '?')[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-cyber-text">{log.full_name}</p>
                              <p className="text-[10px] text-cyber-muted font-mono">@{log.username}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-cyber-muted italic">System</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <ActionBadge action={log.action} label={log.action_label} />
                      </td>
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <p className="text-xs text-cyber-muted truncate">{log.detail || '—'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-mono text-cyber-muted">
                          {log.ip_address || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-cyber-border bg-cyber-bg/30">
                <span className="text-xs text-cyber-muted">
                  Page {page + 1} of {totalPages} · {logs.total} events
                </span>
                <div className="flex gap-1">
                  <button className="btn-ghost p-1.5" disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="btn-ghost p-1.5" disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}>
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

