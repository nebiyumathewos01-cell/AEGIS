import { useState } from 'react'
import { Search, Globe, AlertTriangle, Shield } from 'lucide-react'
import { lookupIOC } from '../services/api'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'

function ResultRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-2 border-b border-cyber-border/30 last:border-0">
      <span className="text-xs text-cyber-muted w-40 shrink-0">{label}</span>
      <span className="text-xs font-mono text-cyber-text break-all">{String(value)}</span>
    </div>
  )
}

export default function ThreatIntelligence() {
  const [ioc, setIoc]         = useState('')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleLookup(e) {
    e.preventDefault()
    if (!ioc.trim()) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const data = await lookupIOC(ioc.trim())
      setResult(data)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const maliciousCount = result?.malicious_count ?? 0
  const threatLevel =
    maliciousCount >= 10 ? 'CRITICAL' :
    maliciousCount >= 3  ? 'HIGH' :
    maliciousCount >= 1  ? 'MEDIUM' : 'LOW'

  const threatColors = {
    LOW: 'text-risk-low', MEDIUM: 'text-risk-medium',
    HIGH: 'text-risk-high', CRITICAL: 'text-risk-critical'
  }

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        title="Threat Intelligence"
        subtitle="Lookup IP addresses and domains against threat intelligence feeds"
      />

      {/* Search */}
      <div className="card mb-6">
        <form onSubmit={handleLookup} className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
            <input
              className="input pl-9"
              placeholder="Enter IP address or domain (e.g. 192.168.1.50)"
              value={ioc}
              onChange={e => setIoc(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading || !ioc.trim()} className="btn-primary flex items-center gap-2">
            {loading ? <Spinner size="sm" /> : <Search className="w-4 h-4" />}
            Lookup
          </button>
        </form>
        <p className="text-xs text-cyber-muted mt-2">
          Uses VirusTotal when API key is configured. Falls back to demo data for private/test IPs.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-950/40 border border-risk-high/40 rounded-md text-sm text-risk-high">
          {error}
        </div>
      )}

      {result && (
        <div className="card space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-cyber-border">
            <div>
              <p className="font-mono text-lg font-bold text-cyber-text">{result.ioc}</p>
              <p className="text-xs text-cyber-muted capitalize">{result.ioc_type} · Source: {result.source}</p>
            </div>
            <div className="flex items-center gap-2">
              {maliciousCount > 0
                ? <AlertTriangle className={`w-5 h-5 ${threatColors[threatLevel]}`} />
                : <Shield className="w-5 h-5 text-risk-low" />
              }
              <span className={`font-bold text-sm ${threatColors[threatLevel]}`}>
                {threatLevel}
              </span>
            </div>
          </div>

          {/* Detections */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-cyber-bg rounded-md p-3 border border-cyber-border">
              <p className="text-2xl font-bold text-risk-high">{result.malicious_count}</p>
              <p className="text-xs text-cyber-muted mt-0.5">Malicious</p>
            </div>
            <div className="bg-cyber-bg rounded-md p-3 border border-cyber-border">
              <p className="text-2xl font-bold text-risk-medium">{result.suspicious_count}</p>
              <p className="text-xs text-cyber-muted mt-0.5">Suspicious</p>
            </div>
            <div className="bg-cyber-bg rounded-md p-3 border border-cyber-border">
              <p className="text-2xl font-bold text-risk-low">{result.harmless_count}</p>
              <p className="text-xs text-cyber-muted mt-0.5">Harmless</p>
            </div>
          </div>

          {/* Details */}
          <div>
            <ResultRow label="Country"           value={result.country} />
            <ResultRow label="ASN"               value={result.asn} />
            <ResultRow label="Owner"             value={result.owner} />
            <ResultRow label="Reputation Score"  value={result.reputation} />
            <ResultRow label="Last Analysis"     value={result.last_analysis_date} />
            {result.categories?.length > 0 && (
              <ResultRow label="Categories" value={result.categories.join(', ')} />
            )}
            {result.tags?.length > 0 && (
              <ResultRow label="Tags" value={result.tags.join(', ')} />
            )}
            {result.note && (
              <div className="mt-3 px-3 py-2 bg-cyber-bg border border-cyber-border rounded text-xs text-cyber-muted">
                {result.note}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick lookups */}
      <div className="card mt-6">
        <p className="section-title mb-2">Preset Security Test IPs</p>
        <p className="text-xs text-cyber-muted mb-3">
          Click any preset to test threat intelligence detection for different threat classifications:
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { ip: '185.220.101.47', label: '185.220.101.47 (Tor Node · High Risk)', color: '#ff2244' },
            { ip: '141.98.11.11',   label: '141.98.11.11 (Cobalt Strike C2 · Critical)', color: '#ff2244' },
            { ip: '198.51.100.45',  label: '198.51.100.45 (SSH Botnet · High)', color: '#f59e0b' },
            { ip: '203.0.113.12',   label: '203.0.113.12 (Vulnerability Scanner)', color: '#f59e0b' },
            { ip: '8.8.8.8',        label: '8.8.8.8 (Google DNS · Clean)', color: '#00d4aa' },
            { ip: '192.168.1.50',   label: '192.168.1.50 (Internal Private Network)', color: '#00d4aa' },
          ].map(({ ip, label, color }) => (
            <button
              key={ip}
              className="font-mono text-xs px-3 py-1.5 border rounded transition-all flex items-center gap-1.5"
              style={{
                background: 'var(--surface2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
              onClick={() => { setIoc(ip); }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

