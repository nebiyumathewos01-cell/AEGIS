import { useState, useEffect } from 'react'
import {
  Shield, Users, CheckCircle,
  UserX, UserCheck, RefreshCw,
  Crown
} from 'lucide-react'
import {
  getAdminStats, getAdminUsers,
  approveUser, rejectUser, suspendUser, unsuspendUser
} from '../services/api'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { fmtDate, fmtRelative } from '../utils/format'

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  active:    'bg-green-950/40 text-risk-low border-green-800/40',
  suspended: 'bg-gray-800/50 text-gray-400 border-gray-700/40',
}

function StatusPill({ is_active }) {
  const status = is_active ? 'active' : 'suspended'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
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

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ user, onAction, loading }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-b border-cyber-border/30 hover:bg-cyber-border/10 transition-colors">
        {/* User */}
        <td className="py-3.5 px-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-cyber-accent/20 border border-cyber-accent/30
                            flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-cyber-accent">
                {user.full_name[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-cyber-text">{user.full_name}</p>
              <p className="text-xs text-cyber-muted font-mono">@{user.username}</p>
            </div>
          </div>
        </td>

        {/* Email */}
        <td className="py-3.5 px-4">
          <p className="text-xs font-mono text-cyber-muted">{user.email}</p>
        </td>

        {/* Role */}
        <td className="py-3.5 px-4">
          {user.role === 'admin' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs
                             font-semibold bg-cyber-accent/10 text-cyber-accent border border-cyber-accent/30">
              <Crown className="w-3 h-3" /> Admin
            </span>
          ) : (
            <span className="text-xs text-cyber-muted capitalize">{user.role}</span>
          )}
        </td>

        {/* Status */}
        <td className="py-3.5 px-4"><StatusPill is_active={user.is_active} /></td>

        {/* Alerts count */}
        <td className="py-3.5 px-4">
          <span className="text-xs font-mono text-cyber-muted">{user.alert_count}</span>
        </td>

        {/* Joined */}
        <td className="py-3.5 px-4">
          <p className="text-xs text-cyber-muted">{fmtRelative(user.created_at)}</p>
        </td>

        {/* Actions */}
        <td className="py-3.5 px-4">
        {user.role !== 'admin' && (
            <div className="flex items-center gap-1.5">
              {user.approval_status === 'approved' && (
                <button
                  onClick={() => onAction('suspend', user.id)}
                  disabled={loading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                             bg-gray-800/50 text-gray-400 border border-gray-700/40
                             hover:bg-gray-700/50 transition-colors disabled:opacity-40"
                >
                  <UserX className="w-3.5 h-3.5" /> Suspend
                </button>
              )}
              {user.approval_status === 'suspended' && (
                <button
                  onClick={() => onAction('unsuspend', user.id)}
                  disabled={loading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                             bg-green-950/40 text-risk-low border border-green-800/40
                             hover:bg-green-950/60 transition-colors disabled:opacity-40"
                >
                  <UserCheck className="w-3.5 h-3.5" /> Restore
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [stats, setStats]     = useState(null)
  const [users, setUsers]     = useState([])
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)
  const [msg, setMsg]         = useState('')

  async function load() {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([
        getAdminStats(),
        getAdminUsers(filter || undefined),
      ])
      setStats(s)
      // filter locally by is_active
      let filtered = u.users
      if (filter === 'active')    filtered = u.users.filter(u => u.is_active)
      if (filter === 'suspended') filtered = u.users.filter(u => !u.is_active)
      setUsers(filtered)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  async function handleAction(action, userId) {
    setActing(true)
    setMsg('')
    try {
      const actions = { approve: approveUser, reject: rejectUser,
                        suspend: suspendUser, unsuspend: unsuspendUser }
      const res = await actions[action](userId)
      setMsg(res.message)
      await load()
    } catch (e) {
      setMsg(e?.response?.data?.detail ?? 'Action failed')
    } finally {
      setActing(false)
    }
  }

  const pendingCount = stats?.pending_users ?? 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Admin Panel"
        subtitle="Manage user accounts and access approvals"
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-1.5 text-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Success/error message */}
      {msg && (
        <div className="px-4 py-2.5 bg-green-950/30 border border-green-800/40 rounded-lg text-sm text-risk-low">
          {msg}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}       label="Total Users"    value={stats.total_users}     color="text-cyber-accent" />
          <StatCard icon={CheckCircle} label="Active"         value={stats.active_users}    color="text-risk-low" />
          <StatCard icon={UserX}       label="Suspended"      value={stats.suspended_users} color="text-risk-high" />
          <StatCard icon={Shield}      label="Total Alerts"   value={stats.total_alerts}    color="text-cyber-accent" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="card py-3 flex items-center gap-2 flex-wrap">
        {[
          { value: '',          label: 'All Users' },
          { value: 'active',    label: 'Active' },
          { value: 'suspended', label: 'Suspended' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filter === value
                ? 'bg-cyber-accent/10 text-cyber-accent border-cyber-accent/30'
                : 'text-cyber-muted border-cyber-border hover:text-cyber-text'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-cyber-muted">{users.length} users</span>
      </div>

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-8 h-8 text-cyber-muted mx-auto mb-2" />
            <p className="text-sm text-cyber-muted">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyber-border bg-cyber-bg/50">
                  {['User', 'Email', 'Role', 'Status', 'Alerts', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs text-cyber-muted font-semibold
                                           uppercase tracking-wide py-3 px-4 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onAction={handleAction}
                    loading={acting}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 px-4 py-3 bg-cyber-bg border border-cyber-border rounded-lg">
        <Shield className="w-4 h-4 text-cyber-accent shrink-0 mt-0.5" />
        <p className="text-xs text-cyber-muted leading-relaxed">
          <span className="text-cyber-text font-medium">Confidentiality Notice: </span>
          This panel shows only account metadata. Alert content, raw logs, and analysis results
          of individual users are never accessible to administrators. User data is fully isolated.
        </p>
      </div>
    </div>
  )
}
