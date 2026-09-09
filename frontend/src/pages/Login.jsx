import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react'
import { login } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

export default function Login() {
  const navigate       = useNavigate()
  const { saveAuth }   = useAuth()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login({ email: form.email, password: form.password })
      saveAuth(res.access_token, res.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cyber-bg flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-cyber-surface border-r border-cyber-border flex-col items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyber-accent/10 rounded-xl border border-cyber-accent/20">
              <Shield className="w-8 h-8 text-cyber-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-cyber-text tracking-tight">AEGIS</h1>
              <p className="text-xs text-cyber-muted font-mono">Alert Evaluation & Guided Investigation System</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-cyber-text mb-4 leading-tight">
            Intelligent Security<br />Alert Triage Platform
          </h2>
          <p className="text-cyber-muted text-sm leading-relaxed mb-8">
            Analyze security alerts from Nmap, Suricata, and Linux auth logs.
            Get AI-powered explanations, risk scores, and investigation steps instantly.
          </p>

          <div className="space-y-3">
            {[
              { label: 'Automated log parsing', desc: 'Auth, Nmap, Suricata, Generic' },
              { label: 'Rule-based risk scoring', desc: 'Transparent 0–100 risk score' },
              { label: 'AI-powered explanation', desc: 'Plain English analysis' },
              { label: 'Investigation workflow', desc: 'Notes, status, PDF reports' },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-3 p-3 bg-cyber-bg rounded-lg border border-cyber-border/50">
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-accent mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-cyber-text">{f.label}</p>
                  <p className="text-xs text-cyber-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <Shield className="w-7 h-7 text-cyber-accent" />
            <div>
              <p className="text-lg font-bold text-cyber-text">AEGIS</p>
              <p className="text-[10px] text-cyber-muted font-mono">Alert Evaluation & Guided Investigation System</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-cyber-text">Welcome back</h2>
            <p className="text-cyber-muted text-sm mt-1">Sign in to your AEGIS account</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-red-950/40 border border-risk-high/40 rounded-lg mb-5">
              <AlertCircle className="w-4 h-4 text-risk-high shrink-0" />
              <p className="text-sm text-risk-high">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input
                  type="email"
                  className="input pl-9"
                  placeholder="analyst@company.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pl-9 pr-10"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-cyber-text"
                  onClick={() => setShowPwd(v => !v)}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 mt-2"
            >
              {loading ? <Spinner size="sm" /> : <LogIn className="w-4 h-4" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-cyber-muted mt-6">
            No account?{' '}
            <Link to="/register" className="text-cyber-accent hover:underline font-medium">
              Create one
            </Link>
          </p>

          <div className="mt-8 p-3 bg-cyber-surface border border-cyber-border rounded-lg">
            <p className="text-xs text-cyber-muted text-center font-mono">
              AEGIS · Defensive Security Tool · For Authorized Use Only
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
