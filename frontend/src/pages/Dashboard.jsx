import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ShieldAlert, Shield, Activity, Clock, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useAlerts } from '../hooks/useAlerts'
import { useAuth } from '../context/AuthContext'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { riskColor, formatAlertType } from '../utils/risk'
import { fmtRelative } from '../utils/format'

const RISK_RGB = {
  LOW:      '#00d4aa',
  MEDIUM:   '#f59e0b',
  HIGH:     '#ff6b35',
  CRITICAL: '#ff2244',
}

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="panel-accent flex items-start gap-3">
      <div className="p-2 rounded shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-black" style={{ color: 'var(--text)' }}>{value}</p>
        <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.6 }}>{sub}</p>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 rounded text-xs"
      style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
      <p style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="font-bold mt-0.5" style={{ color: 'var(--accent)' }}>{payload[0].value} alerts</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { stats, loading: sLoading } = useDashboard()
  const { data: alertData, loading: aLoading, refresh } = useAlerts({ limit: 10 })

  if (sLoading) return (
    <div className="flex items-center justify-center h-full">
      <Spinner size="lg" />
    </div>
  )

  const distData = stats ? [
    { name: 'LOW',      value: stats.risk_distribution.LOW,      color: RISK_RGB.LOW },
    { name: 'MEDIUM',   value: stats.risk_distribution.MEDIUM,   color: RISK_RGB.MEDIUM },
    { name: 'HIGH',     value: stats.risk_distribution.HIGH,     color: RISK_RGB.HIGH },
    { name: 'CRITICAL', value: stats.risk_distribution.CRITICAL, color: RISK_RGB.CRITICAL },
  ] : []

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between pb-4"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 rounded" style={{ background: 'var(--accent)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {greeting}, {user?.full_name?.split(' ')[0]}
            </h1>
          </div>
          <p className="text-xs font-mono ml-3" style={{ color: 'var(--muted)' }}>
            Security Operations Dashboard · AEGIS v2.1
          </p>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatCard label="Total Alerts"  value={stats.total_alerts}        icon={Shield}      color="var(--teal)" />
          <StatCard label="Critical"      value={stats.critical_alerts}     icon={ShieldAlert} color={RISK_RGB.CRITICAL} />
          <StatCard label="High Risk"     value={stats.high_alerts}         icon={AlertTriangle} color={RISK_RGB.HIGH} />
          <StatCard label="Investigating" value={stats.investigating_alerts} icon={Activity}   color={RISK_RGB.MEDIUM} />
          <StatCard label="New Alerts"    value={stats.new_alerts}          icon={Clock}       color="var(--accent)" sub="Awaiting triage" />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Risk distribution */}
        <div className="panel">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">Risk Distribution</p>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={distData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} width={20} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {distData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.9} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top types */}
        {stats?.top_alert_types?.length > 0 && (
          <div className="panel">
            <p className="section-title">Top Alert Types</p>
            <div className="space-y-2.5">
              {stats.top_alert_types.map(({ alert_type, count }) => {
                const max = stats.top_alert_types[0].count
                const pct = Math.round((count / max) * 100)
                return (
                  <div key={alert_type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="truncate max-w-[140px]" style={{ color: 'var(--text)' }}>
                        {formatAlertType(alert_type)}
                      </span>
                      <span className="ml-2 font-mono font-bold" style={{ color: 'var(--accent)' }}>{count}</span>
                    </div>
                    <div className="h-1" style={{ background: 'var(--border)', borderRadius: 2 }}>
                      <div className="h-full" style={{ width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top IPs */}
        {stats?.top_source_ips?.length > 0 && (
          <div className="panel">
            <p className="section-title">Top Source IPs</p>
            <div className="space-y-2">
              {stats.top_source_ips.map(({ source_ip, count }, i) => (
                <div key={source_ip}
                  className="flex items-center justify-between cursor-pointer px-2 py-1.5 rounded transition-all"
                  style={{ borderRadius: 3 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => navigate(`/alerts?source_ip=${source_ip}`)}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono w-4" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: 'var(--teal)' }}>{source_ip}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent alerts table */}
      <div className="panel p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <p className="section-title mb-0">Recent Alerts</p>
          <button className="text-xs font-medium transition-colors"
            style={{ color: 'var(--accent)' }}
            onClick={() => navigate('/alerts')}>
            View all →
          </button>
        </div>

        {aLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : alertData.items.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No alerts yet.</p>
            <button className="btn-primary mt-3 text-xs" onClick={() => navigate('/alerts/new')}>
              Submit first alert
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['Time', 'Source', 'Alert Type', 'Source IP', 'Risk', 'Status'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertData.items.map(a => (
                <tr key={a.id} onClick={() => navigate(`/alerts/${a.id}`)}>
                  <td><span className="mono" style={{ color: 'var(--muted)' }}>{fmtRelative(a.created_at)}</span></td>
                  <td><span className="mono text-[10px] px-1.5 py-0.5 rounded uppercase"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    {a.source}
                  </span></td>
                  <td><span className="font-medium text-xs" style={{ color: 'var(--text)' }}>{formatAlertType(a.alert_type)}</span></td>
                  <td><span className="mono text-xs font-bold" style={{ color: 'var(--teal)' }}>{a.source_ip ?? '—'}</span></td>
                  <td><RiskBadge level={a.risk_level} /></td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
