import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Play, ArrowLeft, FileText, Zap, Database, ChevronDown } from 'lucide-react'
import {
  submitAlert, uploadAlertFile,
  getDemoScenarios, getDemoRaw, loadDemoScenario,
  loadAllScenarios, getAlertSources,
} from '../services/api'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'

const RISK_COLORS = {
  LOW: 'text-risk-low', MEDIUM: 'text-risk-medium',
  HIGH: 'text-risk-high', CRITICAL: 'text-risk-critical',
}

// Fallback sources if API not available
const FALLBACK_SOURCES = [
  { value: 'generic',       label: 'Auto-detect',              category: 'General' },
  { value: 'auth',          label: 'Linux Auth Log (SSH)',      category: 'Linux' },
  { value: 'nmap',          label: 'Nmap Scan',                 category: 'Network' },
  { value: 'suricata',      label: 'Suricata IDS',              category: 'IDS/IPS' },
  { value: 'firewall',      label: 'Firewall (iptables/pfSense)',category: 'Firewall' },
  { value: 'apache',        label: 'Apache / Nginx',            category: 'Web' },
  { value: 'windows_event', label: 'Windows Event Log',         category: 'Windows' },
  { value: 'aws_cloudtrail','label': 'AWS CloudTrail',          category: 'Cloud' },
]

function SourceSelect({ value, onChange, sources }) {
  const [open, setOpen] = useState(false)

  // Group by category
  const grouped = sources.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  const selected = sources.find(s => s.value === value) || sources[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input flex items-center justify-between gap-2 w-full text-left cursor-pointer"
      >
        <div>
          <span className="text-cyber-text">{selected?.label}</span>
          {selected?.category && selected.category !== 'General' && (
            <span className="ml-2 text-[10px] text-cyber-muted uppercase font-mono bg-cyber-border px-1.5 py-0.5 rounded">
              {selected.category}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-cyber-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-cyber-surface border border-cyber-border
                        rounded-xl shadow-2xl max-h-80 overflow-y-auto">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-[10px] font-bold text-cyber-muted uppercase tracking-widest
                              bg-cyber-bg/50 border-b border-cyber-border/50 sticky top-0">
                {category}
              </div>
              {items.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => { onChange(s.value); setOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-cyber-border/30 ${
                    value === s.value ? 'text-cyber-accent font-medium bg-cyber-accent/5' : 'text-cyber-text'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewAlert() {
  const navigate = useNavigate()
  const fileRef  = useRef()

  const [mode, setMode]             = useState('paste')
  const [rawAlert, setRawAlert]     = useState('')
  const [source, setSource]         = useState('generic')
  const [file, setFile]             = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [error, setError]           = useState('')
  const [scenarios, setScenarios]   = useState([])
  const [sources, setSources]       = useState(FALLBACK_SOURCES)

  useEffect(() => {
    getDemoScenarios().then(setScenarios).catch(() => {})
    getAlertSources().then(setSources).catch(() => {})
  }, [])

  async function handlePaste(e) {
    e.preventDefault()
    if (!rawAlert.trim()) return
    setError(''); setSubmitting(true)
    try {
      const alert = await submitAlert({ raw_alert: rawAlert, source })
      navigate(`/alerts/${alert.id}`)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Submission failed')
    } finally { setSubmitting(false) }
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setError(''); setSubmitting(true)
    try {
      const alert = await uploadAlertFile(file, source)
      navigate(`/alerts/${alert.id}`)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Upload failed')
    } finally { setSubmitting(false) }
  }

  async function loadDemo(id) {
    setLoadingDemo(id); setError('')
    try {
      const result = await loadDemoScenario(id)
      navigate(`/alerts/${result.alert_id}`)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Failed to load scenario')
    } finally { setLoadingDemo(false) }
  }

  async function loadAll() {
    setLoadingAll(true); setError('')
    try {
      await loadAllScenarios()
      navigate('/alerts')
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Failed to load all scenarios')
    } finally { setLoadingAll(false) }
  }

  async function previewDemo(id) {
    try {
      const data = await getDemoRaw(id)
      setRawAlert(data.raw_alert)
      setSource(data.source)
      setMode('paste')
    } catch {}
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Submit Alert"
        subtitle={`${sources.length} log sources supported — paste, upload, or load a demo`}
        actions={
          <button onClick={() => navigate('/alerts')} className="btn-ghost flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        }
      />

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-cyber-surface rounded-xl border border-cyber-border mb-6 w-fit">
        {[
          { id: 'paste',  label: 'Paste Log',      icon: FileText },
          { id: 'upload', label: 'Upload File',    icon: Upload },
          { id: 'demo',   label: 'Demo Scenarios', icon: Zap },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setMode(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              mode === id
                ? 'bg-cyber-accent/10 text-cyber-accent font-medium border border-cyber-accent/20'
                : 'text-cyber-muted hover:text-cyber-text'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 bg-red-950/40 border border-risk-high/40 rounded-lg text-sm text-risk-high">
          {error}
        </div>
      )}

      {/* Paste mode */}
      {mode === 'paste' && (
        <form onSubmit={handlePaste} className="card space-y-5">
          <div>
            <label className="label">Log Source ({sources.length} supported)</label>
            <SourceSelect value={source} onChange={setSource} sources={sources} />
            <p className="text-xs text-cyber-muted mt-1.5">
              Select "Auto-detect" to let AEGIS identify the log format automatically.
            </p>
          </div>
          <div>
            <label className="label">Alert / Log Content</label>
            <textarea
              className="input resize-none h-64 font-mono text-xs leading-relaxed"
              placeholder="Paste your security alert, log excerpt, or scan output here..."
              value={rawAlert}
              onChange={e => setRawAlert(e.target.value)}
              required
            />
            <p className="text-xs text-cyber-muted mt-1">Max 50,000 characters</p>
          </div>
          <button type="submit" disabled={submitting || !rawAlert.trim()}
            className="btn-primary flex items-center gap-2">
            {submitting ? <Spinner size="sm" /> : <Play className="w-4 h-4" />}
            Parse &amp; Analyze
          </button>
        </form>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <form onSubmit={handleUpload} className="card space-y-5">
          <div>
            <label className="label">Log Source</label>
            <SourceSelect value={source} onChange={setSource} sources={sources} />
          </div>
          <div>
            <label className="label">Upload .log or .txt file (max 5 MB)</label>
            <div
              className="border-2 border-dashed border-cyber-border rounded-xl p-8 text-center cursor-pointer hover:border-cyber-accent transition-colors"
              onClick={() => fileRef.current?.click()}>
              <Upload className="w-8 h-8 text-cyber-muted mx-auto mb-2" />
              {file
                ? <p className="text-sm text-cyber-text font-medium">{file.name}</p>
                : <p className="text-sm text-cyber-muted">Click to select or drag and drop</p>
              }
              <p className="text-xs text-cyber-muted mt-1">.log and .txt files accepted</p>
            </div>
            <input ref={fileRef} type="file" accept=".log,.txt,text/plain" className="hidden"
              onChange={e => setFile(e.target.files[0] || null)} />
          </div>
          <button type="submit" disabled={submitting || !file}
            className="btn-primary flex items-center gap-2">
            {submitting ? <Spinner size="sm" /> : <Upload className="w-4 h-4" />}
            Upload &amp; Analyze
          </button>
        </form>
      )}

      {/* Demo scenarios */}
      {mode === 'demo' && (
        <div className="space-y-4">
          {/* Load all */}
          <div className="card bg-cyber-accent/5 border-cyber-accent/20 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm text-cyber-text">Load All 20 Scenarios</p>
              <p className="text-xs text-cyber-muted mt-0.5">
                Populate your workspace instantly with all demo alerts — perfect for a full demonstration.
              </p>
            </div>
            <button className="btn-primary flex items-center gap-2 text-sm shrink-0"
              onClick={loadAll} disabled={loadingAll}>
              {loadingAll ? <Spinner size="sm" /> : <Database className="w-4 h-4" />}
              {loadingAll ? 'Loading...' : 'Load All'}
            </button>
          </div>

          {/* Individual scenarios */}
          <div className="space-y-3">
            {scenarios.map(s => (
              <div key={s.id} className="card flex items-start justify-between gap-4 hover:border-cyber-border transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-sm text-cyber-text">{s.title}</p>
                    <span className={`text-xs font-mono font-bold ${RISK_COLORS[s.risk_level_hint] ?? ''}`}>
                      {s.risk_level_hint}
                    </span>
                    <span className="text-xs text-cyber-muted uppercase bg-cyber-bg border border-cyber-border px-1.5 py-0.5 rounded font-mono">
                      {s.source}
                    </span>
                  </div>
                  <p className="text-xs text-cyber-muted leading-relaxed">{s.description}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                    onClick={() => loadDemo(s.id)} disabled={loadingDemo === s.id}>
                    {loadingDemo === s.id ? <Spinner size="sm" /> : <Zap className="w-3.5 h-3.5" />}
                    Load &amp; Analyze
                  </button>
                  <button className="btn-secondary text-xs px-3 py-1.5"
                    onClick={() => previewDemo(s.id)}>
                    Preview Log
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supported sources reference */}
      {mode === 'paste' && sources.length > 4 && (
        <div className="mt-5 card bg-cyber-bg">
          <p className="text-xs font-semibold text-cyber-muted uppercase tracking-widest mb-3">
            All {sources.length} Supported Log Sources
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {sources.filter(s => s.value !== 'generic').map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSource(s.value)}
                className={`text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors border ${
                  source === s.value
                    ? 'border-cyber-accent/40 text-cyber-accent bg-cyber-accent/5'
                    : 'border-cyber-border text-cyber-muted hover:text-cyber-text hover:border-cyber-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
