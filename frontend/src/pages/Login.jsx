import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, AlertCircle, LogIn, Terminal, Shield, Zap, Activity } from 'lucide-react'
import { login } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Spinner from '../components/Spinner'
import { Sun, Moon } from 'lucide-react'

const FEATURES = [
  { icon: Terminal, text: '20 log source parsers' },
  { icon: Shield,   text: 'Rule-based risk scoring' },
  { icon: Zap,      text: 'AI-powered explanation' },
  { icon: Activity, text: 'Full SOC workflow' },
]

export default function Login() {
  const navigate     = useNavigate()
  const { saveAuth } = useAuth()
  const { dark, toggle } = useTheme()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError(''); setLoading(true)
    try {
      const res = await login({ email: email.trim().toLowerCase(), password })
      saveAuth(res.access_token, res.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Invalid email or password.')
      setPassword('')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* Theme toggle top-right */}
      <button onClick={toggle}
        className="fixed top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs z-50"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: dark ? '#f59e0b' : '#6366f1' }}>
        {dark ? <><Sun className="w-3.5 h-3.5" /> Light</> : <><Moon className="w-3.5 h-3.5" /> Dark</>}
      </button>

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[440px] shrink-0 flex-col p-10"
        style={{ background: 'var(--surface)', borderRight: '2px solid var(--accent)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <img src="/logo.svg" alt="AEGIS" className="w-12 h-12" />
          <div>
            <h1 className="text-2xl font-black tracking-widest" style={{ color: 'var(--accent)' }}>AEGIS</h1>
            <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
              Alert Evaluation &amp; Guided Investigation System
            </p>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            Security Operations<br />
            <span style={{ color: 'var(--accent)' }}>Intelligence Platform</span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Purpose-built for security analysts to parse, score, and investigate
            alerts from 20+ log sources with AI-powered explanations.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 flex-1">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 px-3 py-2.5 rounded"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderLeft: '3px solid var(--teal)' }}>
              <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--teal)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
            AEGIS v2.1 · Defensive Security Tool · Authorized Use Only
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src="/logo.svg" alt="AEGIS" className="w-9 h-9" />
            <div>
              <p className="font-black tracking-widest text-lg" style={{ color: 'var(--accent)' }}>AEGIS</p>
              <p className="text-[9px] font-mono" style={{ color: 'var(--muted)' }}>Security Platform</p>
            </div>
          </div>

          {/* Form header */}
          <div className="mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Sign In</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Enter your credentials to access your workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded mb-5"
              style={{ background: 'rgba(255,34,68,0.08)', border: '1px solid rgba(255,34,68,0.3)', borderLeft: '3px solid #ff2244' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#ff2244' }} />
              <p className="text-xs" style={{ color: '#ff2244' }}>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--muted)' }} />
                <input id="email" type="email" name="aegis-email" autoComplete="username"
                  className="input pl-9" placeholder="analyst@company.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--muted)' }} />
                <input id="password" type={showPwd ? 'text' : 'password'}
                  name="aegis-password" autoComplete="current-password"
                  className="input pl-9 pr-10" placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !email.trim() || !password}
              className="btn-primary w-full justify-center py-2.5 text-sm mt-2">
              {loading
                ? <><Spinner size="sm" /> Authenticating...</>
                : <><LogIn className="w-4 h-4" /> Sign In to AEGIS</>
              }
            </button>
          </form>

          <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              No account?{' '}
              <Link to="/register" className="font-semibold transition-colors"
                style={{ color: 'var(--accent)' }}>
                Create analyst account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
