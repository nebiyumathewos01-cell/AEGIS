import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Shield, Bot, Zap, Terminal, CheckCircle2,
  AlertTriangle, Copy, Check, ExternalLink, ArrowRight,
  Server, Cpu, Lock, FileCode, Layers, Radio
} from 'lucide-react'
import PageHeader from '../components/PageHeader'

const SAMPLE_LOGS = {
  ssh_brute_force: `Sep 16 03:14:20 web-srv01 sshd[14221]: Failed password for invalid user admin from 185.220.101.47 port 51234 ssh2
Sep 16 03:14:22 web-srv01 sshd[14223]: Failed password for invalid user root from 185.220.101.47 port 51236 ssh2
Sep 16 03:14:25 web-srv01 sshd[14225]: Failed password for invalid user support from 185.220.101.47 port 51240 ssh2
Sep 16 03:14:28 web-srv01 sshd[14227]: Failed password for invalid user operator from 185.220.101.47 port 51242 ssh2
Sep 16 03:14:31 web-srv01 sshd[14229]: Failed password for invalid user ubuntu from 185.220.101.47 port 51246 ssh2`,

  sql_injection: `198.51.100.45 - - [16/Sep/2026:10:45:12 +0000] "GET /api/v1/users?id=1%20UNION%20SELECT%20username,password%20FROM%20admin-- HTTP/1.1" 500 482 "-" "sqlmap/1.7.2#stable"
198.51.100.45 - - [16/Sep/2026:10:45:14 +0000] "GET /api/v1/products?cat=electronics'%20OR%20'1'='1 HTTP/1.1" 200 1205 "-" "Mozilla/5.0"
198.51.100.45 - - [16/Sep/2026:10:45:16 +0000] "POST /login HTTP/1.1" 401 128 "http://target.com/login" "sqlmap/1.7.2#stable"`,

  cisco_port_scan: `<189>Sep 16 11:20:00 cisco-core-sw01 %SEC-6-IPACCESSLOGP: list 101 denied tcp 203.0.113.12(49152) -> 10.0.1.5(22), 1 packet
<189>Sep 16 11:20:01 cisco-core-sw01 %SEC-6-IPACCESSLOGP: list 101 denied tcp 203.0.113.12(49153) -> 10.0.1.5(80), 1 packet
<189>Sep 16 11:20:02 cisco-core-sw01 %SEC-6-IPACCESSLOGP: list 101 denied tcp 203.0.113.12(49154) -> 10.0.1.5(443), 1 packet
<189>Sep 16 11:20:03 cisco-core-sw01 %SEC-6-IPACCESSLOGP: list 101 denied tcp 203.0.113.12(49155) -> 10.0.1.5(3389), 1 packet`,

  cloudtrail_privilege: `{
  "eventVersion": "1.08",
  "eventTime": "2026-09-16T12:00:00Z",
  "eventSource": "iam.amazonaws.com",
  "eventName": "AttachUserPolicy",
  "awsRegion": "us-east-1",
  "sourceIPAddress": "141.98.11.11",
  "userAgent": "aws-cli/2.15.0 Python/3.11.6",
  "requestParameters": {
    "userName": "temporary_contractor",
    "policyArn": "arn:aws:iam::aws:policy/AdministratorAccess"
  },
  "responseElements": null
}`
}

export default function Docs() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [copiedKey, setCopiedKey] = useState(null)

  function copyLog(key, text) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const tabs = [
    { id: 'overview',     label: 'System Overview',     icon: Layers },
    { id: 'lifecycle',    label: '6-Stage Agent Loop',   icon: Bot },
    { id: 'tools',        label: 'Investigation Tools',  icon: Cpu },
    { id: 'guardrails',   label: 'Guardrails & Actions', icon: Shield },
    { id: 'parsers',      label: 'Parsers & Ingestion',  icon: Terminal },
    { id: 'samples',      label: 'Sample Alert Tests',   icon: FileCode },
    { id: 'api',          label: 'API Reference',        icon: Radio },
  ]

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader
        title="Documentation & Architecture"
        subtitle="Complete reference guide for the AEGIS Autonomous SOC Assistant platform"
      />

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-cyber-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === id
                ? 'bg-cyber-accent/15 text-cyber-accent border border-cyber-accent/30'
                : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-surface2 border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content: System Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-base font-bold text-cyber-text mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyber-accent" />
              What is AEGIS?
            </h2>
            <p className="text-sm text-cyber-muted leading-relaxed mb-4">
              AEGIS (<span className="font-semibold text-cyber-text">Alert Evaluation & Guided Investigation System</span>) is an enterprise SOC orchestration platform engineered to solve alert fatigue. It marries a high-throughput <span className="font-semibold text-cyber-accent">Deterministic Rule Engine</span> with an autonomous <span className="font-semibold text-cyber-teal">Human-in-the-Loop Agentic AI</span>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded border border-cyber-border bg-cyber-surface2">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-cyber-accent" />
                  <h3 className="font-bold text-xs uppercase tracking-wide text-cyber-text">Deterministic Rule Engine</h3>
                </div>
                <p className="text-xs text-cyber-muted leading-relaxed">
                  Evaluates every alert instantly without latency or hallucinations. Computes ground-truth risk score (0–100), severity levels (LOW, MEDIUM, HIGH, CRITICAL), and explicit score factor deltas. This score remains completely unaltered by the AI.
                </p>
              </div>
              <div className="p-4 rounded border border-cyber-border bg-cyber-surface2">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-cyber-teal" />
                  <h3 className="font-bold text-xs uppercase tracking-wide text-cyber-text">Agentic AI SOC Assistant</h3>
                </div>
                <p className="text-xs text-cyber-muted leading-relaxed">
                  Autonomously investigates alerts across multiple iterative turns. Correlates historical attack campaigns, extracts event timelines, checks live threat intelligence, queries known CVE weaknesses, and proposes safe response actions.
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-cyber-text mb-3">Enterprise Architecture Highlights</h3>
            <ul className="space-y-2 text-xs text-cyber-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyber-teal shrink-0 mt-0.5" />
                <span><strong className="text-cyber-text">Zero Unsupervised Damage</strong>: State-changing remediation actions (firewall block, account lockout, network isolation) are halted at the Human Approval Gate until authorized by an analyst.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyber-teal shrink-0 mt-0.5" />
                <span><strong className="text-cyber-text">Live Threat Intelligence</strong>: Real-time open IP telemetry and ASN enrichment with automatic fallback for RFC-1918 private corporate networks.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyber-teal shrink-0 mt-0.5" />
                <span><strong className="text-cyber-text">Full Auditability & Compliance</strong>: Every reasoning step, tool query, approval note, and response output is immutably logged in UTC for SOC 2 and ISO 27001 audits.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyber-teal shrink-0 mt-0.5" />
                <span><strong className="text-cyber-text">Instant Report Download</strong>: 1-click download of the official forensic Investigation Report containing telemetry, deterministic rule factors, and approval audit trails upon investigation completion.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab Content: 6-Stage Lifecycle */}
      {activeTab === 'lifecycle' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-base font-bold text-cyber-text mb-2">The 6-Stage Core Lifecycle</h2>
            <p className="text-xs text-cyber-muted mb-4">
              AEGIS governs the entire alert journey from raw log ingestion to verified remediation, continuous feedback, and formal incident documentation:
            </p>
            <div className="p-3 rounded bg-cyber-bg border border-cyber-border font-mono text-xs text-cyber-accent text-center mb-6 overflow-x-auto">
              Raw Alert → Agent Loop → Guardrails → Human Approval → Safe Response → Feedback & Report Download
            </div>

            <div className="space-y-4">
              {[
                {
                  num: '01',
                  title: 'Raw Alert Ingestion & Baseline Scoring',
                  color: 'var(--accent)',
                  desc: 'Security events arrive via API webhooks, syslog forwarders, or manual paste. The Rule Engine parses the payload and calculates an objective baseline risk score (0–100). The AI is strictly prohibited from altering this deterministic foundation.'
                },
                {
                  num: '02',
                  title: 'Autonomous Agent Investigation Loop',
                  color: 'var(--teal)',
                  desc: 'The agent inspects missing evidence and autonomously invokes tools: searching historical alerts from the same IP, querying threat intelligence, sequencing attack timestamps into a timeline, and matching CVE vulnerabilities.'
                },
                {
                  num: '03',
                  title: 'Safety Guardrails',
                  color: '#f59e0b',
                  desc: 'Enforces hard boundaries: limits execution to a maximum of 8 iterations to prevent runaway token costs, and checks all proposed actions against an approved SAFE_ACTIONS dictionary. Arbitrary shell commands are permanently rejected.'
                },
                {
                  num: '04',
                  title: 'Human Approval Gate',
                  color: '#f59e0b',
                  desc: 'Read-only actions (like monitoring and forensic snapshots) execute automatically. Any action that changes system or network state (firewall drop, account lockout) is placed in the approval queue awaiting explicit human authorization.'
                },
                {
                  num: '05',
                  title: 'Predefined Safe Response Execution',
                  color: 'var(--teal)',
                  desc: 'Upon analyst approval, the predefined safe response action is executed. Specific execution outcomes, timestamps, and authorized analyst identities are recorded in the database.'
                },
                {
                  num: '06',
                  title: 'Feedback Loop & Report Download',
                  color: '#a855f7',
                  desc: 'The analyst rates investigation accuracy (1–5 stars, false-positive marker, comments) to close the lifecycle. Analysts can immediately download the complete official forensic investigation report.'
                },
              ].map(step => (
                <div key={step.num} className="p-4 rounded border border-cyber-border bg-cyber-surface2 flex gap-4 items-start">
                  <span className="text-sm font-black font-mono px-2 py-1 rounded" style={{ background: `${step.color}20`, color: step.color }}>
                    {step.num}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-cyber-text mb-1">{step.title}</h3>
                    <p className="text-xs text-cyber-muted leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Download Architecture Card */}
          <div className="card">
            <h3 className="text-sm font-bold text-cyber-text mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyber-accent" />
              Forensic Investigation Report Download
            </h3>
            <p className="text-xs text-cyber-muted mb-4 leading-relaxed">
              Once the Agentic AI concludes its investigation, analysts can download a comprehensive, boardroom-ready forensic dossier with 1 click:
            </p>
            <div className="p-4 rounded border border-cyber-border bg-cyber-surface2 space-y-2 text-xs">
              <p className="font-bold text-cyber-accent">Official Forensic Report Contents</p>
              <ul className="space-y-1.5 text-cyber-muted list-disc list-inside">
                <li><strong className="text-cyber-text">Executive Verdict & Confidence</strong>: Final AI verdict, confidence score, and contextual summary.</li>
                <li><strong className="text-cyber-text">Deterministic RuleEngine Baseline</strong>: Objective ground-truth score (0–100) and evaluated MITRE rule factor deltas.</li>
                <li><strong className="text-cyber-text">Autonomous Findings & Evidence</strong>: Corroborated IOCs, attack timelines, and threat intelligence.</li>
                <li><strong className="text-cyber-text">Human-in-the-Loop Actions & Audit Log</strong>: Timestamped records of analyst approvals, rejections, and execution outcomes.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Investigation Tools */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-bold text-cyber-text mb-2">The Agentic Toolkit</h2>
            <p className="text-xs text-cyber-muted mb-4">
              During investigation, the SOC Assistant dynamically decides which tools to invoke based on available data:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: 'search_related_alerts',
                  label: 'Related Alerts Search',
                  desc: 'Correlates past security alerts by Source IP, Target Username, or Attack Type to detect repeat offenders and coordinated campaigns.'
                },
                {
                  name: 'threat_intelligence',
                  label: 'Live Threat Intelligence',
                  desc: 'Queries VirusTotal API and live open IP telemetry for ASN, Country, Hosting Organization, and multi-vendor malicious detection tallies.'
                },
                {
                  name: 'build_attack_timeline',
                  label: 'Attack Timeline Builder',
                  desc: 'Extracts event timestamps from raw logs to determine attack frequency, duration, burst activity, and automated tooling signatures.'
                },
                {
                  name: 'cve_lookup',
                  label: 'CVE & Weakness Knowledgebase',
                  desc: 'Maps attack classifications to MITRE CWE and CVE identifiers with specific developer and administrator mitigation steps.'
                },
                {
                  name: 'evaluate_risk_with_context',
                  label: 'Risk Contextualizer',
                  desc: 'Combines the baseline rule score with threat intelligence bonuses to explain the true operational impact to the analyst.'
                },
                {
                  name: 'generate_final_assessment',
                  label: 'Assessment Synthesizer',
                  desc: 'Synthesizes all evidence into a plain-English verdict, confidence rating (LOW, MEDIUM, HIGH), and prioritized action plan.'
                },
              ].map(t => (
                <div key={t.name} className="p-3.5 rounded border border-cyber-border bg-cyber-surface2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-cyber-text">{t.label}</span>
                    <span className="font-mono text-[10px] text-cyber-accent bg-cyber-bg px-1.5 py-0.5 rounded border border-cyber-border">{t.name}</span>
                  </div>
                  <p className="text-xs text-cyber-muted leading-relaxed mt-2">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Guardrails & Actions */}
      {activeTab === 'guardrails' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-base font-bold text-cyber-text mb-2">Predefined Safe Actions Catalog</h2>
            <p className="text-xs text-cyber-muted mb-4">
              The agent is strictly constrained to the <code className="text-cyber-accent font-mono">SAFE_ACTIONS</code> catalog. It cannot execute arbitrary code or shell injection:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cyber-border text-cyber-muted text-left">
                    <th className="py-2.5 px-3">Action Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Risk Level</th>
                    <th className="py-2.5 px-3">Approval Required?</th>
                    <th className="py-2.5 px-3">Reversible?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-border/40 text-cyber-text font-mono">
                  {[
                    { type: 'increase_monitoring', desc: 'Enable verbose telemetry & audit capture', risk: 'LOW', approval: 'Automatic (No)', rev: 'Yes' },
                    { type: 'collect_forensics',  desc: 'Archive process memory & socket states', risk: 'LOW', approval: 'Automatic (No)', rev: 'Yes' },
                    { type: 'block_ip',           desc: 'Deploy firewall DROP rule for source IP', risk: 'LOW', approval: 'Human Required (Yes)', rev: 'Yes' },
                    { type: 'rate_limit',         desc: 'Throttle connection rate on service', risk: 'LOW', approval: 'Human Required (Yes)', rev: 'Yes' },
                    { type: 'lock_account',       desc: 'Temporarily lock targeted account', risk: 'MEDIUM', approval: 'Human Required (Yes)', rev: 'Yes' },
                    { type: 'notify',             desc: 'Dispatch incident webhook to on-call SOC', risk: 'LOW', approval: 'Human Required (Yes)', rev: 'No' },
                    { type: 'isolate_host',       desc: 'Isolate host from subnet routing', risk: 'HIGH', approval: 'Human Required (Yes)', rev: 'Yes' },
                  ].map(a => (
                    <tr key={a.type}>
                      <td className="py-2.5 px-3 text-cyber-accent font-bold">{a.type}</td>
                      <td className="py-2.5 px-3 font-sans text-cyber-muted">{a.desc}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          a.risk === 'HIGH' ? 'bg-red-950/40 text-risk-high' :
                          a.risk === 'MEDIUM' ? 'bg-amber-950/40 text-risk-medium' :
                          'bg-emerald-950/40 text-risk-low'
                        }`}>{a.risk}</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {a.approval.includes('Human') ? (
                          <span className="text-amber-400 font-medium">{a.approval}</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">{a.approval}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-cyber-muted">{a.rev}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Parsers */}
      {activeTab === 'parsers' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-bold text-cyber-text mb-2">Supported Ingestion Parsers</h2>
            <p className="text-xs text-cyber-muted mb-4">
              AEGIS features intelligent pattern dispatchers to parse structured and unstructured log formats:
            </p>
            <div className="space-y-3 text-xs">
              {[
                { name: 'Linux Auth / Syslog', ex: 'sshd failed password, sudo attempts, PAM auth failures', ports: '22, 23' },
                { name: 'Apache & Nginx Access Logs', ex: 'Combined log format with URI query strings and user agents', ports: '80, 443' },
                { name: 'Cisco IOS Syslog', ex: 'Denied ACL entries, IP access log packets, connection rejects', ports: 'Layer 3/4' },
                { name: 'AWS CloudTrail JSON', ex: 'AttachUserPolicy, StopLogging, AuthorizeSecurityGroupIngress', ports: 'Cloud APIs' },
                { name: 'Generic Security Events', ex: 'Port scan summaries, Suricata / Snort alert records', ports: 'Any' },
              ].map(p => (
                <div key={p.name} className="p-3 rounded border border-cyber-border bg-cyber-surface2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-cyber-text block">{p.name}</span>
                    <span className="text-cyber-muted">{p.ex}</span>
                  </div>
                  <span className="font-mono text-[10px] text-cyber-accent bg-cyber-bg px-2 py-1 rounded border border-cyber-border shrink-0 ml-4">
                    {p.ports}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Sample Logs */}
      {activeTab === 'samples' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-cyber-text">Test Alert Playground</h2>
                <p className="text-xs text-cyber-muted">Copy any sample log below and paste it into the "New Alert" page to test the system live.</p>
              </div>
              <button
                onClick={() => navigate('/alerts/new')}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                Go to New Alert <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {[
                { key: 'ssh_brute_force', title: '1. Linux SSH Brute Force (Tor Exit Node)', text: SAMPLE_LOGS.ssh_brute_force },
                { key: 'sql_injection',   title: '2. Apache Web SQL Injection (sqlmap probe)', text: SAMPLE_LOGS.sql_injection },
                { key: 'cisco_port_scan', title: '3. Cisco Firewall Port Scan Probing',       text: SAMPLE_LOGS.cisco_port_scan },
                { key: 'cloudtrail_privilege', title: '4. AWS CloudTrail Unauthorized IAM Elevation', text: SAMPLE_LOGS.cloudtrail_privilege },
              ].map(s => (
                <div key={s.key} className="rounded border border-cyber-border overflow-hidden bg-cyber-surface2">
                  <div className="flex items-center justify-between px-3 py-2 bg-cyber-bg border-b border-cyber-border">
                    <span className="font-semibold text-xs text-cyber-text">{s.title}</span>
                    <button
                      onClick={() => copyLog(s.key, s.text)}
                      className="btn-secondary text-[11px] px-2.5 py-1 flex items-center gap-1"
                    >
                      {copiedKey === s.key ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === s.key ? 'Copied!' : 'Copy Log'}
                    </button>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-cyber-text overflow-x-auto max-h-36 whitespace-pre-wrap">
                    {s.text}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: API Reference */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-cyber-text">Core REST API Endpoints</h2>
                <p className="text-xs text-cyber-muted">All endpoints support JWT Bearer authorization.</p>
              </div>
              <a
                href="https://aegis-1-15r0.onrender.com/api/docs"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                Live Swagger UI <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="space-y-2 text-xs font-mono">
              {[
                { method: 'POST', path: '/api/alerts', desc: 'Ingest raw security log and compute rule score' },
                { method: 'POST', path: '/api/agent/{alert_id}/investigate', desc: 'Trigger autonomous SOC agent investigation loop' },
                { method: 'GET',  path: '/api/agent/session/{session_id}', desc: 'Retrieve full investigation session with complete audit trail' },
                { method: 'GET',  path: '/api/agent/approvals', desc: 'List all pending actions across the enterprise requiring human approval' },
                { method: 'PUT',  path: '/api/agent/actions/{id}/approve', desc: 'Analyst approves action and executes predefined safe response' },
                { method: 'PUT',  path: '/api/agent/actions/{id}/reject', desc: 'Analyst rejects action with mandatory justification note' },
                { method: 'POST', path: '/api/agent/session/{id}/feedback', desc: 'Submit analyst feedback rating and close investigation loop' },
                { method: 'POST', path: '/api/threat-intelligence/ip', desc: 'Enrich IP with live geolocation, ASN, and reputation data' },
                { method: 'GET',  path: '/api/health', desc: 'System health check and version status' },
              ].map(ep => (
                <div key={ep.path} className="p-2.5 rounded border border-cyber-border bg-cyber-surface2 flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    ep.method === 'POST' ? 'bg-blue-950/60 text-blue-400 border border-blue-800/40' :
                    ep.method === 'PUT'  ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' :
                    'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="text-cyber-text font-bold shrink-0">{ep.path}</span>
                  <span className="font-sans text-cyber-muted text-xs truncate ml-auto">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
