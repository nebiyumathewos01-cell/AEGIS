import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Shield, Search, BookOpen,
  AlertTriangle, Plus, LogOut, User,
  ChevronDown, Bell, Menu, X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alerts',              icon: AlertTriangle,   label: 'Alerts' },
  { to: '/investigations',      icon: BookOpen,        label: 'Investigations' },
  { to: '/threat-intelligence', icon: Search,          label: 'Threat Intel' },
  { to: '/audit',               icon: Shield,          label: 'Audit Log' },
]

export default function Layout() {
  const navigate       = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A'

  return (
    <div className="flex h-screen overflow-hidden bg-cyber-bg">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-60 flex flex-col border-r border-cyber-border bg-cyber-surface
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-cyber-border">
          <div className="p-1.5 bg-cyber-accent/10 rounded-lg border border-cyber-accent/20">
            <Shield className="text-cyber-accent w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-cyber-text tracking-wide">AEGIS</p>
            <p className="text-[9px] text-cyber-muted font-mono leading-tight">Alert Evaluation & Guided Investigation</p>
          </div>
          <button
            className="ml-auto lg:hidden text-cyber-muted hover:text-cyber-text"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New alert */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => { navigate('/alerts/new'); setSidebarOpen(false) }}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2"
          >
            <Plus className="w-4 h-4" />
            New Alert
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-cyber-muted uppercase tracking-widest">
            Navigation
          </p>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all ${
                  isActive
                    ? 'bg-cyber-accent/10 text-cyber-accent font-medium border border-cyber-accent/20'
                    : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-border/40'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User profile */}
        <div className="border-t border-cyber-border p-3">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-cyber-border/40 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-cyber-accent/20 border border-cyber-accent/30 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-cyber-accent">{initials}</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-medium text-cyber-text truncate">{user?.full_name}</p>
                <p className="text-[10px] text-cyber-muted truncate capitalize">{user?.role}</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-cyber-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-cyber-bg border border-cyber-border rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-cyber-border">
                  <p className="text-xs text-cyber-muted">Signed in as</p>
                  <p className="text-xs font-mono text-cyber-text truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-risk-high hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-cyber-border bg-cyber-surface flex items-center px-4 gap-3 shrink-0">
          <button
            className="lg:hidden text-cyber-muted hover:text-cyber-text"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyber-bg rounded-md border border-cyber-border">
            <div className="w-1.5 h-1.5 rounded-full bg-risk-low animate-pulse" />
            <span className="text-xs text-cyber-muted font-mono">System Online</span>
          </div>

          <div className="w-px h-5 bg-cyber-border" />

          {/* User avatar */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-cyber-accent/20 border border-cyber-accent/30 flex items-center justify-center">
              <span className="text-xs font-bold text-cyber-accent">{initials}</span>
            </div>
            <span className="text-sm text-cyber-text hidden sm:block">{user?.full_name}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
