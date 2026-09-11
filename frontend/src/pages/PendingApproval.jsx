import { useNavigate } from 'react-router-dom'
import { Clock, Shield, LogOut, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

export default function PendingApproval() {
  const navigate   = useNavigate()
  const { logout } = useAuth()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cyber-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">

        <div className="mb-8">
          <Logo size="md" className="justify-center" />
        </div>

        {/* Status card */}
        <div className="card border-cyber-border/80">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="p-4 bg-yellow-950/40 border border-yellow-800/40 rounded-full">
              <Clock className="w-8 h-8 text-risk-medium" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-cyber-text mb-2">
            Account Pending Approval
          </h2>
          <p className="text-sm text-cyber-muted leading-relaxed mb-6">
            Your account has been created and is awaiting administrator approval.
            You will be able to sign in once your access has been granted.
          </p>

          {/* Steps */}
          <div className="space-y-3 text-left mb-6">
            {[
              { icon: Shield, label: 'Account created',              done: true },
              { icon: Clock,  label: 'Awaiting admin approval',      done: false, active: true },
              { icon: Mail,   label: 'Access granted — you can login', done: false },
            ].map(({ icon: Icon, label, done, active }) => (
              <div key={label} className={`flex items-center gap-3 px-3 py-2 rounded-lg
                ${active ? 'bg-yellow-950/20 border border-yellow-800/30' : 'opacity-50'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  done ? 'bg-risk-low' : active ? 'bg-risk-medium' : 'bg-cyber-border'
                }`}>
                  {done
                    ? <span className="text-white text-xs font-bold">✓</span>
                    : <Icon className="w-3 h-3 text-cyber-bg" />
                  }
                </div>
                <span className={`text-sm ${
                  done ? 'text-risk-low font-medium' :
                  active ? 'text-risk-medium font-medium' : 'text-cyber-muted'
                }`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-cyber-muted mb-6 bg-cyber-bg rounded-lg p-3 border border-cyber-border">
            Contact your system administrator if your approval is taking longer than expected.
          </p>

          <button
            onClick={handleLogout}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        <p className="text-xs text-cyber-muted mt-4 font-mono">
          AEGIS · Access Control System
        </p>
      </div>
    </div>
  )
}
