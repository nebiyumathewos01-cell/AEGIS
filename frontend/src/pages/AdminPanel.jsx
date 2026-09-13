import { useState, useEffect } from 'react'
import {
  Shield, Users, CheckCircle, UserX,
  UserCheck, RefreshCw, Crown, Clock, AlertTriangle
} from 'lucide-react'
import {
  getAdminStats, getAdminUsers, suspendUser, unsuspendUser
} from '../services/api'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { fmtDate } from '../utils/format'

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ is_active }) {
  return is_active ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }}>
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: 'rgba(136,136,187,0.12)', color: '#8888bb', border: '1px solid rgba(136,136,187,0.3)' }}>
      Suspended
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="panel flex items-center gap-3 py-3">
      <div className="p-2 rounded shrink-0"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-black" style={{ color: 'var(--text)' }}>{value}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const [stats, setStats]   = useState(null)
  const [users, setUsers]   = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)
  const [msg, setMsg]         = useState({ text: '', type: 'success' })

  async function load() {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([getAdminStats(), getAdminUsers()])
      setStats(s)
      setUsers(u.users || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Filter locally
  const filtered = users.filter(u => {
    if (filter === 'active')    return u.is_active
    if (filter === 'suspended') return !u.is_active
    return true
  })

  async function handleSuspend(userId, currentlyActive) {
    setActing(true)
    setMsg({ text: '', type: 'success' })
    try {
      if (currentlyActive) {
        await suspendUser(userId)
        setMsg({ text: 'User suspended successfully.', type: 'success' })
      } else {
        await unsuspendUser(userId)
        setMsg({ text: 'User restored successfully.', type: 'success' })
      }
      await load()
    } catch (e) {
      setMsg({ text: e?.response?.data?.detail ?? 'Action failed', type: 'error' })
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Admin Panel"
        subtitle="Manage user accounts — see who joined, when, and their status"
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Message */}
      {msg.text && (
        <div className="px-4 py-2.5 rounded text-sm"
          style={msg.type === 'success'
            ? { background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.3)', color: '#00d4aa' }
            : { background: 'rgba(255,34,68,0.08)', border: '1px solid rgba(255,34,68,0.3)', color: '#ff2244' }}>
          {msg.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users}        label="Total Users"   value={stats.total_users}     color="var(--accent)" />
          <StatCard icon={CheckCircle}  label="Active"        value={stats.active_users}    color="#00d4aa" />
          <StatCard icon={UserX}        label="Suspended"     value={stats.suspended_users} color="#ff2244" />
          <StatCard icon={Shield}       label="Total Alerts"  value={stats.total_alerts}    color="var(--teal)" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="panel py-3 flex items-center gap-2 flex-wrap">
        {[
          { value: 'all',       label: `All Users (${users.length})` },
          { value: 'active',    label: `Active (${users.filter(u => u.is_active).length})` },
          { value: 'suspended', label: `Suspended (${users.filter(u => !u.is_active).length})` },
        ].map(({ value, label }) => (
          <button key={value} onClick={() => setFilter(value)}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={filter === value ? {
              background: 'rgba(255,107,53,0.12)',
              color: 'var(--accent)',
              border: '1px solid rgba(255,107,53,0.3)',
            } : {
              color: 'var(--muted)',
              border: '1px solid var(--border)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Users table */}
      <div className="panel p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--muted)' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  {['#', 'User', 'Email', 'Role', 'Status', 'Alerts', 'Joined (Exact)', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 whitespace-nowrap text-xs font-bold uppercase tracking-wide"
                      style={{ color: 'var(--muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr key={u.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    {/* # */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                        {idx + 1}
                      </span>
                    </td>

                    {/* User */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 text-xs font-black"
                          style={{
                            background: 'rgba(255,107,53,0.15)',
                            color: 'var(--accent)',
                            border: '1px solid rgba(255,107,53,0.3)',
                          }}>
                          {(u.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            {u.full_name}
                          </p>
                          <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                            @{u.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                        {u.email}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
                          style={{ background: 'rgba(255,107,53,0.12)', color: 'var(--accent)', border: '1px solid rgba(255,107,53,0.3)' }}>
                          <Crown className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="text-xs capitalize" style={{ color: 'var(--muted)' }}>
                          {u.role}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusPill is_active={u.is_active} />
                    </td>

                    {/* Alert count */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--teal)' }}>
                        {u.alert_count}
                      </span>
                    </td>

                    {/* Joined — exact date and time */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 shrink-0" style={{ color: 'var(--muted)' }} />
                        <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
                          {fmtDate(u.created_at)}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleSuspend(u.id, u.is_active)}
                          disabled={acting}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-40"
                          style={u.is_active ? {
                            background: 'rgba(255,34,68,0.08)',
                            color: '#ff2244',
                            border: '1px solid rgba(255,34,68,0.3)',
                          } : {
                            background: 'rgba(0,212,170,0.08)',
                            color: '#00d4aa',
                            border: '1px solid rgba(0,212,170,0.3)',
                          }}>
                          {u.is_active
                            ? <><UserX className="w-3.5 h-3.5" /> Suspend</>
                            : <><UserCheck className="w-3.5 h-3.5" /> Restore</>
                          }
                        </button>
                      )}
                      {u.role === 'admin' && (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confidentiality notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderLeft: '3px solid var(--teal)' }}>
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--teal)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>Confidentiality: </span>
          Admin sees only account metadata (name, email, join date, status).
          Alert content, raw logs, and analysis results are never accessible to administrators.
        </p>
      </div>
    </div>
  )
}
