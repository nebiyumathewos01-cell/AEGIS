import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
  AlertTriangle, Shield, ShieldAlert, Activity, Clock, RefreshCw
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useAlerts } from '../hooks/useAlerts'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { riskColor, formatAlertType } from '../utils/risk'
import { fmtRelative } from '../utils/format'

const STAT_CARDS = (s) => [
  { label: 'Total Alerts',    value: s.total_alerts,    icon: Shield,      color: 'text-cyber-accent' },
  { label: 'Critical',        value: s.critical_alerts, icon: ShieldAlert, color: 'text-risk-critical' },
  { label: 'High',            value: s.high_alerts,     icon: AlertTriangle, color: 'text-risk-high' },
  { label: 'Investigating',   value: s.investigating_alerts, icon: Activity, color: 'text-risk-medium' },
  { label: 'New (Unread)',    value: s.new_alerts,      icon: Clock,       color: 'text-cyber-accent' },
]

export default function Dashboard() {
  const { stats, loading: sLoading } = useDashboard()
  const { data: alertData, loading: aLoading, refresh } = useAlerts({ limit: 10 })
  const navigate = useNavigate()

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

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        subtitle="AEGIS · Security operations overview"
        actions={
          <button onClick={refresh} className="btn-ghost flex items-center gap-1.5 text-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {STAT_CARDS(stats).map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color} shrink-0`} />
              <div>
                <p className="text-2xl font-bold text-cyber-text">{value}</p>
                <p className="text-xs text-cyber-muted">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk distribution chart */}
        <div className="card lg:col-span-1">
          <p className="section-title">Risk Distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={distData} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}
                labelStyle={{ color: '#e6edf3' }}
                itemStyle={{ color: '#8b949e' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {distData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top alert types */}
        {stats?.top_alert_types?.length > 0 && (
          <div className="card lg:col-span-1">
            <p className="section-title">Top Alert Types</p>
            <div className="space-y-2 mt-1">
              {stats.top_alert_types.map(({ alert_type, count }) => {
                const max = stats.top_alert_types[0].count
                const pct = Math.round((count / max) * 100)
                return (
                  <div key={alert_type}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-cyber-text truncate max-w-[160px]">{formatAlertType(alert_type)}</span>
                      <span className="text-cyber-muted ml-2">{count}</span>
                    </div>
                    <div className="h-1.5 bg-cyber-border rounded-full overflow-hidden">
                      <div className="h-full bg-cyber-accent rounded-full" style={{ width: `${pct}%` }} />
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
            <p className="section-title">Top Source IPs</p>
            <div className="space-y-2">
              {stats.top_source_ips.map(({ source_ip, count }) => (
                <div key={source_ip} className="flex items-center justify-between">
                  <span
                    className="text-sm font-mono text-cyber-accent cursor-pointer hover:underline"
                    onClick={() => navigate(`/alerts?source_ip=${source_ip}`)}
                  >
                    {source_ip}
                  </span>
                  <span className="text-xs text-cyber-muted bg-cyber-border px-2 py-0.5 rounded-full">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent alerts table */}
      <div className="card mt-6">
        <p className="section-title">Recent Alerts</p>
        {aLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : alertData.items.length === 0 ? (
          <p className="text-sm text-cyber-muted text-center py-8">No alerts yet. Submit an alert to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyber-border">
                  {['Time', 'Source', 'Type', 'Source IP', 'Risk', 'Status'].map(h => (
                    <th key={h} className="text-left text-xs text-cyber-muted font-medium pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertData.items.map(a => (
                  <tr
                    key={a.id}
                    className="border-b border-cyber-border/50 hover:bg-cyber-border/20 cursor-pointer transition-colors"
                    onClick={() => navigate(`/alerts/${a.id}`)}
                  >
                    <td className="py-2.5 pr-4 text-cyber-muted font-mono text-xs whitespace-nowrap">{fmtRelative(a.created_at)}</td>
                    <td className="py-2.5 pr-4 text-cyber-muted uppercase text-xs">{a.source}</td>
                    <td className="py-2.5 pr-4 text-cyber-text">{formatAlertType(a.alert_type)}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-cyber-accent">{a.source_ip ?? '—'}</td>
                    <td className="py-2.5 pr-4"><RiskBadge level={a.risk_level} /></td>
                    <td className="py-2.5"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {alertData.total > 10 && (
          <button
            className="mt-3 text-xs text-cyber-accent hover:underline"
            onClick={() => navigate('/alerts')}
          >
            View all {alertData.total} alerts →
          </button>
        )}
      </div>
    </div>
  )
}
