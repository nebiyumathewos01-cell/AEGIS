import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, HelpCircle, ArrowRight, Shield, Zap,
  Terminal, Bot, Key
} from 'lucide-react'

export default function QuickGuideModal({ isOpen, onClose }) {
  const navigate = useNavigate()

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const steps = [
    {
      num: '01',
      title: 'Ingest Events',
      icon: Terminal,
      color: '#00e599',
      summary: 'Send raw security logs via Webhook API or paste manually.',
      detail: 'Forward alerts automatically from external tools using your API Key (`POST /api/webhook/alert`), or manually paste raw logs (Auth, Nmap, Suricata) via "+ New Alert".',
      actionLabel: '+ New Alert',
      actionTo: '/alerts/new',
    },
    {
      num: '02',
      title: 'Automated Scoring',
      icon: Zap,
      color: '#ff6b35',
      summary: 'Deterministic Rule Engine evaluates risk (0–100).',
      detail: 'Analyzes failed attempts, sensitive ports (SSH 22, RDP 3389), privileged users (root, admin), and assigns an objective risk tier: LOW (<30), MEDIUM (30-59), HIGH (60-79), or CRITICAL (80+).',
      actionLabel: null,
      actionTo: null,
    },
    {
      num: '03',
      title: 'AI Threat Insights',
      icon: Bot,
      color: '#00d4aa',
      summary: 'Plain-English explanations & MITRE ATT&CK mapping.',
      detail: 'Click any alert in the Alerts table to get an instant AI-generated summary explaining what happened, attack impact, and exact threat classifications.',
      actionLabel: 'Browse Alerts',
      actionTo: '/alerts',
    },
    {
      num: '04',
      title: 'Response & Playbooks',
      icon: Shield,
      color: '#a855f7',
      summary: 'Guided remediation commands & agent investigation.',
      detail: 'Execute step-by-step containment playbooks (IP blocking, credential rotation, service hardening) or launch deep interactive threat hunting with the AI Agent.',
      actionLabel: 'Investigations',
      actionTo: '/investigations',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col z-10"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface2)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded"
              style={{
                background: 'rgba(0, 229, 153, 0.15)',
                border: '1px solid rgba(0, 229, 153, 0.3)',
                color: 'var(--accent)',
              }}
            >
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide" style={{ color: 'var(--text)' }}>
                AEGIS SOC Platform · Quick System Guide
              </h2>
              <p className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                4-step operational workflow from log ingestion to mitigation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--muted)' }}
            title="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps Grid */}
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.num}
                className="p-3.5 rounded-lg transition-all"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2 rounded shrink-0 mt-0.5"
                      style={{
                        background: `${step.color}15`,
                        border: `1px solid ${step.color}35`,
                        color: step.color,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--muted)',
                          }}
                        >
                          STEP {step.num}
                        </span>
                        <h3 className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--text)', opacity: 0.9 }}>
                        {step.summary}
                      </p>
                      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                        {step.detail}
                      </p>
                    </div>
                  </div>

                  {step.actionTo && (
                    <button
                      onClick={() => {
                        navigate(step.actionTo)
                        onClose()
                      }}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-all hover:brightness-110"
                      style={{
                        background: 'rgba(0, 229, 153, 0.12)',
                        border: '1px solid rgba(0, 229, 153, 0.35)',
                        color: 'var(--accent)',
                      }}
                    >
                      {step.actionLabel}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between text-xs"
          style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--surface2)',
          }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <Key className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span className="text-[11px]">
              Need an API key for integrations? Head to{' '}
              <button
                onClick={() => {
                  navigate('/settings')
                  onClose()
                }}
                className="underline hover:opacity-80"
                style={{ color: 'var(--accent)' }}
              >
                Settings & API
              </button>
              .
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded text-xs font-semibold hover:brightness-110 transition-all"
            style={{
              background: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
