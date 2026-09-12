import { useState, useEffect } from 'react'
import {
  Shield, CheckCircle, XCircle, Clock, Play,
  ChevronDown, ChevronUp, Terminal, AlertTriangle
} from 'lucide-react'
import { generatePlaybook, getPlaybook, updatePlaybookStep } from '../services/api'
import Spinner from './Spinner'

const RISK_COLORS = {
  low:    '#00d4aa',
  medium: '#f59e0b',
  high:   '#ff2244',
}

const STATUS_STYLES = {
  pending:  { color: 'var(--muted)', label: 'Pending' },
  approved: { color: '#00d4aa',      label: 'Approved' },
  skipped:  { color: 'var(--muted)', label: 'Skipped' },
  done:     { color: '#00d4aa',      label: 'Done' },
}

function StepCard({ step, onApprove, onSkip, loading }) {
  const [expanded, setExpanded] = useState(false)
  const statusStyle = STATUS_STYLES[step.status] || STATUS_STYLES.pending
  const isPending = step.status === 'pending'

  return (
    <div className="rounded overflow-hidden"
      style={{
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${step.color}`,
        background: 'var(--surface2)',
        marginBottom: '0.5rem',
      }}>
      <div className="flex items-start gap-3 p-3">
        {/* Step number */}
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
          style={{ background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}40` }}>
          {step.step_number}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: step.color }}>{step.category_label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: `${RISK_COLORS[step.risk]}15`, color: RISK_COLORS[step.risk], border: `1px solid ${RISK_COLORS[step.risk]}30` }}>
              {step.risk} risk
            </span>
            <span className="text-[10px]" style={{ color: statusStyle.color }}>
              {statusStyle.label}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text)' }}>{step.action}</p>

          {/* Command */}
          {step.command && (
            <button
              className="flex items-center gap-1 text-[10px] mt-1"
              style={{ color: 'var(--muted)' }}
              onClick={() => setExpanded(v => !v)}
            >
              <Terminal className="w-3 h-3" />
              {expanded ? 'Hide command' : 'Show command'}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {expanded && step.command && (
            <pre className="text-[10px] font-mono mt-1.5 p-2 rounded overflow-x-auto"
              style={{ background: 'var(--bg)', color: 'var(--teal)', border: '1px solid var(--border)' }}>
              {step.command}
            </pre>
          )}
        </div>

        {/* Action buttons */}
        {isPending && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => onApprove(step.step_number)}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
              style={{ background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }}>
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => onSkip(step.step_number)}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
              style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              <XCircle className="w-3.5 h-3.5" /> Skip
            </button>
          </div>
        )}
        {!isPending && (
          <div className="shrink-0">
            {step.status === 'approved' && <CheckCircle className="w-4 h-4" style={{ color: '#00d4aa' }} />}
            {step.status === 'skipped'  && <XCircle className="w-4 h-4" style={{ color: 'var(--muted)' }} />}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlaybookPanel({ alertId }) {
  const [playbook, setPlaybook] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    // Try to load existing playbook
    getPlaybook(alertId)
      .then(setPlaybook)
      .catch(() => {}) // 404 means not generated yet
  }, [alertId])

  async function handleGenerate() {
    setGenerating(true); setError('')
    try {
      const pb = await generatePlaybook(alertId)
      setPlaybook(pb)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Failed to generate playbook')
    } finally {
      setGenerating(false)
    }
  }

  async function handleStep(stepNumber, status) {
    setLoading(true)
    try {
      const updated = await updatePlaybookStep(alertId, stepNumber, status)
      setPlaybook(updated)
    } finally {
      setLoading(false)
    }
  }

  const steps = playbook?.steps || []
  const pending   = steps.filter(s => s.status === 'pending').length
  const approved  = steps.filter(s => s.status === 'approved').length
  const completed = playbook?.status === 'completed'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Response Playbook
          </span>
          {playbook && (
            <span className="text-[10px] px-2 py-0.5 rounded font-mono"
              style={{ background: completed ? 'rgba(0,212,170,0.12)' : 'rgba(255,107,53,0.12)',
                       color: completed ? '#00d4aa' : 'var(--accent)',
                       border: `1px solid ${completed ? 'rgba(0,212,170,0.3)' : 'rgba(255,107,53,0.3)'}` }}>
              {completed ? 'Completed' : `${pending} pending`}
            </span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"
        >
          {generating ? <Spinner size="sm" /> : <Play className="w-3.5 h-3.5" />}
          {playbook ? 'Regenerate' : 'Generate Playbook'}
        </button>
      </div>

      {error && (
        <p className="text-xs mb-3" style={{ color: '#ff2244' }}>{error}</p>
      )}

      {!playbook && !generating && (
        <div className="text-center py-8">
          <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--muted)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No playbook generated yet.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Click "Generate Playbook" to create a tailored response plan.
          </p>
        </div>
      )}

      {playbook && (
        <>
          {/* Approval notice */}
          <div className="flex items-start gap-2 mb-4 p-3 rounded text-xs"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderLeft: '3px solid #f59e0b' }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            <p style={{ color: 'var(--text)' }}>
              <span className="font-semibold">Analyst approval required.</span>{' '}
              AEGIS never executes actions automatically. Review each step and click
              Approve or Skip. Commands shown are for reference only.
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 mb-4 text-xs" style={{ color: 'var(--muted)' }}>
            <span>{steps.length} total steps</span>
            <span>·</span>
            <span style={{ color: '#00d4aa' }}>{approved} approved</span>
            <span>·</span>
            <span>{pending} pending</span>
            <div className="flex-1 h-1 rounded ml-2" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded transition-all"
                style={{ width: `${steps.length ? ((steps.length - pending) / steps.length) * 100 : 0}%`,
                         background: 'var(--teal)' }} />
            </div>
          </div>

          {/* Steps */}
          {steps.map(step => (
            <StepCard
              key={step.step_number}
              step={step}
              loading={loading}
              onApprove={(n) => handleStep(n, 'approved')}
              onSkip={(n)    => handleStep(n, 'skipped')}
            />
          ))}
        </>
      )}
    </div>
  )
}
