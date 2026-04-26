<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=210&section=header&text=Job+Agent&fontSize=62&fontColor=fff&animation=twinkling&fontAlignY=36&desc=AI-powered+job+search+with+human+approval+gates&descAlignY=58&descSize=19" width="100%"/>

[![Typing SVG](https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=16&pause=1000&color=8B5CF6&center=true&vCenter=true&width=720&lines=Scrape+50+jobs+across+LinkedIn%2C+Indeed+and+more;AI+scores+each+job+0-100+against+your+profile;You+approve+or+reject+-+nothing+auto-submits;AI+tailors+a+resume+per+approved+job;You+review+before+anything+goes+out)](https://git.io/typing-svg)

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.0-FF6B35?style=for-the-badge)](https://langchain-ai.github.io/langgraph/)
[![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-CC785C?style=for-the-badge&logo=anthropic&logoColor=white)](https://www.anthropic.com/)

<br/>

[**Quick Start**](#quick-start) · [**Architecture**](#architecture) · [**Docs**](docs/) · [**Roadmap**](#roadmap)

</div>

---

## What it does

```mermaid
flowchart LR
    A["🔍 Scrape\n50+ jobs\n5 boards"] --> B["🤖 AI Scores\n0-100 vs\nyour profile"]
    B --> C{{"⛔ GATE 1\nYou Review"}}
    C -->|"✅ Approve"| D["📝 Tailored\nResume\nper job"]
    C -->|"❌ Reject"| Z(["🗑️ Skip"])
    D --> E{{"⛔ GATE 2\nYou Review"}}
    E -->|"✏️ Edit"| D
    E -->|"✅ Approve"| F["🚀 Auto\nSubmit"]
    F --> G["📊 Track in\nDashboard"]

    style C fill:#7C3AED,color:#fff,stroke:#5B21B6
    style E fill:#7C3AED,color:#fff,stroke:#5B21B6
    style Z fill:#374151,color:#9CA3AF,stroke:#4B5563
    style F fill:#059669,color:#fff,stroke:#047857
```

**Two mandatory human gates.** The agent never submits anything without your explicit approval — not once.

---

## Features

<details>
<summary><b>🔍 Job Discovery</b></summary>

- **5-board scraping** — LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs in one run
- **AI job scoring** — Claude or Gemini rates each job 0–100 with written reasoning, not just a number
- **Job search presets** — one-click for Internship, Entry Level, Senior, Remote, Contract
- **Target roles** — define exact titles; drives both scoring weights and default search queries
- **Duplicate detection** — SHA-256 URL fingerprinting skips jobs already in your database

</details>

<details>
<summary><b>📄 Resume Generation</b></summary>

- **Tailored resumes** — AI rewrites your base resume per job, matching keywords and tone
- **Resume upload** — drop in PDF, DOCX, or Markdown; text is extracted and structured automatically
- **RL/DPO preference learning** — the AI learns your editing style over time via Direct Preference Optimization

</details>

<details>
<summary><b>🛠 Infrastructure</b></summary>

- **Dual LLM support** — switch between Claude and Gemini per-user at any time from Settings
- **Real-time updates** — WebSocket agent status with polling fallback
- **LangGraph checkpointing** — persists state via `MemorySaver`; resumes after any server restart
- **MCP server** — exposes all agent tools via Model Context Protocol for composability
- **Precision dashboard** — Next.js 14 dark UI with job pipeline, analytics, resume editor

</details>

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, Zustand, Recharts |
| Backend | FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Alembic |
| Agent runtime | LangGraph 1.0 with MemorySaver checkpointing |
| LLMs | Claude Sonnet 4.6 (Anthropic) + Gemini 2.0 Flash (Google) |
| Scraping | JobSpy (5 boards) + Playwright with stealth mode |
| Database | PostgreSQL 16 + pgvector (1536-dim embeddings) |
| Task queue | Celery + Redis |
| ML / RL | sentence-transformers, HuggingFace TRL (DPO fine-tuning) |
| MCP | FastMCP |

---

## Quick start

> **Full setup guide**: [docs/SETUP.md](docs/SETUP.md) · **User guide**: [HOW_TO_USE.md](HOW_TO_USE.md)

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker + Docker Compose v2
- API key for **one of**: [Anthropic (Claude)](https://console.anthropic.com/) *(recommended)* or [Google AI Studio (Gemini)](https://aistudio.google.com/)

---

### 1 — Clone and configure

```bash
git clone https://github.com/parnish007/jobagent.git
cd jobagent/jobagent_code

cp .env.example .env
```

Open `.env` and set at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-...    # console.anthropic.com
SECRET_KEY=<random-32-chars>    # python -c "import secrets; print(secrets.token_hex(32))"
```

---

### 2 — Install Python dependencies

```bash
python -m venv .venv

source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

pip install -r requirements.txt
playwright install chromium --with-deps
```

---

### 3 — Start infrastructure

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d

# Verify containers are healthy:
docker compose -f docker/docker-compose.yml ps
```

---

### 4 — Run migrations and start the API *(Terminal 1)*

```bash
cd backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
# API → http://localhost:8000/docs
```

---

### 5 — Start the Celery worker *(Terminal 2)*

```bash
source .venv/bin/activate
cd backend
celery -A app.core.celery_app worker --pool=solo --loglevel=info
```

> **Windows:** `--pool=solo` is required. macOS/Linux: use `--pool=prefork -c 4` for parallelism.

---

### 6 — Start the frontend *(Terminal 3)*

```bash
cd frontend
npm install
npm run dev
# Dashboard → http://localhost:3000
```

---

### 7 (Optional) — Start the MCP server *(Terminal 4)*

```bash
cd mcp_server
python server.py
```

---

## First use

1. Open [http://localhost:3000](http://localhost:3000) → **Sign up**
2. Go to **Settings** → add Target Roles, Skills, AI provider, and default search config
3. Go to **Resume** → upload your PDF/DOCX or paste Markdown → **Save**
4. On **Dashboard** → click **Run Agent** to start the pipeline
5. In **Jobs** → review AI-scored cards, **Approve** or **Reject**
6. In **Resume** → review the tailored draft per job, edit if needed, **Save**
7. Track progress in **Applications** and **Analytics**

---

## Architecture

```mermaid
flowchart TD
    UI["🖥️ Next.js 14 Dashboard\nJobs · Resume · Analytics · Settings"]
    API["⚡ FastAPI\nREST + WebSocket"]
    AGENT["🧠 LangGraph Agent\nMemorySaver checkpoints"]
    CELERY["⚙️ Celery + Redis\nAsync task queue"]
    SCRAPER["🕷️ Scraping Layer\nJobSpy + Playwright stealth"]
    LLM["🤖 LLM Providers\nClaude Sonnet 4.6 and Gemini 2.0 Flash"]
    DB["🗄️ PostgreSQL 16 + pgvector\nRedis pub/sub"]

    UI -->|"REST + WebSocket"| API
    API -->|"Celery tasks"| CELERY
    API -->|"async"| AGENT
    CELERY --> AGENT
    AGENT --> SCRAPER
    AGENT --> LLM
    SCRAPER --> DB
    API --> DB

    style UI fill:#1E1B4B,color:#C4B5FD,stroke:#4C1D95
    style API fill:#1E3A5F,color:#93C5FD,stroke:#1E40AF
    style AGENT fill:#1C3829,color:#6EE7B7,stroke:#065F46
    style LLM fill:#3B1F2B,color:#F9A8D4,stroke:#9D174D
    style DB fill:#1F2937,color:#D1D5DB,stroke:#374151
    style CELERY fill:#292524,color:#FCD34D,stroke:#92400E
    style SCRAPER fill:#1E1B4B,color:#A5B4FC,stroke:#3730A3
```

### Agent graph

```mermaid
flowchart TD
    START(["▶ START"]) --> SCRAPE["🕷️ scrape_jobs\nJobSpy across 5 boards"]
    SCRAPE --> SCORE["🤖 score_jobs\nClaude or Gemini rates 0-100"]
    SCORE --> GATE1{{"⛔ INTERRUPT\nhuman_job_review"}}
    GATE1 -->|"✅ Approved"| RESUME["📝 generate_resumes\nTailored per job"]
    GATE1 -->|"❌ Rejected"| DISCARD(["🗑️ Dismissed"])
    RESUME --> GATE2{{"⛔ INTERRUPT\nhuman_resume_review"}}
    GATE2 -->|"✏️ Edit"| RESUME
    GATE2 -->|"✅ Approved"| SUBMIT["🚀 submit_applications\nBrowser automation"]
    SUBMIT --> END(["🏁 END"])

    style GATE1 fill:#7C3AED,color:#fff,stroke:#5B21B6
    style GATE2 fill:#7C3AED,color:#fff,stroke:#5B21B6
    style START fill:#059669,color:#fff,stroke:#047857
    style END fill:#059669,color:#fff,stroke:#047857
    style DISCARD fill:#374151,color:#9CA3AF,stroke:#4B5563
    style SUBMIT fill:#1D4ED8,color:#fff,stroke:#1E40AF
```

State is persisted via `MemorySaver` — the agent resumes from any checkpoint after a server restart.

---

## RL/DPO training

Job Agent collects preference signals passively and uses **Direct Preference Optimization** to improve resume generation to match your style over time.

| Signal | When it is recorded |
|--------|---------------------|
| `edit` | You edit an AI-generated resume — the edited version is marked preferred |
| `explicit_rating` | You thumbs-up or thumbs-down a resume in the UI |
| `outcome` | An application receives an interview response |

Once 50+ preference pairs are collected, go to **Resume → AI Training** and click **Start DPO Training**.

<details>
<summary><b>Running DPO training manually</b></summary>

Uncomment the DPO deps in `requirements.txt`, then:

```bash
pip install trl transformers datasets
# torch must be installed separately with CUDA support

cd backend
python -m app.rl.dpo_trainer --user-id <uuid>
```

</details>

---

## Configuration

All environment variables are documented in [`.env.example`](.env.example). Key ones:

```env
# LLM (at least one required)
ANTHROPIC_API_KEY=sk-ant-...        # console.anthropic.com
GEMINI_API_KEY=...                  # aistudio.google.com (optional)

# Required
SECRET_KEY=<random-32-chars>

# Optional
DEFAULT_LLM_PROVIDER=claude         # claude | gemini
ENVIRONMENT=development             # development | production
BRIGHT_DATA_API_KEY=...             # proxy rotation for high-volume scraping
LANGFUSE_PUBLIC_KEY=...             # agent observability and tracing
```

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first, then:

- **Bug reports** → [open an issue](https://github.com/parnish007/jobagent/issues/new?template=bug_report.md)
- **Pull requests** → fork → branch → PR against `main`

---

## Security

Found a vulnerability? **Do not open a public issue.** See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

## Roadmap

<details>
<summary><b>View full roadmap</b></summary>

**Shipped**
- [x] Multi-board scraping (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs)
- [x] AI job scoring with Claude and Gemini
- [x] Tailored resume generation per job
- [x] Resume upload (PDF, DOCX, Markdown)
- [x] Human approval gates (jobs + resumes)
- [x] Target roles chip UI + job search presets
- [x] Browser automation for form submission
- [x] Real-time WebSocket agent status
- [x] RL/DPO preference learning loop
- [x] MCP server (7 tools)

**Planned**
- [ ] Workday / Greenhouse / Lever ATS native support
- [ ] Email and Slack notifications for high-score matches
- [ ] Browser extension for one-click job capture
- [ ] Multi-user / team mode
- [ ] Production deployment guide (Railway, Fly.io)

</details>

---

## License

MIT © 2026 — see [LICENSE](LICENSE) for details.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=120&section=footer&animation=twinkling" width="100%"/>

*Built to remove the tedium from job hunting — not the human.*

[![Profile Views](https://komarev.com/ghpvc/?username=parnish007&color=7C6FFF&style=flat-square&label=Profile+Views)](https://github.com/parnish007/jobagent)

</div>
