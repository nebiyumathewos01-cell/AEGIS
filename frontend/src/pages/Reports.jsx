import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, ArrowLeft, FileText, Cpu, Shield } from 'lucide-react'
import { getReportData } from '../services/api'
import { generatePDF } from '../utils/pdf'
import Spinner from '../components/Spinner'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import RiskScoreBar from '../components/RiskScoreBar'
import PageHeader from '../components/PageHeader'
import { formatAlertType, riskColor } from '../utils/risk'
import { fmtDate } from '../utils/format'

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyber-border">
        <Icon className="w-4 h-4 text-cyber-accent" />
        <span className="font-semibold text-sm text-cyber-text">{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function Reports() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    getReportData(id)
      .then(setData)
      .catch(e => setError(e?.response?.data?.detail ?? 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
  if (error)   return <div className="p-6 text-risk-high">{error}</div>
  if (!data)   return null

  const { alert, risk_factors, analysis, notes } = data

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="AEGIS Investigation Report"
        subtitle={`Alert #${alert.id} · ${formatAlertType(alert.alert_type)}`}
        actions={
          <>
            <button onClick={() => navigate(`/alerts/${id}`)} className="btn-ghost flex items-center gap-1.5 text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to Alert
            </button>
            <button
              className="btn-primary flex items-center gap-2 text-sm"
              onClick={() => generatePDF(data)}
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </>
        }
      />

      <div className="space-y-5">
        {/* Alert info */}
        <Section icon={FileText} title="Alert Information">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ['Alert Type',     formatAlertType(alert.alert_type)],
              ['Risk Level',     null],
              ['Status',         null],
              ['Source',         alert.source?.toUpperCase()],
              ['Source IP',      alert.source_ip],
              ['Destination IP', alert.destination_ip],
              ['Protocol',       alert.protocol],
              ['Username',       alert.username],
              ['Attempt Count',  alert.attempt_count],
              ['Timestamp',      fmtDate(alert.timestamp)],
            ].map(([label, value]) => {
              if (!value && label === 'Risk Level') return (
                <div key={label}>
                  <p className="text-xs text-cyber-muted">{label}</p>
                  <div className="mt-0.5"><RiskBadge level={alert.risk_level} /></div>
                </div>
              )
              if (!value && label === 'Status') return (
                <div key={label}>
                  <p className="text-xs text-cyber-muted">{label}</p>
                  <div className="mt-0.5"><StatusBadge status={alert.status} /></div>
                </div>
              )
              if (!value) return null
              return (
                <div key={label}>
                  <p className="text-xs text-cyber-muted">{label}</p>
                  <p className="text-sm font-mono text-cyber-text mt-0.5">{value}</p>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Risk */}
        <Section icon={Shield} title="Risk Assessment">
          <div className="max-w-xs mb-4">
            <RiskScoreBar score={alert.risk_score} level={alert.risk_level} />
          </div>
          {risk_factors?.length > 0 && (
            <div className="space-y-2">
              {risk_factors.map((f, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-cyber-text">{f.description}</span>
                  <span className="font-mono font-semibold shrink-0" style={{ color: riskColor(alert.risk_level) }}>
                    +{f.score_delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Analysis */}
        {analysis && (
          <Section icon={Cpu} title={`AI Analysis · ${analysis.is_ai_generated ? analysis.ai_model : 'Rule-Based'}`}>
            <div className="space-y-4 text-sm text-cyber-text">
              <div>
                <p className="text-xs text-cyber-muted mb-1">Summary</p>
                <p>{analysis.summary}</p>
              </div>
              <div>
                <p className="text-xs text-cyber-muted mb-1">Threat Interpretation</p>
                <p className="leading-relaxed">{analysis.threat_interpretation}</p>
              </div>
              <div>
                <p className="text-xs text-cyber-muted mb-1">Confirmed Evidence</p>
                <pre className="text-xs bg-cyber-bg border border-cyber-border rounded p-3 whitespace-pre-wrap leading-relaxed">
                  {analysis.evidence}
                </pre>
              </div>
              <div>
                <p className="text-xs text-cyber-muted mb-1">Risk Explanation</p>
                <p>{analysis.risk_explanation}</p>
              </div>
              {analysis.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs text-cyber-muted mb-2">Recommended Investigation Steps</p>
                  <ol className="space-y-1.5">
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="text-cyber-accent font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Analyst notes */}
        {notes?.length > 0 && (
          <Section icon={FileText} title="Analyst Notes">
            <div className="space-y-3">
              {notes.map(n => (
                <div key={n.id} className="bg-cyber-bg border border-cyber-border/50 rounded p-3">
                  <p className="text-sm text-cyber-text">{n.note}</p>
                  <p className="text-xs text-cyber-muted mt-1.5">{n.analyst} · {fmtDate(n.created_at)}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
