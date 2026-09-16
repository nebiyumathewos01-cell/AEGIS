import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Cpu, FileText, Shield, AlertTriangle,
  CheckCircle, BookOpen, Send, Download, Bot
} from 'lucide-react'
import { useAlert } from '../hooks/useAlert'
import RiskBadge from '../components/RiskBadge'
import RiskScoreBar from '../components/RiskScoreBar'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import PlaybookPanel from '../components/PlaybookPanel'
import { getAlertSessions, updateAlertStatus, addNote } from '../services/api'
import { fmtDate } from '../utils/format'
import { formatAlertType, riskColor } from '../utils/risk'

const STATUSES = ['new', 'investigating', 'confirmed', 'false_positive', 'resolved']
const STATUS_LABELS = {
  new: 'New', investigating: 'Investigating', confirmed: 'Confirmed',
  false_positive: 'False Positive', resolved: 'Resolved',
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 mb-4 pb-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function EvidenceRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-1.5"
      style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs w-40 shrink-0" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-xs font-mono break-all" style={{ color: 'var(--text)' }}>{String(value)}</span>
    </div>
  )
}

export default function AlertDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { alert, loading, error, refresh } = useAlert(id)

  const [agentSession, setAgentSession]     = useState(null)
  const [noteText, setNoteText]             = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)

  useEffect(() => {
    if (id) {
      getAlertSessions(id).then(sessions => {
        if (sessions && sessions.length > 0) setAgentSession(sessions[0])
      }).catch(() => {})
    }
  }, [id])

  async function handleStatus(newStatus) {
    setStatusChanging(true)
    try {
      await updateAlertStatus(id, newStatus)
      await refresh()
    } finally {
      setStatusChanging(false)
    }
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    setSubmittingNote(true)
    try {
      await addNote(id, { note: noteText.trim(), analyst: 'Analyst' })
      setNoteText('')
      await refresh()
    } finally {
      setSubmittingNote(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
  if (error)   return <div className="p-6" style={{ color: '#ff2244' }}>{error}</div>
  if (!alert)  return null

  const pd          = alert.parsed_data ?? {}
  const riskFactors = alert.risk_factors ?? []
  const analysis    = alert.analysis
  const timelineLines = alert.raw_alert.split('\n').filter(l => l.trim()).slice(0, 20)

  return (
    <div className="p-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start gap-3 mb-5 pb-4"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate('/alerts')} className="btn-ghost p-2 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {formatAlertType(alert.alert_type)}
            </h1>
            <RiskBadge level={alert.risk_level} />
            <StatusBadge status={alert.status} />
          </div>
          <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            Alert #{alert.id} · {fmtDate(alert.created_at)} · Source:{' '}
            <span className="uppercase">{alert.source}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary flex items-center gap-1.5 text-xs"
            onClick={() => navigate(`/reports/${id}`)}>
            <Download className="w-3.5 h-3.5" /> Report
          </button>
          <button className="btn-primary flex items-center gap-2 text-xs py-2 px-3.5 font-semibold shadow-md"
            onClick={() => navigate(`/agent/${id}`)}>
            <Bot className="w-4 h-4" />
            {agentSession ? 'Open Agent Workspace' : 'Launch Agent Investigation'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Alert Info */}
          <Section icon={FileText} title="Alert Information">
            <div className="grid grid-cols-2 gap-x-4">
              <EvidenceRow label="Alert Type"     value={formatAlertType(alert.alert_type)} />
              <EvidenceRow label="Source"         value={alert.source && alert.source.toUpperCase()} />
              <EvidenceRow label="Source IP"      value={alert.source_ip} />
              <EvidenceRow label="Destination IP" value={alert.destination_ip} />
              <EvidenceRow label="Protocol"       value={alert.protocol} />
              <EvidenceRow label="Dest Port"      value={alert.destination_port} />
              <EvidenceRow label="Username"       value={alert.username} />
              <EvidenceRow label="Attempt Count"  value={alert.attempt_count} />
              <EvidenceRow label="Timestamp"      value={fmtDate(alert.timestamp)} />
            </div>
          </Section>

          {/* Extracted Evidence */}
          {Object.keys(pd).length > 0 && (
            <Section icon={FileText} title="Extracted Evidence">
              {Object.entries(pd)
                .filter(([, v]) => v !== null && v !== undefined && v !== '' && !Array.isArray(v))
                .map(([k, v]) => (
                  <EvidenceRow key={k} label={k.replace(/_/g, ' ')} value={v} />
                ))}
              {pd.open_ports && pd.open_ports.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>Open Ports</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pd.open_ports.map(p => (
                      <span key={p.port} className="font-mono text-xs px-2 py-0.5 rounded"
                        style={{
                          border: `1px solid ${p.sensitive ? 'rgba(255,34,68,0.4)' : 'var(--border)'}`,
                          color: p.sensitive ? '#ff2244' : 'var(--muted)',
                          background: p.sensitive ? 'rgba(255,34,68,0.08)' : 'var(--surface2)',
                        }}>
                        {p.port}/{p.protocol}{p.sensitive ? ` (${p.service_name})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Agentic AI SOC Investigation */}
          <Section icon={Bot} title="Agentic AI SOC Investigation">
            {agentSession ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--muted)' }}>
                      Agent Verdict
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {agentSession.verdict || 'Investigation Complete'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--muted)' }}>
                      Confidence
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                      style={{
                        background: agentSession.confidence_label === 'HIGH' ? 'rgba(0,212,170,0.15)' : 'rgba(245,158,11,0.15)',
                        color: agentSession.confidence_label === 'HIGH' ? '#00d4aa' : '#f59e0b',
                      }}>
                      {agentSession.confidence_label} ({agentSession.confidence_score}%)
                    </span>
                  </div>
                </div>

                {agentSession.evidence_summary && (
                  <div>
                    <p className="text-xs mb-1.5 font-semibold" style={{ color: 'var(--muted)' }}>Autonomous Evidence Summary</p>
                    <div className="p-3 rounded text-xs font-mono leading-relaxed whitespace-pre-line"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                      {agentSession.evidence_summary}
                    </div>
                  </div>
                )}

                {agentSession.pending_actions && agentSession.pending_actions.length > 0 && (
                  <div>
                    <p className="text-xs mb-1.5 font-semibold" style={{ color: 'var(--muted)' }}>
                      Proposed Safe Actions ({agentSession.pending_actions.length})
                    </p>
                    <div className="space-y-2">
                      {agentSession.pending_actions.map(act => (
                        <div key={act.id} className="p-2.5 rounded flex items-center justify-between text-xs"
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          <div>
                            <span className="font-semibold" style={{ color: 'var(--text)' }}>{act.action_label}</span>
                            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{act.reasoning}</p>
                          </div>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold"
                            style={{
                              background: act.status === 'approved' ? 'rgba(0,212,170,0.15)' : act.status === 'rejected' ? 'rgba(255,34,68,0.15)' : 'rgba(245,158,11,0.15)',
                              color: act.status === 'approved' ? '#00d4aa' : act.status === 'rejected' ? '#ff2244' : '#f59e0b',
                            }}>
                            {act.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/agent/${id}`)}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-xs py-2.5 shadow">
                    <Bot className="w-4 h-4" /> Open Full Agent Workspace & Complete Audit Trail
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Bot className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Autonomous Agentic Investigation</p>
                <p className="text-xs mb-4 max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
                  The Agentic AI SOC Assistant correlates related alerts, queries threat intelligence, traces event timelines, and verifies CVE vulnerabilities.
                </p>
                <button
                  type="button"
                  className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2 mx-auto"
                  onClick={() => navigate(`/agent/${id}`)}>
                  <Bot className="w-4 h-4" /> Launch Autonomous Agentic AI Investigation
                </button>
              </div>
            )}
          </Section>

          {/* Playbook */}
          <Section icon={Shield} title="Automated Response Playbook">
            <PlaybookPanel alertId={id} />
          </Section>

          {/* Raw log */}
          <Section icon={FileText} title="Raw Alert Log">
            <pre className="text-xs font-mono rounded p-3 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed"
              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              {alert.raw_alert}
            </pre>
          </Section>

          {/* Timeline */}
          {timelineLines.length > 1 && (
            <Section icon={BookOpen} title="Event Timeline">
              <div className="space-y-1">
                {timelineLines.map((line, i) => {
                  const t = line.match(/\d{2}:\d{2}:\d{2}/)
                  return (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <span className="font-mono w-20 shrink-0" style={{ color: 'var(--teal)' }}>
                        {t ? t[0] : `#${i + 1}`}
                      </span>
                      <span style={{ color: 'var(--text)' }}>{line.trim()}</span>
                    </div>
                  )
                })}
                {alert.raw_alert.split('\n').filter(l => l.trim()).length > 20 && (
                  <p className="text-xs pt-1" style={{ color: 'var(--muted)' }}>
                    More events in raw log above.
                  </p>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Risk Score */}
          <Section icon={Shield} title="Rule Engine Risk Score">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold"
                style={{ background: 'rgba(0, 229, 153, 0.12)', color: 'var(--accent)', border: '1px solid rgba(0, 229, 153, 0.3)' }}>
                Deterministic Rule Authority
              </span>
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Unchanged by AI</span>
            </div>
            <RiskScoreBar score={alert.risk_score} level={alert.risk_level} />
            <div className="mt-4 space-y-2">
              {riskFactors.map((f, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs">
                  <span style={{ color: 'var(--text)' }}>{f.description}</span>
                  <span className="font-mono font-bold shrink-0"
                    style={{ color: riskColor(alert.risk_level) }}>
                    +{f.score_delta}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Status */}
          <Section icon={CheckCircle} title="Alert Status">
            <div className="space-y-1.5">
              {STATUSES.map(s => (
                <button key={s} disabled={alert.status === s || statusChanging}
                  onClick={() => handleStatus(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded transition-all"
                  style={alert.status === s ? {
                    background: 'rgba(255,107,53,0.1)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(255,107,53,0.3)',
                    fontWeight: 600,
                  } : { color: 'var(--muted)', border: '1px solid transparent' }}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </Section>

          {/* Notes */}
          <Section icon={BookOpen} title="Analyst Notes">
            <div className="space-y-2.5 mb-3 max-h-64 overflow-y-auto">
              {(!alert.notes || alert.notes.length === 0) && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>No notes yet.</p>
              )}
              {alert.notes && alert.notes.map(n => (
                <div key={n.id} className="text-xs rounded p-2.5"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderLeft: '2px solid var(--accent)',
                  }}>
                  <p style={{ color: 'var(--text)' }}>{n.note}</p>
                  <p className="mt-1" style={{ color: 'var(--muted)' }}>
                    {n.analyst} · {fmtDate(n.created_at)}
                  </p>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea className="input resize-none h-16 text-xs"
                placeholder="Add investigation note..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)} />
              <button type="submit"
                disabled={!noteText.trim() || submittingNote}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-xs">
                {submittingNote ? <Spinner size="sm" /> : <Send className="w-3.5 h-3.5" />}
                Add Note
              </button>
            </form>
          </Section>
        </div>
      </div>
    </div>
  )
}
