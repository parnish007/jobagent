<div align="center">

# 🤖 Job Agent

**AI-powered job search automation with human-in-the-loop control.**

Scrapes jobs → scores them with AI → you approve → AI writes tailored resumes → you review → auto-submits.
Nothing ever submits without your explicit approval.

[![CI](https://github.com/parnish007/jobagent/actions/workflows/ci.yml/badge.svg)](https://github.com/parnish007/jobagent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

</div>

---

## What it does

```
Scrape 50 jobs  →  AI scores 0–100  →  YOU approve/reject
       →  AI writes tailored resume per job  →  YOU review/edit  →  Auto-submit
```

The agent pauses at **two mandatory human gates** before anything is submitted.

---

## Features

- **Multi-board scraping** — LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs
- **AI job scoring** — Claude or Gemini scores each job 0–100 against your profile with reasoning
- **Tailored resumes** — AI rewrites your base resume for each specific job using matched keywords
- **Human approval gates** — Two review steps (jobs + resumes) before anything submits
- **Job search presets** — Quick filters: Internship, Entry Level, Senior, Remote, Contract
- **Resume upload** — Upload PDF, DOCX, or Markdown and the AI extracts the text for you
- **Target roles** — Define exact roles to target; drives scoring and default search
- **RL/DPO training** — The AI learns your resume style over time via Direct Preference Optimization
- **Real-time updates** — WebSocket-powered agent status, falls back to polling
- **Dual LLM support** — Switch between Claude (Anthropic) and Gemini (Google) per-user
- **Dark dashboard** — Next.js 14 UI with Kanban pipeline, analytics, resume editor
- **MCP server** — Expose agent tools via Model Context Protocol for composability

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, Zustand |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| Agents | LangGraph with MemorySaver checkpointing |
| LLM | Claude Sonnet 4.6 (Anthropic) + Gemini 2.0 Flash (Google) |
| Scraping | JobSpy (5 boards) + Playwright with stealth mode |
| Database | PostgreSQL 16 + pgvector |
| Task queue | Celery + Redis |
| ML / RL | sentence-transformers, HuggingFace TRL (DPO) |
| MCP | FastMCP |

---

## Quick start

> **Full setup guide**: [docs/SETUP.md](docs/SETUP.md)
> **First-time user guide**: [HOW_TO_USE.md](HOW_TO_USE.md)

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker + Docker Compose v2
- An API key for **one** of:
  - [Anthropic (Claude)](https://console.anthropic.com/) — recommended
  - [Google AI Studio (Gemini)](https://aistudio.google.com/)

---

### Step 1 — Clone and configure

```bash
# All commands below run from jobagent_code/ unless noted otherwise
git clone https://github.com/parnish007/jobagent.git
cd jobagent/jobagent_code

cp .env.example .env
```

Open `.env` and set at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-...    # get from console.anthropic.com
SECRET_KEY=<random-32-chars>    # run: python -c "import secrets; print(secrets.token_hex(32))"
```

---

### Step 2 — Install Python dependencies

One virtualenv at the root — covers the backend, agents, and MCP server.

```bash
# pwd: jobagent_code/
python -m venv .venv

# Activate (pick one):
source .venv/bin/activate        # macOS / Linux
.venv\Scripts\activate           # Windows (cmd / PowerShell)

pip install -r requirements.txt
playwright install chromium --with-deps
```

---

### Step 3 — Start infrastructure

```bash
# pwd: jobagent_code/
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

Check it's healthy:

```bash
docker compose -f docker/docker-compose.yml ps
# Both containers should show: Up (healthy)
```

---

### Step 4 — Run migrations and start the API  *(Terminal 1)*

```bash
# pwd: jobagent_code/backend/
cd backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
# API running at http://localhost:8000
# Leave this terminal running
```

---

### Step 5 — Start Celery worker  *(Terminal 2 — new terminal)*

```bash
# pwd: jobagent_code/  →  then cd backend
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows
cd backend
celery -A app.core.celery_app worker --pool=solo --loglevel=info
# Leave this terminal running
```

> **Windows:** `--pool=solo` is required. macOS/Linux can use `--pool=prefork -c 4` for parallelism.

---

### Step 6 — Start the frontend  *(Terminal 3 — new terminal)*

```bash
# pwd: jobagent_code/frontend/
cd frontend
cp ../.env.example .env.local   # frontend reads NEXT_PUBLIC_* from here
npm install
npm run dev
# Dashboard at http://localhost:3000
```

---

### Step 7 (Optional) — Start MCP server  *(Terminal 4)*

```bash
# pwd: jobagent_code/mcp_server/
# No extra install needed — packages are already in requirements.txt
cd mcp_server
python server.py
```

---

## First use

1. Open [http://localhost:3000](http://localhost:3000) → **Sign up**
2. Go to **Settings** and fill in:
   - **Target Roles** — the specific job titles you want (chip-based input)
   - **Skills** — everything you know (AI uses this for scoring)
   - **AI provider** — Claude or Gemini
   - **Default search** — query, location, job type, sources
3. Go to **Resume** → upload a PDF/DOCX or paste Markdown → click **Save**
4. Back on **Dashboard** → click **Run Agent** or type a search → hit **Search**
5. In **Jobs** tab: review AI-scored cards, **Approve** or **Reject** each one
6. In **Resume** tab: review the tailored draft for each approved job, edit if needed, click **Save**
7. Track everything in **Applications** (Kanban) and **Analytics**

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Next.js 14 Dashboard              │
│  Jobs · Applications · Resume · Analytics  │
└──────────────────┬──────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────────┐
│              FastAPI Backend                │
│        auth · jobs · resume · agent · RL   │
└───────────┬──────────────────┬──────────────┘
            │ Celery tasks     │ async/await
┌───────────▼──────────────────▼──────────────┐
│           LangGraph Agent Graph             │
│                                             │
│  scrape → score → [GATE 1: job review]      │
│  → generate resumes → [GATE 2: resume review│
│  → submit applications                      │
└───────────┬──────────────────┬──────────────┘
            │                  │
┌───────────▼────────┐  ┌──────▼──────────────┐
│  Scraping Layer    │  │   LLM Providers     │
│  JobSpy (5 boards) │  │   Claude · Gemini   │
│  Playwright        │  └─────────────────────┘
└───────────┬────────┘
            │
┌───────────▼──────────────────────────────────┐
│  Data Layer                                  │
│  PostgreSQL 16 + pgvector  ·  Redis          │
└──────────────────────────────────────────────┘
```

### Agent graph

```
[START] → scrape_jobs → score_jobs
                             ↓
             ┌── [INTERRUPT: human_job_review] ──┐
             │   User approves / rejects in UI    │
             └───────────────────────────────────┘
                             ↓
                      generate_resumes
                             ↓
             ┌── [INTERRUPT: human_resume_review] ┐
             │   User reviews / edits resumes      │
             └───────────────────────────────────┘
                             ↓
                  submit_applications → [END]
```

State is persisted via `MemorySaver` — the agent can resume from any checkpoint if the server restarts.

---

## RL / DPO training

Job Agent collects preference signals automatically and uses **Direct Preference Optimization** to improve future resume generation.

| Signal | When it's recorded |
|--------|-------------------|
| `edit` | You edit an AI-generated resume — the edited version is marked as preferred |
| `explicit_rating` | You thumbs up / down a resume in the UI |
| `outcome` | An application gets an interview response |

Once 50+ pairs are collected, go to **Resume → AI Training** and click **Start DPO Training**.

---

## Configuration

All environment variables are documented inside [`.env.example`](.env.example).

Key variables:

```env
# Required (at least one)
ANTHROPIC_API_KEY=sk-ant-...      # Claude — console.anthropic.com
GEMINI_API_KEY=...                # Gemini — aistudio.google.com

# Required
SECRET_KEY=<random-32-chars>

# Optional
DEFAULT_LLM_PROVIDER=claude       # claude | gemini
ENVIRONMENT=development           # development | production
BRIGHT_DATA_API_KEY=...           # proxy rotation for scraping
LANGFUSE_PUBLIC_KEY=...           # agent observability tracing
```

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Then:

- **Bug reports** → [open an issue](https://github.com/parnish007/jobagent/issues/new?template=bug_report.md)
- **Feature requests** → [open an issue](https://github.com/parnish007/jobagent/issues/new?template=feature_request.md)
- **Pull requests** → follow the [PR template](.github/PULL_REQUEST_TEMPLATE.md)

---

## Security

Found a vulnerability? Please **do not** open a public issue. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

## Roadmap

- [x] Multi-board job scraping (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs)
- [x] AI job scoring with Claude + Gemini
- [x] Tailored resume generation
- [x] Resume upload (PDF / DOCX / Markdown)
- [x] Target roles chip UI
- [x] Human approval gates (jobs + resumes)
- [x] Browser automation for form submission
- [x] Real-time WebSocket agent status
- [x] Job search presets
- [x] RL/DPO preference learning
- [ ] Workday / Greenhouse / Lever ATS support
- [ ] Email/Slack notifications for high-score matches
- [ ] Browser extension for one-click job capture
- [ ] Multi-user / team mode
- [ ] Production deployment guide

---

## License

MIT © 2026 — see [LICENSE](LICENSE) for details.
