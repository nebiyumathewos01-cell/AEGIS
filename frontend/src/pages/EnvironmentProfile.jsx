import { useState, useEffect } from 'react'
import {
  Server, Cloud, Shield, Globe, Save,
  CheckCircle, Info, Zap, Terminal
} from 'lucide-react'
import { getEnvironmentProfile, saveEnvironmentProfile } from '../services/api'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'

// 4 One-Click Quick Presets
const PRESETS = [
  {
    id: 'linux',
    name: 'Linux Server',
    badge: 'Popular',
    icon: Server,
    desc: 'Standard Ubuntu / Debian with iptables & Nginx',
    values: {
      cloud: 'On-premise (Linux)',
      os: 'Linux (Ubuntu/Debian)',
      firewall: 'iptables',
      web_server: 'Nginx',
    },
  },
  {
    id: 'aws',
    name: 'AWS Cloud',
    badge: 'Cloud',
    icon: Cloud,
    desc: 'AWS EC2 instances with Security Groups',
    values: {
      cloud: 'AWS Cloud',
      os: 'Linux (Ubuntu)',
      firewall: 'AWS Security Groups',
      web_server: 'Nginx',
    },
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    badge: 'Enterprise',
    icon: Shield,
    desc: 'Azure Cloud VMs protected by Azure NSG',
    values: {
      cloud: 'Microsoft Azure',
      os: 'Linux / Windows',
      firewall: 'Azure NSG',
      web_server: 'Nginx',
    },
  },
  {
    id: 'windows',
    name: 'Windows Server',
    badge: 'Windows',
    icon: Server,
    desc: 'Windows Server with Defender Firewall & AD',
    values: {
      cloud: 'Windows Server',
      os: 'Windows Server 2022',
      firewall: 'Windows Defender Firewall',
      web_server: 'None',
    },
  },
]

// 3 Simplified Essential Fields (reduced from 7)
const ESSENTIAL_FIELDS = {
  cloud: {
    label: 'Infrastructure & Platform',
    icon: Cloud,
    options: [
      'On-premise (Linux)',
      'AWS Cloud',
      'Microsoft Azure',
      'Google Cloud (GCP)',
      'Windows Server',
      'Hybrid Environment',
    ],
  },
  firewall: {
    label: 'Firewall & Network Defense',
    icon: Shield,
    options: [
      'iptables',
      'AWS Security Groups',
      'Azure NSG',
      'Windows Defender Firewall',
      'pfSense / OPNsense',
      'Palo Alto / Hardware Firewall',
    ],
  },
  web_server: {
    label: 'Web Server / Proxy',
    icon: Globe,
    options: [
      'Nginx',
      'Apache',
      'Caddy',
      'AWS CloudFront / ALB',
      'None / Direct Ports',
    ],
  },
}

export default function EnvironmentProfile() {
  const [profile, setProfile] = useState({
    cloud: 'On-premise (Linux)',
    os: 'Linux (Ubuntu/Debian)',
    firewall: 'iptables',
    web_server: 'Nginx',
    custom_notes: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [context, setContext] = useState('')

  useEffect(() => {
    getEnvironmentProfile()
      .then(p => {
        if (p && (p.cloud || p.firewall || p.web_server)) {
          setProfile(p)
          setContext(p.context_string || '')
        } else {
          // Default to standard Linux preset if unconfigured
          setProfile(prev => ({
            ...prev,
            cloud: 'On-premise (Linux)',
            os: 'Linux (Ubuntu/Debian)',
            firewall: 'iptables',
            web_server: 'Nginx',
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function applyPreset(preset) {
    setProfile(p => ({
      ...p,
      ...preset.values,
    }))
    setSaved(false)
  }

  function handleChange(field, value) {
    setProfile(p => ({ ...p, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e) {
    e?.preventDefault?.()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await saveEnvironmentProfile(profile)
      setContext(res.context_string || '')
      setSaved(true)
      setTimeout(() => setSaved(false), 3500)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Failed to save environment profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  // Check which preset currently matches
  const activePreset = PRESETS.find(pr =>
    pr.values.cloud === profile.cloud &&
    pr.values.firewall === profile.firewall
  )

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <PageHeader
        title="Environment Profile"
        subtitle="Configure your stack in 1 click — AEGIS automatically adapts playbooks, AI explanations, and mitigation commands to your environment."
      />

      {/* Info Banner */}
      <div className="panel-teal flex items-start gap-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--teal)' }} />
        <div className="text-sm" style={{ color: 'var(--text)' }}>
          <p className="font-semibold mb-1">How AEGIS Uses Your Environment:</p>
          <p style={{ color: 'var(--muted)' }} className="text-xs leading-relaxed">
            When an attack is detected, AEGIS avoids generic advice. It generates exact, executable containment commands for your stack (e.g. <code className="font-mono text-accent">iptables -A INPUT -s [IP] -j DROP</code> for Linux or <code className="font-mono text-accent">aws ec2 authorize-security-group-ingress...</code> for AWS).
          </p>
        </div>
      </div>

      {/* 1-Click Quick Presets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-accent" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            1-Click Environment Presets
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESETS.map(preset => {
            const Icon = preset.icon
            const isSelected = activePreset?.id === preset.id

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex items-start gap-3 ${
                  isSelected
                    ? 'border-accent bg-accent/10 shadow-lg shadow-accent/5'
                    : 'border-border bg-surface hover:border-accent/40 hover:bg-surface2'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    isSelected ? 'bg-accent/20 text-accent' : 'bg-surface2 text-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-text">{preset.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface2 text-muted">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1 leading-snug">
                    {preset.desc}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Simplified 3-Field Form */}
      <form onSubmit={handleSave} className="panel space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Active Stack Configuration (3 Fields)
          </h3>
          <span className="text-[11px] font-mono text-accent">
            {profile.cloud || 'Custom'} · {profile.firewall || 'Default'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.entries(ESSENTIAL_FIELDS).map(([name, config]) => {
            const Icon = config.icon
            return (
              <div key={name}>
                <label className="label flex items-center gap-1.5 text-xs mb-1">
                  <Icon className="w-3.5 h-3.5 text-accent" />
                  {config.label}
                </label>
                <select
                  className="input text-xs"
                  value={profile[name] || ''}
                  onChange={e => handleChange(name, e.target.value || null)}
                >
                  {config.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>

        {/* Custom notes */}
        <div>
          <label className="label text-xs">Specific Environment Notes (Optional)</label>
          <input
            type="text"
            className="input text-xs"
            placeholder="e.g. Gateway IP 192.168.1.1, Docker containers, Cloudflare CDN"
            value={profile.custom_notes || ''}
            onChange={e => handleChange('custom_notes', e.target.value || null)}
          />
        </div>

        {error && (
          <p className="text-xs text-risk-critical">{error}</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 text-xs py-2 px-4"
          >
            {saving ? (
              <><Spinner size="sm" /> Saving...</>
            ) : saved ? (
              <><CheckCircle className="w-4 h-4" /> Saved & Active!</>
            ) : (
              <><Save className="w-4 h-4" /> Save Environment Profile</>
            )}
          </button>

          {context && (
            <span className="text-[11px] font-mono text-muted">
              Active: {profile.cloud} / {profile.firewall}
            </span>
          )}
        </div>
      </form>

      {/* Live Example Box */}
      <div className="panel bg-surface2">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-3.5 h-3.5 text-accent" />
          <h4 className="text-xs font-bold text-text">
            Live Adaptation: How AEGIS Uses Your Current Profile
          </h4>
        </div>
        <div className="p-3 rounded bg-bg border border-border text-xs font-mono space-y-2">
          <p className="text-muted">
            # When an SSH brute force or port scan is detected on your system:
          </p>
          {profile.firewall?.toLowerCase().includes('aws') ? (
            <p className="text-accent">
              &gt; Generated Mitigation: <span className="text-text">aws ec2 authorize-security-group-ingress --group-id &lt;sg-id&gt; --cidr 198.51.100.42/32 --protocol all</span>
            </p>
          ) : profile.firewall?.toLowerCase().includes('azure') ? (
            <p className="text-accent">
              &gt; Generated Mitigation: <span className="text-text">az network nsg rule create --nsg-name &lt;nsg&gt; --priority 100 --source-address-prefixes 198.51.100.42</span>
            </p>
          ) : profile.firewall?.toLowerCase().includes('windows') ? (
            <p className="text-accent">
              &gt; Generated Mitigation: <span className="text-text">netsh advfirewall firewall add rule name="AEGIS Block" dir=in action=block remoteip=198.51.100.42</span>
            </p>
          ) : (
            <p className="text-accent">
              &gt; Generated Mitigation: <span className="text-text">sudo iptables -A INPUT -s 198.51.100.42 -j DROP && sudo iptables-save</span>
            </p>
          )}
          <p className="text-muted text-[11px]">
            Selected platform (<span className="text-accent">{profile.cloud || 'Linux'}</span>) dynamically personalizes all AI explanations and response playbooks.
          </p>
        </div>
      </div>
    </div>
  )
}
