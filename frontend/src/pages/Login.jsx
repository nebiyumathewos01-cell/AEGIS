import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Shield, Mail, Lock, Eye, EyeOff,
  AlertCircle, LogIn, Activity, Server, Search
} from 'lucide-react'
import { login } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const PLATFORM_FEATURES = [
  { icon: Activity, label: 'Real-time alert triage',     desc: 'Parse and score alerts instantly' },
  { icon: Shield,   label: 'Rule-based risk scoring',    desc: 'Transparent 0–100 risk assessment' },
  { icon: Search,   label: 'AI-powered explanation',     desc: 'Plain-English analysis of every threat' },
  { icon: Server,   label: 'Full investigation workflow', desc: 'Notes, status tracking, PDF reports' },
]

export default function Login() {
  const navigate     = useNavigate()
  const { saveAuth } = useAuth()

  // Never prefill — always start empty
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      const res = await login({ email: email.trim().toLowerCase(), password })
      saveAuth(res.access_token, res.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Invalid email or password.')
      setPassword('') // clear password on failure for security
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cyber-bg flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] shrink-0 flex-col
                      bg-cyber-surface border-r border-cyber-border p-10 xl:p-14">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-12">
          <div className="p-2.5 bg-cyber-accent/10 rounded-xl border border-cyber-accent/20">
            <Shield className="w-7 h-7 text-cyber-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-cyber-text tracking-tight">AEGIS</h1>
            <p className="text-[11px] text-cyber-muted font-mono">
              Alert Evaluation &amp; Guided Investigation System
            </p>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-cyber-text leading-tight mb-3">
            Security Operations<br />Intelligence Platform
          </h2>
          <p className="text-sm text-cyber-muted leading-relaxed">
            Purpose-built for security analysts to triage alerts, understand threats,
            and take decisive action — faster than manual investigation.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 flex-1">
          {PLATFORM_FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3.5">
              <div className="p-2 bg-cyber-bg rounded-lg border border-cyber-border shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-cyber-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cyber-text">{label}</p>
                <p className="text-xs text-cyber-muted mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-cyber-border">
          <p className="text-xs text-cyber-muted font-mono">
            AEGIS v2.0 · Authorized Use Only · Defensive Security Tool
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">

          {/* Mobile brand */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <Shield className="w-6 h-6 text-cyber-accent" />
            <div>
              <p className="font-bold text-cyber-text">AEGIS</p>
              <p className="text-[10px] text-cyber-muted font-mono">
                Alert Evaluation &amp; Guided Investigation System
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-cyber-text">Sign in</h2>
            <p className="text-sm text-cyber-muted mt-1.5">
              Enter your credentials to access your workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 mb-6
                            bg-red-950/30 border border-risk-high/40 rounded-lg">
              <AlertCircle className="w-4 h-4 text-risk-high shrink-0 mt-0.5" />
              <p className="text-sm text-risk-high leading-snug">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  name="aegis-email"
                  autoComplete="username"
                  className="input pl-10"
                  placeholder="your.email@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted pointer-events-none" />
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  name="aegis-password"
                  autoComplete="current-password"
                  className="input pl-10 pr-11"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2
                             text-cyber-muted hover:text-cyber-text transition-colors"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="btn-primary w-full flex items-center justify-center gap-2.5 py-3 mt-2 text-base"
            >
              {loading
                ? <><Spinner size="sm" /> Authenticating...</>
                : <><LogIn className="w-4 h-4" /> Sign In to AEGIS</>
              }
            </button>
          </form>

          {/* Register link */}
          <div className="mt-8 pt-6 border-t border-cyber-border text-center">
            <p className="text-sm text-cyber-muted">
              No account yet?{' '}
              <Link
                to="/register"
                className="text-cyber-accent hover:text-blue-300 font-semibold transition-colors"
              >
                Create your analyst account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
