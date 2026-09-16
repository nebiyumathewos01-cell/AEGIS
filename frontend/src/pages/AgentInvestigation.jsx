import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Bot, ArrowLeft, Play, CheckCircle, XCircle,
  Shield, Clock, AlertTriangle, Brain, Search,
  ChevronDown, ChevronUp, Star, MessageSquare,
  Cpu, Target, FileSearch, Lock, Bell, Zap,
  RefreshCw, Filter
} from 'lucide-react'
import { useAlert } from '../hooks/useAlert'
import {
  startSOCInvestigation, getAlertSessions,
  approveAgentAction, rejectAgentAction,
  submitAgentFeedback,
} from '../services/api'
import Spinner from '../components/Spinner'
import RiskBadge from '../components/RiskBadge'
import RiskScoreBar from '../components/RiskScoreBar'
import { formatAlertType, riskColor } from '../utils/risk'
import { fmtDate } from '../utils/format'

// ── Constants ─────────────────────────────────────────────────────────────────
const AUDIT_STYLES = {
  investigation_start:   { color: '#a855f7', label: 'Start' },
  reasoning:             { color: '#8888bb', label: 'Reasoning' },
  tool_call:             { color: 'var(--accent)', label: 'Tool' },
  tool_result:           { color: 'var(--teal)', label: 'Result' },
  evidence_collected:    { color: 'var(--teal)', label: 'Evidence' },
  guardrail_check:       { color: '#f59e0b', label: 'Guardrail' },
  guardrail_blocked:     { color: '#ff2244', label: 'BLOCKED' },
  decision:              { color: '#f59e0b', label: 'Decision' },
  loop_continue:         { color: '#8888bb', label: 'Loop ↻' },
  loop_stop:             { color: 'var(--teal)', label: 'Loop ✓' },
  action_proposed:       { color: 'var(--accent)', label: 'Action' },
  awaiting_approval:     { color: '#f59e0b', label: 'Awaiting' },
  analyst_approved:      { color: 'var(--teal)', label: 'Approved' },
  analyst_rejected:      { color: '#ff2244', label: 'Rejected' },
  response_executed:     { color: 'var(--teal)', label: 'Executed' },
  response_failed:       { color: '#ff2244', label: 'Failed' },
  feedback_received:     { color: '#a855f7', label: 'Feedback' },
  investigation_complete:{ color: 'var(--teal)', label: 'Complete' },
}

const RISK_COLORS = { low: 'var(--teal)', medium: '#f59e0b', high: '#ff2244' }

// ── Sub-components ────────────────────────────────────────────────────────────

function AuditEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const style = AUDIT_STYLES[entry.type] || { color: 'var(--muted)', label: entry.type }

  return (
    <div className="flex gap-3 mb-2">
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${style.color}18`, border: `1px solid ${style.color}40` }}>
          <span style={{ fontSize: 8, color: style.color, fontWeight: 700 }}>
            {style.label.slice(0, 2)}
          </span>
        </div>
        <div className="w-px flex-1 mt-0.5" style={{ background: 'var(--border)' }} />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{ background: `${style.color}15`, color: style.color }}>
            {style.label}
          </span>
          {entry.tool_name && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {entry.tool_name}
            </span>
          )}
          <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
            {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{entry.content}</p>
        {entry.data && (
          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[10px] mt-1"
            style={{ color: 'var(--muted)' }}>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'hide data' : 'show data'}
          </button>
        )}
        {expanded && entry.data && (
          <pre className="text-[10px] font-mono mt-1 p-2 rounded overflow-x-auto max-h-32"
            style={{ background: 'var(--bg)', color: 'var(--teal)', border: '1px solid var(--border)' }}>
            {JSON.stringify(entry.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function ActionCard({ action, onApprove, onReject, loading }) {
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const isPending = action.status === 'pending'
  const riskColor = RISK_COLORS[action.risk_level] || 'var(--muted)'

  function handleConfirmReject() {
    const note = rejectNote.trim() || 'Rejected by analyst'
    onReject(action.id, note)
    setShowReject(false)
  }

  return (
    <div className="rounded overflow-hidden mb-3"
      style={{ border: `1px solid var(--border)`, borderLeft: `3px solid ${riskColor}`, background: 'var(--surface2)' }}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                {action.action_label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                style={{ background: `${riskColor}15`, color: riskColor }}>
                {action.risk_level} risk
              </span>
              {!isPending && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
                  style={{
                    background: action.status === 'approved' ? 'rgba(0,212,170,0.12)' : 'rgba(255,34,68,0.12)',
                    color: action.status === 'approved' ? '#00d4aa' : '#ff2244',
                  }}>
                  {action.status}
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{action.reasoning}</p>
            {action.command && (
              <pre className="text-[10px] font-mono mt-1.5 p-1.5 rounded overflow-x-auto"
                style={{ background: 'var(--bg)', color: 'var(--teal)', border: '1px solid var(--border)' }}>
                {action.command}
              </pre>
            )}
            {action.execution_result && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                {action.execution_result}
              </p>
            )}
          </div>

          {isPending && (
            <div className="flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onApprove(action.id)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-2 rounded text-xs font-semibold touch-manipulation cursor-pointer transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.4)' }}>
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                type="button"
                onClick={() => setShowReject(v => !v)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-2 rounded text-xs font-semibold touch-manipulation cursor-pointer transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                style={{ background: 'rgba(255,34,68,0.12)', color: '#ff2244', border: '1px solid rgba(255,34,68,0.4)' }}>
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}
        </div>

        {showReject && isPending && (
          <div className="mt-3 p-3 rounded border border-red-500/30 bg-red-500/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Confirm Action Rejection
              </span>
              <span className="text-[10px] text-cyber-muted">Reason optional</span>
            </div>
            <input
              type="text"
              className="input text-xs py-2 w-full"
              placeholder="Reason for rejection (e.g. Scheduled test, Internal subnet)..."
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmReject() }}
              autoFocus
            />
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={loading}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all touch-manipulation cursor-pointer shadow-md disabled:opacity-50">
                <XCircle className="w-3.5 h-3.5" />
                {loading ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button
                type="button"
                onClick={() => setShowReject(false)}
                disabled={loading}
                className="px-3.5 py-2.5 rounded text-xs font-medium text-cyber-muted hover:text-cyber-text border border-cyber-border hover:bg-cyber-surface2 transition-all touch-manipulation cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FeedbackPanel({ sessionId, onSubmitted }) {
  const [form, setForm] = useState({
    verdict_correct: null, confidence_accurate: null,
    recommendations_helpful: null, overall_rating: null,
    analyst_comments: '', false_positive: false,
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submitAgentFeedback(sessionId, form)
      onSubmitted()
    } finally { setSubmitting(false) }
  }

  const BoolBtn = ({ field, label, value }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs w-52" style={{ color: 'var(--muted)' }}>{label}</span>
      <div className="flex gap-1">
        {[true, false].map(v => (
          <button key={String(v)} type="button"
            onClick={() => setForm(f => ({ ...f, [field]: v }))}
            className="px-2.5 py-1 rounded text-xs font-medium transition-all"
            style={form[field] === v ? {
              background: v ? 'rgba(0,212,170,0.15)' : 'rgba(255,34,68,0.12)',
              color: v ? '#00d4aa' : '#ff2244',
              border: `1px solid ${v ? 'rgba(0,212,170,0.4)' : 'rgba(255,34,68,0.3)'}`,
            } : { background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
        Close the Feedback Loop
      </p>
      <BoolBtn field="verdict_correct" label="Was the agent verdict correct?" />
      <BoolBtn field="confidence_accurate" label="Was confidence level accurate?" />
      <BoolBtn field="recommendations_helpful" label="Were recommendations helpful?" />
      <BoolBtn field="false_positive" label="Was this a false positive?" value={form.false_positive} />

      <div>
        <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Overall Rating (1-5)</p>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => (
            <button key={n} type="button"
              onClick={() => setForm(f => ({ ...f, overall_rating: n }))}
              className="p-1.5 rounded transition-all"
              style={{ color: form.overall_rating >= n ? '#f59e0b' : 'var(--border)' }}>
              <Star className="w-4 h-4" fill={form.overall_rating >= n ? '#f59e0b' : 'none'} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Comments (optional)</label>
        <textarea className="input resize-none h-14 text-xs"
          placeholder="Any additional comments for the agent..."
          value={form.analyst_comments}
          onChange={e => setForm(f => ({ ...f, analyst_comments: e.target.value }))} />
      </div>

      <button type="submit" disabled={submitting}
        className="btn-primary flex items-center gap-2 text-xs w-full justify-center py-2">
        {submitting ? <Spinner size="sm" /> : <MessageSquare className="w-3.5 h-3.5" />}
        Submit Feedback & Close Loop
      </button>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentInvestigation() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { alert, loading: alertLoading, error: alertError } = useAlert(id)

  const [running, setRunning]       = useState(false)
  const [sessions, setSessions]     = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [error, setError]           = useState('')
  const [activeTab, setActiveTab]   = useState('report')
  const [loading, setLoading]       = useState(false)
  const [approving, setApproving]   = useState(false)
  const autoRanRef                  = useRef(false)

  async function loadSessions() {
    setLoading(true)
    try {
      const data = await getAlertSessions(id)
      setSessions(data)
      if (data.length > 0) setActiveSession(data[0])
      return data
    } catch {
      return []
    } finally {
      setLoading(false)
    }
  }

  async function handleRun() {
    setRunning(true)
    setError('')
    try {
      await startSOCInvestigation(id)
      await loadSessions()
      setActiveTab('report')
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Investigation failed')
    } finally {
      setRunning(false)
    }
  }

  // Automatic investigation: when page loads, if no sessions exist, auto-trigger the Agentic AI investigation!
  useEffect(() => {
    let mounted = true
    async function init() {
      if (!id) return
      setLoading(true)
      try {
        const data = await getAlertSessions(id)
        if (!mounted) return
        setSessions(data)
        if (data.length > 0) {
          setActiveSession(data[0])
        } else if (!autoRanRef.current) {
          autoRanRef.current = true
          handleRun()
        }
      } catch {
        // error loading sessions
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [id])

  async function handleApprove(actionId) {
    setApproving(true)
    try { await approveAgentAction(actionId, ''); await loadSessions() }
    finally { setApproving(false) }
  }

  async function handleReject(actionId, note) {
    setApproving(true)
    try { await rejectAgentAction(actionId, note); await loadSessions() }
    finally { setApproving(false) }
  }

  if (alertLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-mono text-cyber-muted animate-pulse">Loading alert intelligence...</p>
      </div>
    )
  }

  if (alertError || !alert) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 panel">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-500" />
        <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>Alert Not Found</h2>
        <p className="text-xs text-cyber-muted mb-4">{alertError || 'The requested alert could not be loaded.'}</p>
        <button onClick={() => navigate('/alerts')} className="btn-primary text-xs py-2 px-4">
          Back to Alerts
        </button>
      </div>
    )
  }

  const s = activeSession
  const report = s?.investigation_report
  const trail  = s?.audit_trail || []
  const actions = s?.pending_actions || []
  const pendingCount = actions.filter(a => a.status === 'pending').length

  return (
    <div className="p-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate(`/alerts/${id}`)} className="btn-ghost p-2 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>SOC Agent Investigation</h1>
            {pendingCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded font-bold animate-pulse"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                {pendingCount} awaiting approval
              </span>
            )}
          </div>
          <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            Alert #{alert.id} · {formatAlertType(alert.alert_type)} · {alert.source_ip || 'N/A'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadSessions} className="btn-ghost p-2"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={handleRun} disabled={running}
            className="btn-primary flex items-center gap-2 text-xs py-2">
            {running ? <Spinner size="sm" /> : <Play className="w-4 h-4" />}
            {running ? 'Investigating...' : sessions.length > 0 ? 'Re-investigate' : 'Start Investigation'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded mb-4 text-sm"
          style={{ background: 'rgba(255,34,68,0.08)', border: '1px solid rgba(255,34,68,0.3)', color: '#ff2244' }}>
          {error}
        </div>
      )}

      {/* Pipeline diagram */}
      {!s && !running && (
        <div className="panel mb-5">
          <p className="section-title">Investigation Pipeline</p>
          <div className="flex items-center gap-1 flex-wrap text-xs font-mono">
            {[
              'Raw Alert', '→', 'Agent Loop', '→', 'Guardrails', '→',
              'Human Approval', '→', 'Safe Response', '→', 'Feedback Loop'
            ].map((step, i) => (
              <span key={i} style={{ color: step === '→' ? 'var(--muted)' : 'var(--teal)' }}>
                {step}
              </span>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Read-only investigation is automatic. State-changing actions require your approval before execution.
            Every step is recorded in the complete audit trail.
          </p>
          <button onClick={handleRun} disabled={running}
            className="btn-primary flex items-center gap-2 text-sm mt-4 w-full justify-center py-2.5">
            <Play className="w-4 h-4" /> Start Autonomous SOC Investigation
          </button>
        </div>
      )}

      {running && (
        <div className="panel mb-5 text-center py-10">
          <Bot className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Agent investigating...</p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Running investigation loop → applying guardrails → proposing actions
          </p>
          <Spinner size="lg" className="mx-auto" />
        </div>
      )}

      {/* Session selector */}
      {sessions.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {sessions.map((sess, i) => (
            <button key={sess.id}
              onClick={() => setActiveSession(sess)}
              className="text-xs px-3 py-1.5 rounded transition-all"
              style={activeSession?.id === sess.id ? {
                background: 'rgba(255,107,53,0.12)', color: 'var(--accent)',
                border: '1px solid rgba(255,107,53,0.3)',
              } : { background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              Investigation {sessions.length - i} — {sess.confidence_label}
            </button>
          ))}
        </div>
      )}

      {s && (
        <>
          {/* Summary bar */}
          <div className="panel mb-4" style={{ borderLeft: `3px solid ${riskColor(alert.risk_level)}` }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded font-mono"
                    style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
                    Agentic AI Assistant
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                    Iteration {s.iteration}
                  </span>
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>{s.verdict}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Phase: <span className="font-semibold uppercase text-[11px]" style={{ color: s.phase === 'awaiting_approval' ? '#f59e0b' : 'var(--teal)' }}>
                    {s.phase.replace('_', ' ')}
                  </span>
                </p>
              </div>

              {/* Rule Engine Risk Authority Box */}
              <div className="flex items-center gap-3 shrink-0 p-3 rounded"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end mb-1">
                    <span className="text-[10px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0, 229, 153, 0.12)', color: 'var(--accent)', border: '1px solid rgba(0, 229, 153, 0.3)' }}>
                      Rule Engine
                    </span>
                    <RiskBadge level={alert.risk_level} />
                  </div>
                  <p className="text-2xl font-black leading-none" style={{ color: riskColor(alert.risk_level) }}>
                    {Math.round(alert.risk_score)}
                    <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>/100</span>
                  </p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--muted)' }}>
                    Deterministic Baseline
                  </p>
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--muted)' }}>Agent Confidence in Evidence</span>
                <span className="font-bold" style={{ color: 'var(--teal)' }}>
                  {s.confidence_label} ({s.confidence_score}%)
                </span>
              </div>
              <div className="h-1.5 rounded overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${s.confidence_score}%`,
                    background: s.confidence_label === 'HIGH' ? 'var(--teal)' : s.confidence_label === 'MEDIUM' ? '#f59e0b' : 'var(--muted)',
                  }} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-strip mb-4">
            {[
              { id: 'report',   label: 'Investigation Report' },
              { id: 'approval', label: `Approval Queue (${pendingCount})`, badge: pendingCount > 0 },
              { id: 'trail',    label: `Audit Trail (${trail.length} entries)` },
              { id: 'feedback', label: 'Feedback Loop' },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`tab-item ${activeTab === t.id ? 'active' : ''}`}>
                {t.label}
                {t.badge && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Report tab */}
          {activeTab === 'report' && report && (
            <div className="space-y-4">
              {/* Deterministic Rule Engine Authority Panel */}
              <div className="panel" style={{ borderLeft: '3px solid var(--accent)' }}>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    <p className="section-title mb-0">Deterministic Rule Engine Evaluation</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold"
                    style={{ background: 'rgba(0, 229, 153, 0.12)', color: 'var(--accent)', border: '1px solid rgba(0, 229, 153, 0.3)' }}>
                    Immutable Rule Authority
                  </span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  Risk score (<strong style={{ color: 'var(--text)' }}>{Math.round(alert.risk_score)}/100 · {alert.risk_level}</strong>) is strictly calculated by AEGIS's heuristic <span style={{ color: 'var(--accent)' }}>RuleEngine</span>. The Agentic AI does <strong>NOT</strong> modify or lead the risk score—its role is autonomous evidence correlation, threat verification, timeline building, and proposing human-approved responses.
                </p>
                <div className="mb-3">
                  <RiskScoreBar score={alert.risk_score} level={alert.risk_level} />
                </div>
                {alert.risk_factors && alert.risk_factors.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>
                      Evaluated Rule Factors ({alert.risk_factors.length})
                    </p>
                    <div className="space-y-1.5">
                      {alert.risk_factors.map((rf, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 rounded"
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: riskColor(alert.risk_level) }} />
                            <span style={{ color: 'var(--text)' }}>{rf.description}</span>
                          </div>
                          <span className="font-mono font-bold shrink-0" style={{ color: riskColor(alert.risk_level) }}>
                            +{rf.score_delta}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="panel">
                <p className="section-title">Summary</p>
                <p className="text-sm" style={{ color: 'var(--text)' }}>{report.summary}</p>
              </div>
              <div className="panel">
                <p className="section-title">Confirmed Evidence</p>
                <pre className="text-xs font-mono whitespace-pre-wrap"
                  style={{ color: 'var(--text)' }}>{report.evidence_summary}</pre>
              </div>
              {report.key_findings?.length > 0 && (
                <div className="panel">
                  <p className="section-title">Key Findings ({report.key_findings.length})</p>
                  <ul className="space-y-1.5">
                    {report.key_findings.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span style={{ color: 'var(--teal)' }}>•</span>
                        <span style={{ color: 'var(--text)' }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.cves_found?.length > 0 && (
                <div className="panel">
                  <p className="section-title">CVEs & Weaknesses</p>
                  {report.cves_found.map((cve, i) => (
                    <div key={i} className="mb-2 p-2.5 rounded"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)' }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono font-bold" style={{ color: 'var(--accent)' }}>{cve.cve}</span>
                        <span className="text-[10px] font-bold" style={{ color: cve.severity === 'CRITICAL' ? '#ff2244' : 'var(--accent)' }}>
                          {cve.severity}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{cve.description}</p>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--teal)' }}>Fix: {cve.mitigation}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Related Alerts',   value: String(report.related_alerts || 0) },
                  { label: 'Actions Proposed', value: String(report.actions_proposed || 0) },
                  { label: 'Need Approval',    value: String(report.actions_requiring_approval || 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="panel text-center py-3">
                    <p className="text-lg font-black" style={{ color: 'var(--accent)' }}>{value}</p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval queue tab */}
          {activeTab === 'approval' && (
            <div>
              {actions.length === 0 ? (
                <div className="panel text-center py-8">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>No actions in queue.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-3 rounded mb-4"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderLeft: '3px solid #f59e0b' }}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                    <p className="text-xs" style={{ color: 'var(--text)' }}>
                      <span className="font-bold">Human Approval Required.</span>{' '}
                      The agent proposes these actions based on evidence. Review each one carefully.
                      Read-only actions (monitoring, forensics) were already executed automatically.
                      All other actions require your explicit approval.
                    </p>
                  </div>
                  {actions.map(a => (
                    <ActionCard key={a.id} action={a}
                      onApprove={handleApprove} onReject={handleReject}
                      loading={approving} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Audit trail tab */}
          {activeTab === 'trail' && (
            <div className="panel">
              <p className="section-title mb-4">Complete Audit Trail — Every Agent Step</p>
              <div className="space-y-0 max-h-[600px] overflow-y-auto pr-1">
                {trail.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>No audit trail yet.</p>
                ) : trail.map((entry, i) => (
                  <AuditEntry key={i} entry={entry} />
                ))}
              </div>
            </div>
          )}

          {/* Feedback tab */}
          {activeTab === 'feedback' && (
            <div className="panel">
              {s.feedback?.length > 0 ? (
                <div>
                  <p className="section-title">Feedback Recorded — Loop Closed</p>
                  {s.feedback.map((f, i) => (
                    <div key={i} className="space-y-1.5 text-xs">
                      {f.overall_rating && (
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className="w-4 h-4"
                              style={{ color: f.overall_rating >= n ? '#f59e0b' : 'var(--border)' }}
                              fill={f.overall_rating >= n ? '#f59e0b' : 'none'} />
                          ))}
                        </div>
                      )}
                      {f.analyst_comments && (
                        <p style={{ color: 'var(--text)' }}>"{f.analyst_comments}"</p>
                      )}
                      {f.false_positive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{ background: 'rgba(255,34,68,0.12)', color: '#ff2244' }}>
                          Marked as false positive
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <FeedbackPanel sessionId={s.id} onSubmitted={loadSessions} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
