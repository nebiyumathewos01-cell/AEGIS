import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Play, ArrowLeft, FileText, Zap, Database } from 'lucide-react'
import {
  submitAlert, uploadAlertFile,
  getDemoScenarios, getDemoRaw, loadDemoScenario, loadAllScenarios,
} from '../services/api'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'

const SOURCES = [
  { value: 'generic',  label: 'Auto-detect' },
  { value: 'auth',     label: 'Linux Auth Log' },
  { value: 'nmap',     label: 'Nmap Scan' },
  { value: 'suricata', label: 'Suricata IDS' },
]

const RISK_COLORS = {
  LOW: 'text-risk-low', MEDIUM: 'text-risk-medium',
  HIGH: 'text-risk-high', CRITICAL: 'text-risk-critical',
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

  useEffect(() => {
    getDemoScenarios().then(setScenarios).catch(() => {})
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
        subtitle="Parse, analyze, and triage a new security alert"
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
        <form onSubmit={handlePaste} className="card space-y-4">
          <div>
            <label className="label">Log Source</label>
            <select className="input w-48" value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
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
        <form onSubmit={handleUpload} className="card space-y-4">
          <div>
            <label className="label">Log Source</label>
            <select className="input w-48" value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
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
          {/* Load all button */}
          <div className="card bg-cyber-accent/5 border-cyber-accent/20 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm text-cyber-text">Load All 20 Scenarios</p>
              <p className="text-xs text-cyber-muted mt-0.5">
                Populate your workspace with all demo alerts at once — great for a full demonstration.
              </p>
            </div>
            <button
              className="btn-primary flex items-center gap-2 text-sm shrink-0"
              onClick={loadAll}
              disabled={loadingAll}>
              {loadingAll ? <Spinner size="sm" /> : <Database className="w-4 h-4" />}
              {loadingAll ? 'Loading...' : 'Load All'}
            </button>
          </div>

          {/* Individual scenarios */}
          <div className="space-y-3">
            {scenarios.map(s => (
              <div key={s.id} className="card flex items-start justify-between gap-4">
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
                  <button
                    className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                    onClick={() => loadDemo(s.id)}
                    disabled={loadingDemo === s.id}>
                    {loadingDemo === s.id ? <Spinner size="sm" /> : <Zap className="w-3.5 h-3.5" />}
                    Load &amp; Analyze
                  </button>
                  <button
                    className="btn-secondary text-xs px-3 py-1.5"
                    onClick={() => previewDemo(s.id)}>
                    Preview Log
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
