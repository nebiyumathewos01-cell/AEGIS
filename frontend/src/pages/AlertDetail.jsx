import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Cpu, FileText, ShieldCheck, AlertTriangle,
  CheckCircle, BookOpen, Send, Download, RefreshCw
} from 'lucide-react'
import { useAlert } from '../hooks/useAlert'
import RiskBadge from '../components/RiskBadge'
import RiskScoreBar from '../components/RiskScoreBar'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { analyzeAlert, updateAlertStatus, addNote } from '../services/api'
import { fmtDate, fmtTime } from '../utils/format'
import { formatAlertType, riskColor } from '../utils/risk'
// generatePDF imported via Reports page — see /reports/:id route

const STATUSES = ['new', 'investigating', 'confirmed', 'false_positive', 'resolved']
const STATUS_LABELS = {
  new: 'New', investigating: 'Investigating', confirmed: 'Confirmed',
  false_positive: 'False Positive', resolved: 'Resolved',
}

/* ── small section wrapper ── */
function Section({ icon: Icon, title, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyber-border">
        <Icon className="w-4 h-4 text-cyber-accent" />
        <span className="font-semibold text-sm text-cyber-text">{title}</span>
      </div>
      {children}
    </div>
  )
}

/* ── evidence KV rows ── */
function EvidenceRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-cyber-border/30 last:border-0">
      <span className="text-xs text-cyber-muted w-40 shrink-0">{label}</span>
      <span className="text-xs font-mono text-cyber-text break-all">{String(value)}</span>
    </div>
  )
}

export default function AlertDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { alert, loading, error, refresh } = useAlert(id)

  const [analyzing, setAnalyzing] = useState(false)
  const [noteText, setNoteText]   = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
  if (error)   return <div className="p-6 text-risk-high">{error}</div>
  if (!alert)  return null

  const pd = alert.parsed_data ?? {}
  const riskFactors = alert.risk_factors ?? []
  const analysis = alert.analysis

  /* ── timeline from raw log ── */
  const timelineLines = alert.raw_alert
    .split('\n')
    .filter(l => l.trim())
    .slice(0, 20)

  async function handleAnalyze() {
    setAnalyzing(true)
    try {
      await analyzeAlert(id)
      await refresh()
    } finally {
      setAnalyzing(false)
    }
  }

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

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate('/alerts')} className="btn-ghost p-2 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-cyber-text">{formatAlertType(alert.alert_type)}</h1>
            <RiskBadge level={alert.risk_level} />
            <StatusBadge status={alert.status} />
          </div>
          <p className="text-xs text-cyber-muted mt-0.5">
            Alert #{alert.id} · {fmtDate(alert.created_at)} · Source: <span className="uppercase">{alert.source}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-1.5 text-sm"
            onClick={() => navigate(`/reports/${id}`)}
          >
            <Download className="w-3.5 h-3.5" /> Report
          </button>
          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? <Spinner size="sm" /> : <Cpu className="w-4 h-4" />}
            {analysis ? 'Re-Analyze' : 'Analyze'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Alert Info */}
          <Section icon={FileText} title="Alert Information">
            <div className="grid grid-cols-2 gap-x-6">
              <EvidenceRow label="Alert Type"      value={formatAlertType(alert.alert_type)} />
              <EvidenceRow label="Source"          value={alert.source?.toUpperCase()} />
              <EvidenceRow label="Source IP"       value={alert.source_ip} />
              <EvidenceRow label="Destination IP"  value={alert.destination_ip} />
              <EvidenceRow label="Protocol"        value={alert.protocol} />
              <EvidenceRow label="Dest Port"       value={alert.destination_port} />
              <EvidenceRow label="Username"        value={alert.username} />
              <EvidenceRow label="Attempt Count"   value={alert.attempt_count} />
              <EvidenceRow label="Timestamp"       value={fmtDate(alert.timestamp)} />
              <EvidenceRow label="Status"          value={STATUS_LABELS[alert.status]} />
            </div>
          </Section>

          {/* Extracted Evidence */}
          {Object.keys(pd).length > 0 && (
            <Section icon={FileText} title="Extracted Evidence">
              <div className="space-y-0">
                {Object.entries(pd)
                  .filter(([, v]) => v !== null && v !== undefined && v !== '' && !Array.isArray(v))
                  .map(([k, v]) => (
                    <EvidenceRow key={k} label={k.replace(/_/g, ' ')} value={v} />
                  ))}
                {/* open_ports detail */}
                {pd.open_ports?.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-cyber-muted mb-1.5">Open Ports</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pd.open_ports.map(p => (
                        <span
                          key={p.port}
                          className={`font-mono text-xs px-2 py-0.5 rounded border ${
                            p.sensitive
                              ? 'border-risk-high/50 text-risk-high bg-red-950/30'
                              : 'border-cyber-border text-cyber-muted'
                          }`}
                        >
                          {p.port}/{p.protocol} {p.sensitive ? `(${p.service_name})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* AI Analysis */}
          {analysis ? (
            <Section icon={Cpu} title={`AI Analysis ${analysis.is_ai_generated ? '· ' + analysis.ai_model : '· Rule-Based'}`}>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-cyber-muted mb-1">Summary</p>
                  <p className="text-sm text-cyber-text">{analysis.summary}</p>
                </div>
                <div>
                  <p className="text-xs text-cyber-muted mb-1">Threat Interpretation</p>
                  <p className="text-sm text-cyber-text leading-relaxed">{analysis.threat_interpretation}</p>
                </div>
                <div>
                  <p className="text-xs text-cyber-muted mb-1">Confirmed Evidence</p>
                  <pre className="text-xs text-cyber-text bg-cyber-bg rounded p-3 whitespace-pre-wrap leading-relaxed">
                    {analysis.evidence}
                  </pre>
                </div>
                <div>
                  <p className="text-xs text-cyber-muted mb-1">Risk Explanation</p>
                  <p className="text-sm text-cyber-text">{analysis.risk_explanation}</p>
                </div>
                {analysis.recommendations?.length > 0 && (
                  <div>
                    <p className="text-xs text-cyber-muted mb-2">Recommended Investigation Steps</p>
                    <ol className="space-y-1.5">
                      {analysis.recommendations.map((r, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-cyber-text">
                          <span className="text-cyber-accent font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </Section>
          ) : (
            <div className="card border-dashed border-cyber-border text-center py-8">
              <Cpu className="w-8 h-8 text-cyber-muted mx-auto mb-2" />
              <p className="text-sm text-cyber-muted">No analysis yet.</p>
              <button className="btn-primary text-sm mt-3" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? 'Analyzing…' : 'Run AI Analysis'}
              </button>
            </div>
          )}

          {/* Raw Alert */}
          <Section icon={FileText} title="Raw Alert Log">
            <pre className="text-xs font-mono text-cyber-text bg-cyber-bg rounded p-3 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
              {alert.raw_alert}
            </pre>
          </Section>

          {/* Timeline */}
          {timelineLines.length > 1 && (
            <Section icon={BookOpen} title="Event Timeline">
              <div className="space-y-1">
                {timelineLines.map((line, i) => {
                  const timeMatch = line.match(/\d{2}:\d{2}:\d{2}/)
                  return (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <span className="font-mono text-cyber-accent w-20 shrink-0">
                        {timeMatch ? timeMatch[0] : `#${i + 1}`}
                      </span>
                      <span className="text-cyber-text leading-relaxed">{line.trim()}</span>
                    </div>
                  )
                })}
                {alert.raw_alert.split('\n').filter(l => l.trim()).length > 20 && (
                  <p className="text-xs text-cyber-muted pt-1">… and more events in the raw log.</p>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Risk Score */}
          <Section icon={AlertTriangle} title="Risk Score">
            <RiskScoreBar score={alert.risk_score} level={alert.risk_level} />
            <div className="mt-4 space-y-2">
              {riskFactors.map((f, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-cyber-text leading-relaxed">{f.description}</span>
                  <span
                    className="shrink-0 font-mono font-semibold"
                    style={{ color: riskColor(alert.risk_level) }}
                  >
                    +{f.score_delta}
                  </span>
                </div>
              ))}
              {riskFactors.length === 0 && (
                <p className="text-xs text-cyber-muted">No specific factors recorded.</p>
              )}
            </div>
          </Section>

          {/* Status change */}
          <Section icon={CheckCircle} title="Alert Status">
            <div className="space-y-1.5">
              {STATUSES.map(s => (
                <button
                  key={s}
                  disabled={alert.status === s || statusChanging}
                  onClick={() => handleStatus(s)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${
                    alert.status === s
                      ? 'bg-cyber-accent/10 text-cyber-accent border border-cyber-accent/30 font-medium'
                      : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-border/50'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </Section>

          {/* Notes */}
          <Section icon={BookOpen} title="Analyst Notes">
            <div className="space-y-3 mb-3 max-h-64 overflow-y-auto">
              {alert.notes?.length === 0 && (
                <p className="text-xs text-cyber-muted">No notes yet.</p>
              )}
              {alert.notes?.map(n => (
                <div key={n.id} className="text-xs bg-cyber-bg rounded p-2.5 border border-cyber-border/50">
                  <p className="text-cyber-text leading-relaxed">{n.note}</p>
                  <p className="text-cyber-muted mt-1.5">{n.analyst} · {fmtDate(n.created_at)}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                className="input resize-none h-20 text-xs"
                placeholder="Add investigation note…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <button
                type="submit"
                disabled={!noteText.trim() || submittingNote}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
              >
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
