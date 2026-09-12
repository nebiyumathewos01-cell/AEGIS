import { useState, useEffect } from 'react'
import {
  Server, Cloud, Shield, Database, Globe,
  Code, Save, CheckCircle, Info, RefreshCw
} from 'lucide-react'
import { getEnvironmentProfile, saveEnvironmentProfile } from '../services/api'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'

const FIELD_OPTIONS = {
  cloud: {
    label: 'Cloud Provider', icon: Cloud,
    options: ['AWS', 'Azure', 'GCP', 'DigitalOcean', 'On-premise', 'Hybrid', 'None'],
  },
  os: {
    label: 'Operating System', icon: Server,
    options: ['Linux (Ubuntu)', 'Linux (CentOS/RHEL)', 'Linux (Debian)', 'Windows Server', 'Mixed', 'Other'],
  },
  firewall: {
    label: 'Firewall / Network Security', icon: Shield,
    options: ['AWS Security Groups', 'Azure NSG', 'GCP Firewall Rules', 'iptables', 'nftables', 'pfSense', 'OPNsense', 'Cisco ASA', 'Palo Alto', 'None'],
  },
  ids_ips: {
    label: 'IDS / IPS', icon: Shield,
    options: ['Suricata', 'Snort', 'Zeek (Bro)', 'AWS GuardDuty', 'Azure Sentinel', 'CrowdStrike', 'SentinelOne', 'None'],
  },
  web_server: {
    label: 'Web Server', icon: Globe,
    options: ['Nginx', 'Apache', 'Caddy', 'AWS CloudFront', 'Azure Front Door', 'None'],
  },
  app_framework: {
    label: 'Application Framework / Language', icon: Code,
    options: ['Node.js (Express)', 'Node.js (Fastify)', 'Python (FastAPI)', 'Python (Django)', 'Python (Flask)', 'PHP (Laravel)', 'Java (Spring)', 'Ruby on Rails', '.NET Core', 'Go', 'Other'],
  },
  database: {
    label: 'Database', icon: Database,
    options: ['PostgreSQL', 'MySQL', 'MariaDB', 'MongoDB', 'Redis', 'AWS RDS', 'Azure SQL', 'Elasticsearch', 'SQLite', 'None'],
  },
}

function FieldSelect({ name, config, value, onChange }) {
  const Icon = config.icon
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <Icon className="w-3 h-3" />
        {config.label}
      </label>
      <select
        className="input"
        value={value || ''}
        onChange={e => onChange(name, e.target.value || null)}
      >
        <option value="">-- Not configured --</option>
        {config.options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

export default function EnvironmentProfile() {
  const [profile, setProfile] = useState({
    cloud: null, os: null, firewall: null, ids_ips: null,
    web_server: null, app_framework: null, database: null, custom_notes: null,
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [context, setContext]   = useState('')

  useEffect(() => {
    getEnvironmentProfile()
      .then(p => {
        setProfile(p)
        setContext(p.context_string || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleChange(field, value) {
    setProfile(p => ({ ...p, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await saveEnvironmentProfile(profile)
      setContext(res.context_string || '')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Failed to save profile')
    } finally {
      setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>

  const configured = Object.entries(profile)
    .filter(([k, v]) => k !== 'custom_notes' && v)
    .length

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <PageHeader
        title="Environment Profile"
        subtitle="Tell AEGIS about your tech stack — AI recommendations will be tailored to your architecture"
      />

      {/* Info banner */}
      <div className="panel-teal flex items-start gap-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--teal)' }} />
        <div className="text-sm" style={{ color: 'var(--text)' }}>
          <p className="font-semibold mb-1">Why configure this?</p>
          <p style={{ color: 'var(--muted)' }}>
            When AEGIS analyzes an alert, it passes your environment to the AI.
            Instead of generic recommendations, you get specific commands for your stack —
            e.g. AWS Security Group rules, Nginx rate limiting, or PostgreSQL audit queries.
          </p>
        </div>
      </div>

      {/* Current context preview */}
      {context && (
        <div className="panel">
          <p className="section-title">Current Profile Context (passed to AI)</p>
          <code className="text-xs font-mono" style={{ color: 'var(--teal)' }}>
            {context}
          </code>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            {configured} of {Object.keys(FIELD_OPTIONS).length} fields configured
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="panel space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(FIELD_OPTIONS).map(([name, config]) => (
            <FieldSelect
              key={name}
              name={name}
              config={config}
              value={profile[name]}
              onChange={handleChange}
            />
          ))}
        </div>

        {/* Custom notes */}
        <div>
          <label className="label">Additional Context (optional)</label>
          <textarea
            className="input resize-none h-20 text-xs"
            placeholder="e.g. 'Running Kubernetes on AWS EKS, using Cloudflare for DNS, 3-tier architecture'"
            value={profile.custom_notes || ''}
            onChange={e => handleChange('custom_notes', e.target.value || null)}
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: '#ff2244' }}>{error}</p>
        )}

        <button type="submit" disabled={saving}
          className="btn-primary flex items-center gap-2">
          {saving
            ? <><Spinner size="sm" /> Saving...</>
            : saved
              ? <><CheckCircle className="w-4 h-4" /> Saved!</>
              : <><Save className="w-4 h-4" /> Save Profile</>
          }
        </button>
      </form>

      {/* Example: how AI uses this */}
      <div className="panel" style={{ background: 'var(--surface2)' }}>
        <p className="section-title">Example — How This Changes AI Recommendations</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-2" style={{ color: 'var(--muted)' }}>Without Profile</p>
            <p style={{ color: 'var(--text)' }}>"Consider blocking the source IP at the firewall."</p>
          </div>
          <div className="p-3 rounded" style={{ background: 'var(--bg)', border: '1px solid var(--teal)', borderLeft: '3px solid var(--teal)' }}>
            <p className="font-semibold mb-2" style={{ color: 'var(--teal)' }}>With Profile (AWS + Nginx)</p>
            <p style={{ color: 'var(--text)' }}>
              "Block IP in AWS Security Group:
              <code className="font-mono"> aws ec2 authorize-security-group-ingress...</code>
              Add Nginx rate limiting:
              <code className="font-mono"> limit_req_zone $binary_remote_addr...</code>"
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
