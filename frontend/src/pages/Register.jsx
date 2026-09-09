import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Mail, Lock, Eye, EyeOff, User, AlertCircle, UserPlus, Check } from 'lucide-react'
import { register } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

function PasswordStrength({ password }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains a number',     ok: /\d/.test(password) },
    { label: 'Contains a letter',     ok: /[a-zA-Z]/.test(password) },
  ]
  if (!password) return null
  return (
    <div className="mt-2 space-y-1">
      {checks.map(c => (
        <div key={c.label} className="flex items-center gap-2">
          <Check className={`w-3 h-3 ${c.ok ? 'text-risk-low' : 'text-cyber-muted'}`} />
          <span className={`text-xs ${c.ok ? 'text-risk-low' : 'text-cyber-muted'}`}>{c.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function Register() {
  const navigate     = useNavigate()
  const { saveAuth } = useAuth()
  const [form, setForm]       = useState({ email: '', username: '', full_name: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await register(form)
      saveAuth(res.access_token, res.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cyber-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-cyber-accent/10 rounded-xl border border-cyber-accent/20">
            <Shield className="w-6 h-6 text-cyber-accent" />
          </div>
          <div>
            <p className="text-lg font-bold text-cyber-text">AEGIS</p>
            <p className="text-[10px] text-cyber-muted font-mono">Alert Evaluation & Guided Investigation System</p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-cyber-text mb-1">Create your account</h2>
          <p className="text-sm text-cyber-muted mb-6">Start analyzing security alerts in minutes</p>

          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-red-950/40 border border-risk-high/40 rounded-lg mb-5">
              <AlertCircle className="w-4 h-4 text-risk-high shrink-0" />
              <p className="text-sm text-risk-high">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input className="input pl-9" placeholder="John Smith"
                  value={form.full_name} onChange={set('full_name')} required />
              </div>
            </div>

            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input type="email" className="input pl-9" placeholder="analyst@company.com"
                  value={form.email} onChange={set('email')} required />
              </div>
            </div>

            <div>
              <label className="label">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted text-sm font-mono">@</span>
                <input className="input pl-8" placeholder="jsmith"
                  value={form.username} onChange={set('username')} required />
              </div>
              <p className="text-xs text-cyber-muted mt-1">Letters, numbers, _ and - only</p>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input type={showPwd ? 'text' : 'password'} className="input pl-9 pr-10"
                  placeholder="Min. 8 characters"
                  value={form.password} onChange={set('password')} required />
                <button type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-cyber-text"
                  onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 mt-2">
              {loading ? <Spinner size="sm" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-cyber-muted mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-cyber-accent hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
