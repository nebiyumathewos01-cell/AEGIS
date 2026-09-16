# 🛡️ AEGIS: Agentic AI SOC Assistant & Alert Response Platform

[![Deploy with Vercel](https://img.shields.io/badge/Vercel-Live%20App-black?style=flat&logo=vercel)](https://aegis-eta-two.vercel.app)
[![API on Render](https://img.shields.io/badge/Render-FastAPI%20Backend-46e3b7?style=flat&logo=render)](https://aegis-1-15r0.onrender.com/api/docs)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue?style=flat&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat&logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

> **AEGIS** is an Enterprise-Grade **Agentic AI Security Operations Center (SOC)** Alert Investigation, Correlation, and Incident Response Platform. It bridges the gap between static rule-based SIEM detection and autonomous AI investigation, using **Human-in-the-Loop (HITL) Guardrails** for secure, accountable response actions.

---

## 🌐 Live Deployments

| Component | URL | Status | Description |
| :--- | :--- | :--- | :--- |
| **Web Application** | [aegis-eta-two.vercel.app](https://aegis-eta-two.vercel.app) | ![Online](https://img.shields.io/badge/status-active-brightgreen) | Full SOC Analyst interface with Burp Suite / Cyberpunk tactical dark/light mode |
| **Interactive Docs** | [aegis-eta-two.vercel.app/docs](https://aegis-eta-two.vercel.app/docs) | ![Online](https://img.shields.io/badge/status-active-brightgreen) | In-app architecture, lifecycle diagrams, and sample alert test suites |
| **FastAPI Swagger API**| [aegis-1-15r0.onrender.com/api/docs](https://aegis-1-15r0.onrender.com/api/docs) | ![Online](https://img.shields.io/badge/status-active-brightgreen) | Interactive REST API documentation and schema specifications |

---

## 🚀 Core Philosophy: Why Agentic AI?

Traditional SOC platforms suffer from **alert fatigue** (thousands of alerts daily, high false-positive rate) and **slow MTTR** (analysts manually querying threat intelligence, cross-referencing IPs, and correlating events).

AEGIS introduces a **Dual-Engine Architecture**:
1. **Deterministic Rule Engine (0–100 baseline)**: Fast, deterministic SIGMA-style heuristics, MITRE ATT&CK technique mapping, and rule-based risk scoring that **never changes or drifts**.
2. **Autonomous Agentic AI SOC Assistant**: A goal-directed reasoning loop that dynamically plans investigations, invokes read-only diagnostic tools, gathers multi-source evidence, synthesizes threat context, and formulates response actions subject to **Human-in-the-Loop Guardrails**.

```
  ┌─────────────────┐
  │ 1. Raw Alert    │ ◄── Linux Auth, Apache/Nginx, Cisco IOS, CloudTrail
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────┐
  │ 2. Agent Investigation Loop     │ ◄── Autonomous multi-step tool calls
  │    • search_related_alerts      │
  │    • threat_intelligence        │
  │    • build_attack_timeline      │
  │    • cve_lookup                 │
  │    • evaluate_risk_with_context │
  └────────┬────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────┐
  │ 3. Guardrails Engine            │ ◄── Safe response action whitelist validation
  └────────┬────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────┐
  │ 4. Human Approval (HITL)        │ ◄── Analyst approves / modifies / rejects
  └────────┬────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────┐
  │ 5. Executed Response            │ ◄── Predefined safe remediation (e.g., block IP, isolate host)
  └────────┬────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────┐
  │ 6. Feedback, Closure & Export   │ ◄── Immutable audit trail, feedback loop & PDF/MD/JSON report export
  └─────────────────────────────────┘
```

> **Presentation Tip: "Is it Agentic AI if there is human approval?"**
> **Yes, absolutely!** In high-stakes enterprise cybersecurity, granting an AI unchecked autonomous authority to shut down core production servers is reckless. **Autonomy is in the *investigation, reasoning, evidence gathering, and decision synthesis***. The human approval gate is an enterprise safety guardrail (Human-in-the-Loop), analogous to how Level 4 autonomous driving requests driver takeover or confirmation in critical situations.

---

## ⚡ Key Features

- **Deterministic Rule Engine Sole Authority**: Risk scoring (0–100) is strictly and deterministically computed by AEGIS's heuristic `RuleEngine`. The Agentic AI does **not** alter, drift, or hallucinate the baseline risk score—its focus is purely autonomous multi-turn evidence gathering, correlation, timeline sequencing, and safe action proposals.
- **Autonomous Multi-Step Investigation**: The AI agent independently decides what to query based on findings. If an IP appears suspicious, it queries threat feeds, cross-references recent alerts from the same subnet, constructs an attack timeline, and matches known CVE vulnerabilities.
- **Strict Guardrail Boundaries**:
  - **Read-Only Tools**: Can run autonomously (threat intel lookups, alert correlation, timeline reconstruction).
  - **State-Modifying Actions**: Require explicit human approval (host isolation, IP blocking, credential revocation).
- **Predefined Safe Response Actions (`SAFE_ACTIONS`)**:
  - `block_ip` — Add suspicious IP to firewall drop list with expiration.
  - `isolate_host` — Quarantine compromised endpoint from network segment.
  - `revoke_session` — Invalidate compromised JWT or OAuth bearer tokens.
  - `disable_user` — Lock breached Active Directory / IAM credentials.
  - `quarantine_file` — Restrict and hash suspect binary or payload.
- **Multi-Format Ingestion Parsers**:
  - Linux `auth.log` / `secure` (SSH brute force, `sudo` abuse, privilege escalation)
  - Apache / Nginx Combined Access Logs (SQLi, XSS, directory traversal, web crawlers)
  - Cisco IOS Syslog (`%SEC-6-IPACCESSLOGP` ACL drops, port scans)
  - AWS CloudTrail JSON events (`AttachUserPolicy`, `CreateAccessKey`, unauthorized IAM calls)
- **Live Threat Intelligence Engine**: Real-time IP geolocation, ISP/ASN lookup, curated threat actor attribution, Tor exit node detection, and RFC-1918 private network identification.
- **Tamper-Evident Audit Trail**: Every tool invocation, reasoning step, analyst approval/rejection timestamp, and remediation outcome is permanently recorded with complete telemetry.
- **1-Click Forensic Incident Report Exports**: Once an investigation completes, analysts can immediately download:
  - **Executive PDF Report**: Multi-page report with cover brief, deterministic rule breakdown, confirmed evidence, CVEs, HITL decisions, and audit trail.
  - **Markdown Dossier (`.md`)**: GitHub-flavored format ready for pasting into Jira tickets, ServiceNow incidents, or Slack war rooms.
  - **Machine Telemetry (`.json`)**: Raw export formatted for SIEM / SOAR pipeline archival.

---

## 🛠️ Technology Stack

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI (Asynchronous REST API)
- **Database**: PostgreSQL (production via Neon / Render) with SQLite local fallback
- **AI Model**: Google Gemini API (`gemini-1.5-pro` / `gemini-1.5-flash`) with fallback heuristic rule agents
- **Security**: JWT authentication, bcrypt password hashing, CORS middleware

### Frontend
- **Framework**: React 18 with Vite 5
- **Routing**: React Router v6
- **Styling**: Tailwind CSS, custom Cyberpunk/Burp Suite dark & light tactical SOC themes
- **Icons**: Lucide React
- **Visuals**: Canvas-based interactive attack graph visualization

---

## 📂 Project Structure

```
AEGIS/
├── backend/
│   ├── main.py                     # FastAPI entry point & CORS configuration
│   ├── config.py                   # Environment settings & secrets
│   ├── database.py                 # SQLAlchemy DB engine & session management
│   ├── models/                     # Database models (Alert, User, Investigation, Audit)
│   ├── schemas/                    # Pydantic validation schemas
│   ├── routers/
│   │   ├── auth.py                 # Authentication & JWT tokens
│   │   ├── alerts.py               # Alert ingestion, listing & detail
│   │   ├── agent.py                # Agentic AI investigation & execution loop
│   │   ├── threat_intel.py         # Real-time threat intelligence service
│   │   ├── investigations.py      # Investigation report history
│   │   ├── environment.py          # Organization environment profiling
│   │   └── audit.py                # Immutable audit log queries
│   ├── services/
│   │   ├── parsers.py              # Log format parsers (Linux, Nginx, Cisco, AWS)
│   │   ├── rule_engine.py          # Deterministic baseline risk scorer (0-100)
│   │   └── agent_tools.py          # Tool catalog & HITL guardrail execution
│   └── requirements.txt            # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Route definitions & theme/auth wrappers
│   │   ├── main.jsx                # React DOM mount point
│   │   ├── components/             # Reusable UI components (Layout, Header, Modals)
│   │   ├── context/                # AuthContext & ThemeContext
│   │   └── pages/
│   │       ├── Dashboard.jsx       # SOC Command Center overview & charts
│   │       ├── Alerts.jsx          # Real-time alert list & triage table
│   │       ├── NewAlert.jsx        # Raw log ingestion & rule evaluation
│   │       ├── AgentInvestigation.jsx # Agentic AI investigation loop & HITL approval
│   │       ├── Investigations.jsx  # Past completed investigation cases
│   │       ├── ThreatIntelligence.jsx # IP reputation & threat intel sandbox
│   │       ├── EnvironmentProfile.jsx # SOC asset criticality configuration
│   │       ├── AuditLog.jsx        # Tamper-evident SOC audit trail
│   │       ├── Docs.jsx            # In-app architecture & user documentation
│   │       └── Settings.jsx        # User API keys & model preferences
│   ├── tailwind.config.js          # Tailwind theme colors & extensions
│   ├── vite.config.js              # Vite bundler configuration
│   └── package.json                # Frontend dependencies
│
└── README.md                       # Project documentation
```

---

## 💻 Local Quickstart Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & `npm`
- *(Optional)* Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone Repository
```bash
git clone https://github.com/nebiyumathewos01-cell/AEGIS.git
cd AEGIS
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:
```env
SECRET_KEY="your-super-secret-jwt-key"
DATABASE_URL="sqlite:///./aegis.db"
GEMINI_API_KEY="your-gemini-api-key-optional"
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

Start the backend server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*Backend Swagger docs will be live at `http://localhost:8000/api/docs`.*

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Create a `.env` file in `frontend/`:
```env
VITE_API_URL=http://localhost:8000
```

Start the frontend development server:
```bash
npm run dev
```
*Frontend application will be live at `http://localhost:5173`.*

---

## 🧪 Testing with Sample Logs

AEGIS includes pre-configured sample attack payloads in the **Docs** page (`/docs`) and **New Alert** (`/alerts/new`):

### Sample 1: SSH Brute Force (Linux Auth)
```text
Sep 16 03:14:20 web-srv01 sshd[14221]: Failed password for invalid user admin from 185.220.101.47 port 51234 ssh2
Sep 16 03:14:22 web-srv01 sshd[14223]: Failed password for invalid user root from 185.220.101.47 port 51236 ssh2
Sep 16 03:14:25 web-srv01 sshd[14225]: Failed password for invalid user support from 185.220.101.47 port 51240 ssh2
```
*Agent will correlate repeated failures, lookup the Tor exit node `185.220.101.47`, and recommend a `block_ip` response.*

### Sample 2: SQL Injection (Nginx / Apache)
```text
198.51.100.45 - - [16/Sep/2026:10:45:12 +0000] "GET /api/v1/users?id=1%20UNION%20SELECT%20username,password%20FROM%20admin-- HTTP/1.1" 500 482 "-" "sqlmap/1.7.2#stable"
```
*Agent detects sqlmap automated user agent, extracts SQL UNION payload, and recommends WAF IP block and session invalidation.*

---

## 🛡️ Response Action Safety Guardrails

All proposed response actions adhere to strict validation before presentation to the analyst:

| Action ID | Permitted Targets | Guardrail Validation Check | Risk Impact |
| :--- | :--- | :--- | :--- |
| `block_ip` | Valid IPv4/IPv6 | Validates IP format; prevents blocking internal RFC1918 gateways or loopback addresses | Low |
| `isolate_host` | Registered Hostnames | Checks against critical infrastructure whitelist; prevents isolating primary domain controllers | High |
| `revoke_session` | User IDs, Tokens | Invalidation scope limited to target user; retains session audit trail | Low |
| `disable_user` | IAM / User accounts | Prevents disabling root/admin accounts; requires dual-analyst verification for executive tiers | Medium |
| `quarantine_file` | File Paths, Hashes | Validates hash integrity and moves to sandboxed isolated volume | Low |

---

## 👥 Authors & Acknowledgments

- **Developer**: Nebiyu Mathewos
- **Repository**: [https://github.com/nebiyumathewos01-cell/AEGIS](https://github.com/nebiyumathewos01-cell/AEGIS)
- **Live Demo**: [https://aegis-eta-two.vercel.app](https://aegis-eta-two.vercel.app)
