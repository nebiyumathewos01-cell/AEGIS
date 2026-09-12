import { useState, useEffect } from 'react'
import {
  Key, Copy, Trash2, Plus, CheckCircle,
  Globe, Terminal, Code, RefreshCw,
  Eye, EyeOff, Shield, Zap
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { fmtDate, fmtRelative } from '../utils/format'

// ── API calls ─────────────────────────────────────────────────────────────────
const getKeys    = ()      => api.get('/keys').then(r => r.data)
const createKey  = (label) => api.post('/keys', { label }).then(r => r.data)
const revokeKey  = (id)    => api.delete(`/keys/${id}`).then(r => r.data)

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://aegis-1-15r0.onrender.com'

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      className="p-1.5 rounded text-cyber-muted hover:text-cyber-accent transition-colors">
      {copied
        ? <CheckCircle className="w-3.5 h-3.5 text-risk-low" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ── Code block ────────────────────────────────────────────────────────────────
function CodeBlock({ code, lang = 'bash' }) {
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-cyber-bg border border-cyber-border rounded-lg p-4 text-xs
                      font-mono text-cyber-text overflow-x-auto leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

export default function Settings() {
  const { user }              = useAuth()
  const [keys, setKeys]       = useState([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey]   = useState(null)  // shown once after creation
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState('keys') // keys | webhook | agent | examples

  async function load() {
    setLoading(true)
    try { setKeys(await getKeys()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true); setError(''); setNewKey(null)
    try {
      const res = await createKey(newLabel || 'My Integration')
      setNewKey(res)
      setNewLabel('')
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Failed to create key')
    } finally { setCreating(false) }
  }

  async function handleRevoke(id) {
    try {
      await revokeKey(id)
      setKeys(k => k.filter(x => x.id !== id))
    } catch {}
  }

  const activeKeys = keys.filter(k => k.is_active)
  const webhookUrl = `${BACKEND_URL}/api/webhook/alert`

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader
        title="Settings & Integrations"
        subtitle="Connect external systems to AEGIS using API keys and webhooks"
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-1.5 text-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-cyber-surface rounded-xl border border-cyber-border w-fit">
        {[
          { id: 'keys',     label: 'API Keys',      icon: Key },
          { id: 'webhook',  label: 'Webhook',        icon: Globe },
          { id: 'agent',    label: 'Agent Script',   icon: Terminal },
          { id: 'examples', label: 'Code Examples',  icon: Code },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === id
                ? 'bg-cyber-accent/10 text-cyber-accent font-medium border border-cyber-accent/20'
                : 'text-cyber-muted hover:text-cyber-text'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── API Keys Tab ── */}
      {tab === 'keys' && (
        <div className="space-y-5">
          {/* Create key */}
          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-cyber-accent" /> Generate API Key
            </p>
            <form onSubmit={handleCreate} className="flex gap-3">
              <input className="input flex-1" placeholder="Label (e.g. Production Server)"
                value={newLabel} onChange={e => setNewLabel(e.target.value)} />
              <button type="submit" disabled={creating}
                className="btn-primary flex items-center gap-2 shrink-0">
                {creating ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
                Generate
              </button>
            </form>
            {error && <p className="text-xs text-risk-high mt-2">{error}</p>}
          </div>

          {/* New key display — shown ONCE */}
          {newKey && (
            <div className="card border-risk-low/40 bg-green-950/20">
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-risk-low shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-risk-low">API Key Generated</p>
                  <p className="text-xs text-cyber-muted mt-0.5">
                    Copy this key now. It will never be shown again.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-cyber-bg rounded-lg px-3 py-2.5 border border-cyber-border">
                <code className="text-sm font-mono text-cyber-accent flex-1 break-all">
                  {newKey.key}
                </code>
                <CopyButton text={newKey.key} />
              </div>
              <button onClick={() => setNewKey(null)}
                className="mt-3 text-xs text-cyber-muted hover:text-cyber-text">
                I have copied the key — dismiss
              </button>
            </div>
          )}

          {/* Keys list */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-cyber-border bg-cyber-bg/50">
              <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wide">
                Active API Keys ({activeKeys.length}/5)
              </p>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : activeKeys.length === 0 ? (
              <div className="text-center py-8">
                <Key className="w-6 h-6 text-cyber-muted mx-auto mb-2" />
                <p className="text-sm text-cyber-muted">No API keys yet. Generate one above.</p>
              </div>
            ) : (
              <div className="divide-y divide-cyber-border/30">
                {activeKeys.map(k => (
                  <div key={k.id} className="flex items-center gap-4 px-4 py-3">
                    <Key className="w-4 h-4 text-cyber-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-cyber-text">{k.label}</p>
                      <p className="text-xs font-mono text-cyber-muted mt-0.5">{k.key_prefix}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-cyber-muted">{k.alert_count} alerts sent</p>
                      <p className="text-xs text-cyber-muted mt-0.5">
                        {k.last_used_at ? `Last used ${fmtRelative(k.last_used_at)}` : 'Never used'}
                      </p>
                    </div>
                    <button onClick={() => handleRevoke(k.id)}
                      className="p-1.5 text-cyber-muted hover:text-risk-high transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 px-4 py-3 bg-cyber-bg border border-cyber-border rounded-lg">
            <Shield className="w-4 h-4 text-cyber-accent shrink-0 mt-0.5" />
            <p className="text-xs text-cyber-muted leading-relaxed">
              API keys authenticate external systems to send alerts to your AEGIS account.
              Keep them secret — treat them like passwords. Revoke immediately if compromised.
            </p>
          </div>
        </div>
      )}

      {/* ── Webhook Tab ── */}
      {tab === 'webhook' && (
        <div className="space-y-5">
          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyber-accent" /> Webhook URL
            </p>
            <p className="text-xs text-cyber-muted mb-3">
              Send a POST request to this URL from any system to submit an alert to your dashboard.
            </p>
            <div className="flex items-center gap-2 bg-cyber-bg rounded-lg px-3 py-2.5 border border-cyber-border">
              <code className="text-sm font-mono text-cyber-accent flex-1 break-all">{webhookUrl}</code>
              <CopyButton text={webhookUrl} />
            </div>
          </div>

          <div className="card space-y-4">
            <p className="text-sm font-semibold text-cyber-text">Request Format</p>

            <div>
              <p className="text-xs text-cyber-muted uppercase tracking-wide font-semibold mb-2">Headers</p>
              <CodeBlock code={`X-API-Key: your_aegis_api_key
Content-Type: application/json`} />
            </div>

            <div>
              <p className="text-xs text-cyber-muted uppercase tracking-wide font-semibold mb-2">Body (JSON)</p>
              <CodeBlock code={`{
  "raw_alert": "Jun 14 10:31:02 server sshd[1234]: Failed password for admin from 192.168.1.50 port 54312 ssh2",
  "source": "auth",
  "auto_analyze": true
}`} />
            </div>

            <div>
              <p className="text-xs text-cyber-muted uppercase tracking-wide font-semibold mb-2">Supported source values</p>
              <div className="flex flex-wrap gap-1.5">
                {['auth','nmap','suricata','snort','firewall','apache','dns',
                  'windows_event','cisco','palo_alto','waf','zeek',
                  'aws_cloudtrail','endpoint_edr','netflow','syslog',
                  'smtp','osquery','generic'].map(s => (
                  <span key={s} className="text-xs font-mono px-2 py-0.5 bg-cyber-bg
                                           border border-cyber-border rounded text-cyber-muted">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-cyber-muted uppercase tracking-wide font-semibold mb-2">Response</p>
              <CodeBlock code={`{
  "alert_id": 42,
  "alert_type": "brute_force_attempt",
  "risk_level": "CRITICAL",
  "risk_score": 81.0,
  "source": "auth",
  "analysis": {
    "summary": "SSH brute-force attack detected...",
    "risk_level": "CRITICAL",
    "ai_model": "rule-based-fallback"
  },
  "dashboard_url": "/alerts/42"
}`} />
            </div>
          </div>

          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyber-accent" /> Test Your Webhook
            </p>
            <p className="text-xs text-cyber-muted mb-3">
              Run this in your terminal to test the connection (replace YOUR_KEY):
            </p>
            <CodeBlock code={`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_AEGIS_API_KEY" \\
  -d '{
    "raw_alert": "Jun 14 10:31:02 server sshd: Failed password for admin from 10.0.0.1 port 22 ssh2",
    "source": "auth",
    "auto_analyze": true
  }'`} />
          </div>
        </div>
      )}

      {/* ── Agent Script Tab ── */}
      {tab === 'agent' && (
        <div className="space-y-5">
          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-1 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyber-accent" /> AEGIS Agent
            </p>
            <p className="text-xs text-cyber-muted mb-4">
              Install this Python script on any Linux/Windows server.
              It watches log files and automatically sends new alerts to your AEGIS dashboard.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-cyber-muted uppercase tracking-wide font-semibold mb-2">1. Install (requires Python 3.8+)</p>
                <CodeBlock code={`pip install requests`} />
              </div>

              <div>
                <p className="text-xs text-cyber-muted uppercase tracking-wide font-semibold mb-2">2. Download agent</p>
                <CodeBlock code={`wget https://raw.githubusercontent.com/nebiyumathewos01-cell/AEGIS/main/aegis-agent.py`} />
              </div>

              <div>
                <p className="text-xs text-cyber-muted uppercase tracking-wide font-semibold mb-2">3. Run agent</p>
                <CodeBlock code={`python aegis-agent.py \\
  --api-key  YOUR_AEGIS_API_KEY \\
  --server   ${BACKEND_URL} \\
  --log-file /var/log/auth.log \\
  --source   auth`} />
              </div>

              <div>
                <p className="text-xs text-cyber-muted uppercase tracking-wide font-semibold mb-2">4. Run as background service (Linux)</p>
                <CodeBlock code={`nohup python aegis-agent.py \\
  --api-key  YOUR_AEGIS_API_KEY \\
  --server   ${BACKEND_URL} \\
  --log-file /var/log/auth.log \\
  --source   auth > aegis-agent.log 2>&1 &`} />
              </div>
            </div>
          </div>

          <div className="card">
            <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wide mb-3">
              Supported log files
            </p>
            <div className="space-y-2">
              {[
                { file: '/var/log/auth.log',      source: 'auth',     desc: 'SSH / PAM authentication' },
                { file: '/var/log/syslog',         source: 'syslog',   desc: 'General system log' },
                { file: '/var/log/apache2/access.log', source: 'apache', desc: 'Apache web server' },
                { file: '/var/log/nginx/access.log',   source: 'apache', desc: 'Nginx web server' },
                { file: '/var/log/suricata/fast.log',  source: 'suricata', desc: 'Suricata IDS' },
                { file: 'C:\\Windows\\System32\\winevt\\Logs\\Security.evtx', source: 'windows_event', desc: 'Windows Security Events' },
              ].map(({ file, source, desc }) => (
                <div key={file} className="flex items-start gap-3 text-xs">
                  <code className="text-cyber-accent font-mono w-64 shrink-0 truncate">{file}</code>
                  <span className="text-cyber-muted bg-cyber-bg border border-cyber-border px-1.5 py-0.5 rounded font-mono shrink-0">{source}</span>
                  <span className="text-cyber-muted">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Code Examples Tab ── */}
      {tab === 'examples' && (
        <div className="space-y-5">
          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-3">Python</p>
            <CodeBlock code={`import requests

AEGIS_URL = "${BACKEND_URL}/api/webhook/alert"
API_KEY   = "your_aegis_api_key"

def send_alert(log_line, source="generic"):
    response = requests.post(
        AEGIS_URL,
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        },
        json={
            "raw_alert": log_line,
            "source": source,
            "auto_analyze": True
        }
    )
    if response.status_code == 201:
        data = response.json()
        print(f"Alert created: #{data['alert_id']} — {data['risk_level']}")
    return response.json()

# Example usage
send_alert("Failed password for root from 192.168.1.50", source="auth")`} />
          </div>

          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-3">Bash / Shell</p>
            <CodeBlock code={[
              '#!/bin/bash',
              'API_KEY="your_aegis_api_key"',
              `AEGIS_URL="${BACKEND_URL}/api/webhook/alert"`,
              '',
              'send_alert() {',
              '  local log_line="$1"',
              '  local source="${2:-generic}"',
              '',
              '  curl -s -X POST "$AEGIS_URL" \\',
              '    -H "X-API-Key: $API_KEY" \\',
              '    -H "Content-Type: application/json" \\',
              '    -d "{\\"raw_alert\\": \\"$log_line\\", \\"source\\": \\"$source\\", \\"auto_analyze\\": true}"',
              '}',
              '',
              '# Watch auth.log and send new lines',
              'tail -F /var/log/auth.log | while read line; do',
              '  send_alert "$line" "auth"',
              'done',
            ].join('\n')} />
          </div>

          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-3">JavaScript / Node.js</p>
            <CodeBlock code={`const AEGIS_URL = '${BACKEND_URL}/api/webhook/alert';
const API_KEY   = 'your_aegis_api_key';

async function sendAlert(rawAlert, source = 'generic') {
  const response = await fetch(AEGIS_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw_alert: rawAlert,
      source: source,
      auto_analyze: true,
    }),
  });
  const data = await response.json();
  console.log(\`Alert #\${data.alert_id} — \${data.risk_level}\`);
  return data;
}

// Example
sendAlert('Failed password for admin from 10.0.0.1', 'auth');`} />
          </div>

          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-3">PowerShell (Windows)</p>
            <CodeBlock code={`$ApiKey   = "your_aegis_api_key"
$AegisUrl = "${BACKEND_URL}/api/webhook/alert"

function Send-AegisAlert {
    param([string]$LogLine, [string]$Source = "windows_event")
    
    $body = @{
        raw_alert    = $LogLine
        source       = $Source
        auto_analyze = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Method Post -Uri $AegisUrl \\
        -Headers @{ "X-API-Key" = $ApiKey } \\
        -ContentType "application/json" \\
        -Body $body

    Write-Host "Alert #$($response.alert_id) - $($response.risk_level)"
}

# Watch Windows Event Log and forward to AEGIS
Get-WinEvent -LogName Security -MaxEvents 10 | ForEach-Object {
    Send-AegisAlert -LogLine $_.Message -Source "windows_event"
}`} />
          </div>
        </div>
      )}
    </div>
  )
}
