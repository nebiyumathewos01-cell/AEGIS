import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import {
  ShieldAlert, Shield, Activity, Clock,
  AlertTriangle, TrendingUp, RefreshCw, ChevronRight
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useAlerts } from '../hooks/useAlerts'
import { useAuth } from '../context/AuthContext'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { riskColor, formatAlertType } from '../utils/risk'
import { fmtRelative } from '../utils/format'

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="card flex items-start gap-4 hover:border-cyber-border transition-colors">
      <div className={`p-2.5 rounded-lg bg-cyber-bg border border-cyber-border shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-cyber-text">{value}</p>
        <p className="text-xs text-cyber-muted mt-0.5">{label}</p>
        {sub && <p className="text-xs text-cyber-muted/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-xs">
      <p className="text-cyber-muted mb-1">{label}</p>
      <p className="font-semibold text-cyber-text">{payload[0].value} alerts</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate           = useNavigate()
  const { user }           = useAuth()
  const { stats, loading: sLoading } = useDashboard()
  const { data: alertData, loading: aLoading, refresh } = useAlerts({ limit: 8 })

  if (sLoading) return (
    <div className="flex items-center justify-center h-full">
      <Spinner size="lg" />
    </div>
  )

  const distData = stats ? [
    { name: 'LOW',      value: stats.risk_distribution.LOW,      color: riskColor('LOW') },
    { name: 'MEDIUM',   value: stats.risk_distribution.MEDIUM,   color: riskColor('MEDIUM') },
    { name: 'HIGH',     value: stats.risk_distribution.HIGH,     color: riskColor('HIGH') },
    { name: 'CRITICAL', value: stats.risk_distribution.CRITICAL, color: riskColor('CRITICAL') },
  ] : []

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-cyber-text">
            {greeting}, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-cyber-muted mt-0.5">
            Security operations overview · AEGIS
          </p>
        </div>
        <button
          onClick={refresh}
          className="btn-ghost flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <StatCard label="Total Alerts"   value={stats.total_alerts}        icon={Shield}      color="text-cyber-accent" />
          <StatCard label="Critical"       value={stats.critical_alerts}     icon={ShieldAlert} color="text-risk-critical" />
          <StatCard label="High Risk"      value={stats.high_alerts}         icon={AlertTriangle} color="text-risk-high" />
          <StatCard label="Investigating"  value={stats.investigating_alerts} icon={Activity}   color="text-risk-medium" />
          <StatCard label="New Alerts"     value={stats.new_alerts}          icon={Clock}       color="text-cyber-accent"
            sub="Awaiting triage" />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Bar chart */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-cyber-text">Risk Distribution</p>
            <TrendingUp className="w-4 h-4 text-cyber-muted" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={distData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {distData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top alert types */}
        {stats?.top_alert_types?.length > 0 && (
          <div className="card lg:col-span-1">
            <p className="text-sm font-semibold text-cyber-text mb-4">Top Alert Types</p>
            <div className="space-y-3">
              {stats.top_alert_types.map(({ alert_type, count }) => {
                const max = stats.top_alert_types[0].count
                const pct = Math.round((count / max) * 100)
                return (
                  <div key={alert_type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-cyber-text truncate max-w-[150px]">
                        {formatAlertType(alert_type)}
                      </span>
                      <span className="text-cyber-muted ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-cyber-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyber-accent rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top source IPs */}
        {stats?.top_source_ips?.length > 0 && (
          <div className="card lg:col-span-1">
            <p className="text-sm font-semibold text-cyber-text mb-4">Top Source IPs</p>
            <div className="space-y-2.5">
              {stats.top_source_ips.map(({ source_ip, count }, i) => (
                <div
                  key={source_ip}
                  className="flex items-center justify-between cursor-pointer hover:bg-cyber-border/20 rounded px-1 py-0.5 transition-colors"
                  onClick={() => navigate(`/alerts?source_ip=${source_ip}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-cyber-muted w-4">{i + 1}</span>
                    <span className="text-sm font-mono text-cyber-accent">{source_ip}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cyber-muted bg-cyber-border px-2 py-0.5 rounded-full">
                      {count}
                    </span>
                    <ChevronRight className="w-3 h-3 text-cyber-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent alerts */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-cyber-text">Recent Alerts</p>
          <button
            className="text-xs text-cyber-accent hover:underline"
            onClick={() => navigate('/alerts')}
          >
            View all
          </button>
        </div>

        {aLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : alertData.items.length === 0 ? (
          <div className="text-center py-10">
            <Shield className="w-8 h-8 text-cyber-muted mx-auto mb-2" />
            <p className="text-sm text-cyber-muted">No alerts yet.</p>
            <button
              className="btn-primary text-sm mt-3"
              onClick={() => navigate('/alerts/new')}
            >
              Submit your first alert
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyber-border">
                  {['Time', 'Source', 'Type', 'IP', 'Risk', 'Status'].map(h => (
                    <th key={h} className="text-left text-xs text-cyber-muted font-medium pb-2.5 pr-4 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertData.items.map(a => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/alerts/${a.id}`)}
                    className="border-b border-cyber-border/30 hover:bg-cyber-border/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4 text-xs text-cyber-muted whitespace-nowrap font-mono">
                      {fmtRelative(a.created_at)}
                    </td>
                    <td className="py-3 pr-4 text-xs text-cyber-muted uppercase">{a.source}</td>
                    <td className="py-3 pr-4 text-cyber-text font-medium">{formatAlertType(a.alert_type)}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-cyber-accent">{a.source_ip ?? '—'}</td>
                    <td className="py-3 pr-4"><RiskBadge level={a.risk_level} /></td>
                    <td className="py-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
