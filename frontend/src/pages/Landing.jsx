import { useNavigate } from 'react-router-dom'
import {
  Shield, AlertTriangle, Brain, BarChart2,
  FileText, Search, ChevronRight, Lock,
  Activity, Server, Globe, CheckCircle
} from 'lucide-react'

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: FileText,
    title: '20 Log Source Parsers',
    desc: 'Automatically parses alerts from Nmap, Suricata, Snort, Windows Event Log, Firewall, Apache, DNS, AWS CloudTrail, EDR, and 11 more.',
  },
  {
    icon: Shield,
    title: 'Rule-Based Risk Scoring',
    desc: 'A deterministic engine with 9 security rules assigns a transparent 0–100 risk score. Every point is explained — no black box.',
  },
  {
    icon: Brain,
    title: 'AI-Powered Explanation',
    desc: 'AI receives structured evidence (never raw logs) and generates plain-English summaries, threat interpretations, and 5-step investigation guides.',
  },
  {
    icon: Activity,
    title: 'Full Investigation Workflow',
    desc: 'Analysts can track alert status (New → Investigating → Resolved), add notes, view event timelines, and export PDF reports.',
  },
  {
    icon: Search,
    title: 'Threat Intelligence',
    desc: 'Look up IP addresses and domains against VirusTotal. Works offline with demo data when no API key is configured.',
  },
  {
    icon: Lock,
    title: 'Multi-User Authentication',
    desc: 'JWT-based login system with per-user data isolation. Each analyst sees only their own alerts. Full audit log of all activity.',
  },
]

const PIPELINE = [
  { step: '01', label: 'Raw Alert',          desc: 'Paste, upload, or pick a demo' },
  { step: '02', label: 'Parser',             desc: 'Extract IPs, ports, usernames, timestamps' },
  { step: '03', label: 'Rule Engine',        desc: '9 deterministic security rules' },
  { step: '04', label: 'Risk Score',         desc: 'Transparent 0–100 scoring' },
  { step: '05', label: 'AI Explanation',     desc: 'Plain-English analysis' },
  { step: '06', label: 'Investigation Report', desc: 'PDF export, analyst notes' },
]

const TECH = [
  { label: 'FastAPI',     cat: 'Backend' },
  { label: 'Python 3.11', cat: 'Backend' },
  { label: 'SQLAlchemy',  cat: 'Backend' },
  { label: 'SQLite',      cat: 'Database' },
  { label: 'React 18',    cat: 'Frontend' },
  { label: 'Vite',        cat: 'Frontend' },
  { label: 'Tailwind CSS',cat: 'Frontend' },
  { label: 'Recharts',    cat: 'Frontend' },
  { label: 'JWT Auth',    cat: 'Security' },
  { label: 'Ollama LLM',  cat: 'AI' },
  { label: 'jsPDF',       cat: 'Reports' },
  { label: 'Docker',      cat: 'Deploy' },
]

const SCENARIOS = [
  { title: 'SSH Brute-Force',          level: 'CRITICAL', color: 'text-red-400' },
  { title: 'Port Scan (Nmap)',         level: 'HIGH',     color: 'text-orange-400' },
  { title: 'C2 Communication',         level: 'CRITICAL', color: 'text-red-400' },
  { title: 'Ransomware Activity',      level: 'CRITICAL', color: 'text-red-400' },
  { title: 'SQL Injection (WAF)',      level: 'HIGH',     color: 'text-orange-400' },
  { title: 'Lateral Movement (SMB)',   level: 'CRITICAL', color: 'text-red-400' },
  { title: 'DNS Tunneling',            level: 'HIGH',     color: 'text-orange-400' },
  { title: 'Privilege Escalation',     level: 'HIGH',     color: 'text-orange-400' },
  { title: 'Data Exfiltration',        level: 'HIGH',     color: 'text-orange-400' },
  { title: 'Insider Threat',           level: 'MEDIUM',   color: 'text-yellow-400' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text">

      {/* ── Top nav ── */}
      <nav className="border-b border-cyber-border bg-cyber-surface/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="AEGIS" className="w-8 h-8" />
            <span className="font-black text-cyber-text tracking-widest text-lg">AEGIS</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="btn-ghost text-sm px-4 py-2"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="btn-primary text-sm px-4 py-2"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="flex justify-center mb-8">
          <img src="/logo.svg" alt="AEGIS" className="w-28 h-28 drop-shadow-2xl" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyber-accent/10
                        border border-cyber-accent/30 rounded-full text-xs text-cyber-accent
                        font-mono mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent animate-pulse" />
          Graduation Project · EGATE Summer Camp 2024
        </div>

        <h1 className="text-5xl lg:text-6xl font-black tracking-widest text-cyber-text mb-2">
          AEGIS
        </h1>
        <p className="text-lg text-cyber-accent font-mono tracking-widest uppercase mb-4">
          Alert Evaluation &amp; Guided Investigation System
        </p>
        <p className="text-cyber-muted max-w-2xl mx-auto text-base leading-relaxed mb-10">
          An AI-powered cybersecurity platform that automatically parses security alerts,
          calculates transparent risk scores using rule-based analysis, and generates
          plain-English investigation guidance — helping junior analysts triage threats faster.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate('/register')}
            className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
          >
            Launch Platform
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="btn-secondary flex items-center gap-2 px-6 py-3 text-base"
          >
            Sign In
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mt-16">
          {[
            { value: '20',  label: 'Log Sources' },
            { value: '9',   label: 'Security Rules' },
            { value: '20',  label: 'Demo Scenarios' },
            { value: '100', label: 'Risk Score Max' },
          ].map(({ value, label }) => (
            <div key={label} className="card text-center py-4">
              <p className="text-3xl font-black text-cyber-accent">{value}</p>
              <p className="text-xs text-cyber-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pipeline ── */}
      <section className="bg-cyber-surface border-y border-cyber-border py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-cyber-text text-center mb-2">How It Works</h2>
          <p className="text-cyber-muted text-center text-sm mb-10">
            Every alert goes through a 6-step pipeline — from raw log to investigation report
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {PIPELINE.map(({ step, label, desc }, i) => (
              <div key={step} className="relative">
                <div className="card text-center h-full">
                  <div className="w-8 h-8 rounded-full bg-cyber-accent/10 border border-cyber-accent/30
                                  flex items-center justify-center mx-auto mb-2">
                    <span className="text-xs font-mono font-bold text-cyber-accent">{step}</span>
                  </div>
                  <p className="text-sm font-semibold text-cyber-text mb-1">{label}</p>
                  <p className="text-xs text-cyber-muted leading-relaxed">{desc}</p>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-1.5 -translate-y-1/2 z-10">
                    <ChevronRight className="w-3 h-3 text-cyber-accent" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-cyber-text text-center mb-2">Core Features</h2>
        <p className="text-cyber-muted text-center text-sm mb-10">
          Built for real defensive security analysis — not a generic chatbot
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card hover:border-cyber-accent/30 transition-colors">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-cyber-accent/10 rounded-lg border border-cyber-accent/20 shrink-0">
                  <Icon className="w-4 h-4 text-cyber-accent" />
                </div>
                <p className="font-semibold text-cyber-text pt-1">{title}</p>
              </div>
              <p className="text-sm text-cyber-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo Scenarios ── */}
      <section className="bg-cyber-surface border-y border-cyber-border py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-cyber-text text-center mb-2">
            20 Built-In Demo Scenarios
          </h2>
          <p className="text-cyber-muted text-center text-sm mb-10">
            Realistic attack simulations — no external tools required
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SCENARIOS.map(({ title, level, color }) => (
              <div key={title} className="card py-3 text-center">
                <p className="text-xs font-semibold text-cyber-text mb-1">{title}</p>
                <span className={`text-[10px] font-mono font-bold ${color}`}>{level}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-cyber-muted mt-4">
            + 10 more scenarios including FTP brute force, UDP scan, web shell upload, successful breach, and more
          </p>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-cyber-text text-center mb-2">Technology Stack</h2>
        <p className="text-cyber-muted text-center text-sm mb-10">
          Industry-standard tools chosen for reliability and scalability
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {TECH.map(({ label, cat }) => (
            <div key={label}
              className="flex items-center gap-2 px-3 py-2 bg-cyber-surface border border-cyber-border
                         rounded-lg hover:border-cyber-accent/40 transition-colors">
              <span className="text-[9px] font-mono text-cyber-muted uppercase bg-cyber-bg
                               px-1.5 py-0.5 rounded border border-cyber-border">{cat}</span>
              <span className="text-sm font-medium text-cyber-text">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture ── */}
      <section className="bg-cyber-surface border-y border-cyber-border py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-cyber-text text-center mb-2">System Architecture</h2>
          <p className="text-cyber-muted text-center text-sm mb-8">
            The AI never sees raw logs — it only receives validated, structured evidence
          </p>
          <div className="card bg-cyber-bg font-mono text-sm text-cyber-muted p-6 overflow-x-auto">
            <pre className="leading-relaxed">{`
  ┌─────────────────────────────────────────────────────┐
  │                  React Frontend                     │
  │   Dashboard · Alerts · Investigations · Reports     │
  └───────────────────────┬─────────────────────────────┘
                          │ REST API (JWT Auth)
  ┌───────────────────────▼─────────────────────────────┐
  │                FastAPI Backend                      │
  └────────┬──────────────┬────────────────┬────────────┘
           │              │                │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼──────┐
    │   Parser    │ │Rule Engine │ │  Database   │
    │ 20 sources  │ │  9 rules   │ │   SQLite    │
    └──────┬──────┘ └─────┬──────┘ └─────────────┘
           └──────┬────────┘
                  │ Structured Evidence
          ┌───────▼────────┐
          │  AI Analyzer   │
          │ Ollama / Rules │
          └───────┬────────┘
                  │
          ┌───────▼────────┐
          │ Investigation  │
          │    Report      │
          └────────────────┘
`.trim()}</pre>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <img src="/logo.svg" alt="AEGIS" className="w-16 h-16 mx-auto mb-6 opacity-90" />
        <h2 className="text-3xl font-bold text-cyber-text mb-3">Ready to explore AEGIS?</h2>
        <p className="text-cyber-muted mb-8 max-w-md mx-auto">
          Create a free account and analyze your first security alert in under a minute.
        </p>
        <button
          onClick={() => navigate('/register')}
          className="btn-primary flex items-center gap-2 px-8 py-3 text-base mx-auto"
        >
          Create Account
          <ChevronRight className="w-4 h-4" />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-cyber-border bg-cyber-surface py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="AEGIS" className="w-6 h-6" />
            <span className="text-sm font-bold text-cyber-text tracking-widest">AEGIS</span>
            <span className="text-xs text-cyber-muted">v2.0</span>
          </div>
          <p className="text-xs text-cyber-muted text-center">
            Alert Evaluation &amp; Guided Investigation System · Graduation Project · EGATE Summer Camp
          </p>
          <p className="text-xs text-cyber-muted font-mono">
            Defensive Use Only
          </p>
        </div>
      </footer>

    </div>
  )
}

