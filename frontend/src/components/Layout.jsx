import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Shield, Search, BookOpen,
  AlertTriangle, Plus, LogOut, History, Crown,
  Settings, ChevronDown, Menu, X, Sun, Moon,
  Radio, Zap, Server
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const NAV = [
  { to: '/dashboard',           icon: LayoutDashboard, label: 'Dashboard',      group: 'main' },
  { to: '/alerts',              icon: AlertTriangle,   label: 'Alerts',         group: 'main' },
  { to: '/history',             icon: History,         label: 'History',        group: 'main' },
  { to: '/investigations',      icon: BookOpen,        label: 'Investigations', group: 'main' },
  { to: '/threat-intelligence', icon: Search,          label: 'Threat Intel',   group: 'tools' },
  { to: '/environment',         icon: Server,          label: 'Env Profile',    group: 'tools' },
  { to: '/audit',               icon: Shield,          label: 'Audit Log',      group: 'tools' },
  { to: '/settings',            icon: Settings,        label: 'Settings & API', group: 'tools' },
]

export default function Layout() {
  const navigate         = useNavigate()
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A'

  const mainNav  = NAV.filter(n => n.group === 'main')
  const toolsNav = NAV.filter(n => n.group === 'tools')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-56 flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: '2px solid var(--accent)' }}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img src="/logo.svg" alt="AEGIS" className="w-8 h-8" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-risk-low border-2"
                style={{ borderColor: 'var(--surface)' }} />
            </div>
            <div>
              <p className="text-sm font-black tracking-widest" style={{ color: 'var(--accent)' }}>AEGIS</p>
              <p className="text-[9px] font-mono" style={{ color: 'var(--muted)' }}>v2.1 · SOC Platform</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}
            style={{ color: 'var(--muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Alert button */}
        <div className="px-3 py-3">
          <button onClick={() => { navigate('/alerts/new'); setSidebarOpen(false) }}
            className="btn-primary w-full justify-center text-xs py-2">
            <Plus className="w-3.5 h-3.5" /> New Alert
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 pb-2 overflow-y-auto space-y-0.5">
          <p className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--muted)' }}>Workspace</p>
          {mainNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-all ${
                  isActive ? 'active-nav' : 'inactive-nav'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'rgba(255,107,53,0.12)',
                color: 'var(--accent)',
                borderLeft: '2px solid var(--accent)',
                paddingLeft: '10px',
              } : {
                color: 'var(--muted)',
              }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </NavLink>
          ))}

          <p className="px-2 pt-4 pb-1 text-[9px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--muted)' }}>Tools</p>
          {toolsNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-all"
              style={({ isActive }) => isActive ? {
                background: 'rgba(255,107,53,0.12)',
                color: 'var(--accent)',
                borderLeft: '2px solid var(--accent)',
                paddingLeft: '10px',
              } : {
                color: 'var(--muted)',
              }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </NavLink>
          ))}

          {/* Admin */}
          {user?.role === 'admin' && (
            <>
              <p className="px-2 pt-4 pb-1 text-[9px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--accent)', opacity: 0.7 }}>Admin</p>
              <NavLink to="/admin" onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-all"
                style={({ isActive }) => isActive ? {
                  background: 'rgba(255,107,53,0.12)',
                  color: 'var(--accent)',
                  borderLeft: '2px solid var(--accent)',
                  paddingLeft: '10px',
                } : { color: 'var(--muted)' }}
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                Admin Panel
              </NavLink>
            </>
          )}
        </nav>

        {/* User */}
        <div style={{ borderTop: '1px solid var(--border)' }} className="p-2">
          <div className="relative">
            <button onClick={() => setProfileOpen(v => !v)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded text-xs transition-all"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={{ background: 'rgba(255,107,53,0.2)', color: 'var(--accent)', border: '1px solid rgba(255,107,53,0.3)' }}>
                {initials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-[11px] truncate" style={{ color: 'var(--text)' }}>{user?.full_name}</p>
                <p className="text-[9px] capitalize" style={{ color: 'var(--muted)' }}>{user?.role}</p>
              </div>
              <ChevronDown className={`w-3 h-3 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded overflow-hidden shadow-xl"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Signed in as</p>
                  <p className="text-xs font-mono truncate" style={{ color: 'var(--text)' }}>{user?.email}</p>
                </div>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors"
                  style={{ color: '#ff2244' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,34,68,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top bar ── */}
        <header className="h-12 flex items-center px-4 gap-3 shrink-0"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>

          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}
            style={{ color: 'var(--muted)' }}>
            <Menu className="w-5 h-5" />
          </button>

          {/* Burp-style breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono"
            style={{ color: 'var(--muted)' }}>
            <Radio className="w-3 h-3" style={{ color: 'var(--teal)' }} />
            <span style={{ color: 'var(--teal)' }}>aegis</span>
            <span>/</span>
            <span>workspace</span>
          </div>

          <div className="flex-1" />

          {/* Status pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-risk-low animate-pulse" />
            Online
          </div>

          {/* Day/Night toggle */}
          <button onClick={toggle}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: dark ? '#f59e0b' : '#6366f1',
            }}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {dark
              ? <><Sun className="w-3.5 h-3.5" /><span className="hidden sm:inline">Light</span></>
              : <><Moon className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dark</span></>
            }
          </button>

          <div className="w-px h-5" style={{ background: 'var(--border)' }} />

          {/* User chip */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(255,107,53,0.2)', color: 'var(--accent)', border: '1px solid rgba(255,107,53,0.3)' }}>
              {initials}
            </div>
            <span className="text-xs font-medium hidden sm:block" style={{ color: 'var(--text)' }}>
              {user?.full_name}
            </span>
          </div>
        </header>

        {/* ── Page ── */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
