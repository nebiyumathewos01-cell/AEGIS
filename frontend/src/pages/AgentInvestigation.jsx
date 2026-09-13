import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Bot, ArrowLeft, Play, CheckCircle, Search,
  Shield, Clock, AlertTriangle, Brain,
  ChevronDown, ChevronUp, Cpu, Target, FileSearch
} from 'lucide-react'
import { useAlert } from '../hooks/useAlert'
import { runAgentInvestigation } from '../services/api'
import Spinner from '../components/Spinner'
import RiskBadge from '../components/RiskBadge'
import { formatAlertType, riskColor } from '../utils/risk'
import { fmtDate } from '../utils/format'

// ── Step action styles ────────────────────────────────────────────────────────
const ACTION_STYLES = {
  thinking:    { icon: Brain,      color: '#a855f7', label: 'Thinking'    },
  tool_call:   { icon: Cpu,        color: 'var(--accent)', label: 'Tool Call' },
  observation: { icon: Search,     color: 'var(--teal)', label: 'Observation' },
  decision:    { icon: Target,     color: '#f59e0b', label: 'Decision'    },
  conclusion:  { icon: CheckCircle,color: '#00d4aa', label: 'Conclusion'  },
}

const TOOL_ICONS = {
  search_related_alerts: FileSearch,
  threat_intelligence:   Shield,
  build_timeline:        Clock,
  cve_lookup:            AlertTriangle,
  evaluate_risk:         Target,
  final_assessment:      CheckCircle,
}

function StepCard({ step, index }) {
  const [expanded, setExpanded] = useState(false)
  const meta = ACTION_STYLES[step.action] || ACTION_STYLES.thinking
  const Icon = step.tool_name ? (TOOL_ICONS[step.tool_name] || Cpu) : meta.icon

  return (
    <div className="flex gap-3 group">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10"
          style={{ background: `${meta.color}18`, border: `2px solid ${meta.color}50` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
        </div>
        <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)' }} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: `${meta.color}15`, color: meta.color }}>
            {meta.label}
          </span>
          {step.tool_name && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {step.tool_name}
            </span>
          )}
          <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
            Step {step.step_number}
          </span>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
          {step.reasoning}
        </p>

        {/* Expandable result */}
        {step.result && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[10px] transition-colors"
              style={{ color: 'var(--muted)' }}>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide data' : 'Show data'}
            </button>
            {expanded && (
              <pre className="mt-1.5 text-[10px] font-mono p-2.5 rounded overflow-x-auto max-h-48"
                style={{ background: 'var(--bg)', color: 'var(--teal)', border: '1px solid var(--border)' }}>
                {JSON.stringify(step.result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ConfidenceMeter({ score, label }) {
  const color = score >= 80 ? '#00d4aa' : score >= 60 ? '#f59e0b' : '#ff6b35'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span style={{ color: 'var(--muted)' }}>Confidence</span>
        <span className="font-bold" style={{ color }}>{label} ({score}%)</span>
      </div>
      <div className="h-2 rounded" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded transition-all duration-700"
          style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

export default function AgentInvestigation() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { alert, loading: alertLoading } = useAlert(id)

  const [running, setRunning]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [activeTab, setActiveTab] = useState('steps') // steps | report | findings

  async function handleRun() {
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await runAgentInvestigation(id)
      setResult(res)
      setActiveTab('report')
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Agent investigation failed')
    } finally {
      setRunning(false)
    }
  }

  if (alertLoading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
  if (!alert) return null

  const report = result?.investigation_report
  const assessment = result?.final_assessment

  return (
    <div className="p-5 max-w-4xl">

      {/* Header */}
      <div className="flex items-start gap-3 mb-5 pb-4"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate(`/alerts/${id}`)} className="btn-ghost p-2 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              AEGIS Agent Investigation
            </h1>
          </div>
          <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            Alert #{alert.id} · {formatAlertType(alert.alert_type)} · {alert.source_ip || 'N/A'}
          </p>
        </div>
        <RiskBadge level={alert.risk_level} />
      </div>

      {/* What the agent does — info box */}
      {!result && !running && (
        <div className="panel-teal mb-5">
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--teal)' }} />
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Autonomous Investigation — What the agent does:
              </p>
              <ol className="space-y-1 text-xs" style={{ color: 'var(--muted)' }}>
                {[
                  'Reads and understands the alert context',
                  'Decides which investigation tools to use',
                  'Searches for related past alerts from the same source',
                  'Checks threat intelligence for the source IP',
                  'Builds a chronological attack timeline',
                  'Looks up relevant CVEs and known vulnerabilities',
                  'Re-evaluates risk score with all gathered evidence',
                  'Decides if more investigation is needed — loops if necessary',
                  'Synthesizes all findings into a final investigation report',
                ].map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono font-bold shrink-0" style={{ color: 'var(--accent)' }}>
                      {i + 1}.
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <button onClick={handleRun} disabled={running}
            className="btn-primary flex items-center gap-2 mt-4 w-full justify-center py-3">
            <Play className="w-4 h-4" />
            Start Autonomous Investigation
          </button>
        </div>
      )}

      {/* Running indicator */}
      {running && (
        <div className="panel mb-5 text-center py-10">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Bot className="w-12 h-12" style={{ color: 'var(--accent)' }} />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-risk-low animate-ping" />
            </div>
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>
            Agent is investigating...
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Running autonomous multi-step security investigation
          </p>
          <Spinner size="lg" className="mx-auto" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded mb-4 text-sm"
          style={{ background: 'rgba(255,34,68,0.08)', border: '1px solid rgba(255,34,68,0.3)', color: '#ff2244' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div className="panel mb-5"
            style={{ borderLeft: `3px solid ${riskColor(report?.final_risk_level)}` }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
                  {report?.verdict}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {result.total_steps} investigation steps ·{' '}
                  {report?.tools_used?.length || 0} tools used ·{' '}
                  {report?.related_alerts || 0} related alerts found
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <RiskBadge level={report?.final_risk_level} />
                <span className="text-2xl font-black"
                  style={{ color: riskColor(report?.final_risk_level) }}>
                  {Math.round(report?.final_risk_score || 0)}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <ConfidenceMeter
                score={report?.confidence_score || 50}
                label={report?.confidence || 'MEDIUM'}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-strip mb-4">
            {[
              { id: 'report',   label: 'Investigation Report' },
              { id: 'steps',    label: `Reasoning Chain (${result.steps?.length} steps)` },
              { id: 'findings', label: 'Key Findings' },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`tab-item ${activeTab === t.id ? 'active' : ''}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Report tab */}
          {activeTab === 'report' && report && (
            <div className="space-y-4">
              <div className="panel">
                <p className="section-title">Summary</p>
                <p className="text-sm" style={{ color: 'var(--text)' }}>{report.summary}</p>
              </div>

              <div className="panel">
                <p className="section-title">Confirmed Evidence</p>
                <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed"
                  style={{ color: 'var(--text)' }}>{report.evidence}</pre>
              </div>

              {report.key_findings?.length > 0 && (
                <div className="panel">
                  <p className="section-title">Key Findings ({report.key_findings.length})</p>
                  <ul className="space-y-1.5">
                    {report.key_findings.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="shrink-0 mt-0.5" style={{ color: 'var(--teal)' }}>•</span>
                        <span style={{ color: 'var(--text)' }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.recommendations?.length > 0 && (
                <div className="panel">
                  <p className="section-title">Recommended Actions</p>
                  <ol className="space-y-2">
                    {report.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2.5 text-sm">
                        <span className="font-mono font-bold shrink-0"
                          style={{ color: 'var(--accent)' }}>{i + 1}.</span>
                        <span style={{ color: 'var(--text)' }}>{r}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {report.cves_found?.length > 0 && (
                <div className="panel">
                  <p className="section-title">Relevant CVEs & Weaknesses</p>
                  <div className="space-y-3">
                    {report.cves_found.map((cve, i) => (
                      <div key={i} className="p-3 rounded"
                        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderLeft: '3px solid #ff6b35' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold" style={{ color: 'var(--accent)' }}>
                            {cve.cve}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                            style={{
                              background: cve.severity === 'CRITICAL' ? 'rgba(255,34,68,0.12)' : 'rgba(255,107,53,0.12)',
                              color: cve.severity === 'CRITICAL' ? '#ff2244' : 'var(--accent)',
                            }}>
                            {cve.severity}
                          </span>
                        </div>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text)' }}>{cve.name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{cve.description}</p>
                        <p className="text-xs mt-1 font-medium" style={{ color: 'var(--teal)' }}>
                          Fix: {cve.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-run button */}
              <button onClick={handleRun} disabled={running}
                className="btn-secondary flex items-center gap-2 text-xs">
                <Play className="w-3.5 h-3.5" /> Re-run Investigation
              </button>
            </div>
          )}

          {/* Steps tab — reasoning chain */}
          {activeTab === 'steps' && (
            <div className="panel">
              <p className="section-title mb-4">Complete Reasoning Chain</p>
              <div className="space-y-0">
                {result.steps?.map((step, i) => (
                  <StepCard key={i} step={step} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Findings tab */}
          {activeTab === 'findings' && report && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Final Risk Score', value: `${Math.round(report.final_risk_score)}/100`, color: riskColor(report.final_risk_level) },
                  { label: 'Risk Level',        value: report.final_risk_level, color: riskColor(report.final_risk_level) },
                  { label: 'Confidence',        value: `${report.confidence} (${report.confidence_score}%)`, color: 'var(--teal)' },
                  { label: 'Related Alerts',    value: String(report.related_alerts || 0), color: 'var(--accent)' },
                  { label: 'Tools Used',        value: String(report.tools_used?.length || 0), color: 'var(--muted)' },
                  { label: 'Threat Confirmed',  value: report.threat_confirmed ? 'YES' : 'NO', color: report.threat_confirmed ? '#ff2244' : '#00d4aa' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="panel py-3 text-center">
                    <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
                    <p className="text-lg font-black" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {report.risk_factors?.length > 0 && (
                <div className="panel">
                  <p className="section-title">All Risk Factors</p>
                  <div className="space-y-2">
                    {report.risk_factors.map((f, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 text-xs">
                        <span style={{ color: 'var(--text)' }}>{f.description}</span>
                        <span className="font-mono font-bold shrink-0" style={{ color: 'var(--accent)' }}>
                          +{f.score_delta}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
