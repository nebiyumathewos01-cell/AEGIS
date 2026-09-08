import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Shield, Search, FileText,
  AlertTriangle, BookOpen, Plus, ChevronRight
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alerts',             icon: AlertTriangle,   label: 'Alerts' },
  { to: '/investigations',     icon: BookOpen,        label: 'Investigations' },
  { to: '/threat-intelligence',icon: Search,          label: 'Threat Intel' },
]

export default function Layout() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen overflow-hidden bg-cyber-bg">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-cyber-border bg-cyber-surface">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-cyber-border">
          <Shield className="text-cyber-accent w-6 h-6 shrink-0" />
          <div>
            <p className="text-sm font-bold text-cyber-text leading-tight">AEGIS</p>
            <p className="text-[10px] text-cyber-muted leading-tight font-mono">Alert Evaluation & Guided Investigation</p>
          </div>
        </div>

        {/* New alert button */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => navigate('/alerts/new')}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2"
          >
            <Plus className="w-4 h-4" />
            New Alert
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-cyber-accent/10 text-cyber-accent font-medium'
                    : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-border/50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-cyber-border">
          <p className="text-[10px] text-cyber-muted font-mono">v1.0.0 · AEGIS · Defensive Use Only</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
