import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, User, AlertCircle, UserPlus } from 'lucide-react'
import Logo from '../components/Logo'
import { register } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

// ── NIST SP 800-63B common passwords list (top 20 most common) ───────────────
const COMMON_PASSWORDS = new Set([
  'password', '12345678', '123456789', 'password1', 'iloveyou',
  'sunshine', 'princess', 'football', 'welcome1', 'shadow123',
  'monkey123', 'dragon123', 'master123', 'abc12345', 'letmein1',
  'qwerty123', 'passw0rd', 'starwars', 'baseball', 'superman',
  'batman123', 'trustno1', 'hello123', 'freedom1', 'whatever',
  'qwertyui', 'admin123', 'login123', 'test1234', 'pass1234',
])

// ── NIST SP 800-63B password strength ────────────────────────────────────────
function getNistStrength(password) {
  if (!password) return { score: 0, label: '', color: '', bars: 0 }

  const len = password.length
  const isCommon = COMMON_PASSWORDS.has(password.toLowerCase())

  // NIST: focus on length, not complexity
  let score = 0
  let label = ''
  let color = ''
  let bars  = 0

  if (isCommon) {
    return { score: 0, label: 'Too common — choose a different password', color: '#ff2244', bars: 1, blocked: true }
  }

  if (len < 8)  { score = 1; label = 'Too short (min 8 characters)'; color = '#ff2244'; bars = 1 }
  else if (len < 12) { score = 2; label = 'Weak — try a longer password'; color = '#ff6b35'; bars = 2 }
  else if (len < 16) { score = 3; label = 'Fair';   color = '#f59e0b'; bars = 3 }
  else if (len < 20) { score = 4; label = 'Good';   color = '#00d4aa'; bars = 4 }
  else               { score = 5; label = 'Strong'; color = '#00d4aa'; bars = 5 }

  return { score, label, color, bars, blocked: false }
}

function PasswordStrengthMeter({ password }) {
  if (!password) return null
  const { label, color, bars, blocked } = getNistStrength(password)

  return (
    <div className="mt-2 space-y-1.5">
      {/* Bar meter */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= bars ? color : 'var(--border)' }} />
        ))}
      </div>

      {/* Label */}
      <p className="text-xs font-medium" style={{ color }}>
        {label}
      </p>

      {/* NIST guidance */}
      <div className="text-xs space-y-0.5" style={{ color: 'var(--muted)' }}>
        <p style={{ color: password.length >= 8 ? '#00d4aa' : 'var(--muted)' }}>
          {password.length >= 8 ? '✓' : '○'} Minimum 8 characters (longer is better)
        </p>
        {blocked && (
          <p style={{ color: '#ff2244' }}>
            ✗ This is a commonly used password — please choose another
          </p>
        )}
      </div>
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

  const strength = getNistStrength(form.password)

  function handleChange(k, value) {
    // Force username to lowercase as user types (Fix #2)
    if (k === 'username') value = value.toLowerCase()
    setForm(f => ({ ...f, [k]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // NIST validation
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters (NIST SP 800-63B)')
      return
    }
    if (strength.blocked) {
      setError('This password is too commonly used. Please choose a different one.')
      return
    }

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
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8">
          <Logo size="sm" />
        </div>

        <div className="panel">
          <div className="mb-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              Create your account
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Start analyzing security alerts in minutes
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded mb-4"
              style={{ background: 'rgba(255,34,68,0.08)', border: '1px solid rgba(255,34,68,0.3)', borderLeft: '3px solid #ff2244' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#ff2244' }} />
              <p className="text-xs" style={{ color: '#ff2244' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--muted)' }} />
                <input className="input pl-9" placeholder="John Smith"
                  value={form.full_name}
                  onChange={e => handleChange('full_name', e.target.value)}
                  required />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--muted)' }} />
                <input type="email" className="input pl-9" placeholder="analyst@company.com"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  autoComplete="email" required />
              </div>
            </div>

            {/* Username — forced lowercase */}
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono pointer-events-none"
                  style={{ color: 'var(--muted)' }}>@</span>
                <input className="input pl-8 font-mono lowercase" placeholder="jsmith"
                  value={form.username}
                  onChange={e => handleChange('username', e.target.value)}
                  autoComplete="username"
                  required />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Lowercase letters, numbers, _ and - only
              </p>
            </div>

            {/* Password — NIST strength */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  NIST SP 800-63B
                </span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--muted)' }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pl-9 pr-10"
                  placeholder="Minimum 8 characters — longer is better"
                  value={form.password}
                  onChange={e => handleChange('password', e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={form.password} />
            </div>

            <button type="submit"
              disabled={loading || form.password.length < 8 || strength.blocked}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 mt-2">
              {loading ? <Spinner size="sm" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold transition-colors"
              style={{ color: 'var(--accent)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
