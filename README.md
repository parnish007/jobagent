<div align="center">

# 🤖 Job Agent

**AI-powered job search automation with human-in-the-loop control.**

Scrapes jobs → scores them with AI → you approve → AI writes tailored resumes → you review → auto-submits applications. Nothing ever submits without your explicit approval.

[![CI](https://github.com/parnish007/jobagent/actions/workflows/ci.yml/badge.svg)](https://github.com/parnish007/jobagent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

</div>

---

## What it does

Job Agent runs a multi-stage pipeline that automates the most tedious parts of job searching while keeping **you** in full control:

```
Scrape 50 jobs → AI scores each 0–100 → YOU approve/reject →
AI writes tailored resume per job → YOU review/edit → Auto-submit
```

**You decide at every step.** The agent never submits an application you haven't approved.

---

## Features

- **Multi-board scraping** — LinkedIn, Indeed, Glassdoor, ZipRecruiter via [JobSpy](https://github.com/Bunsly/JobSpy)
- **AI job scoring** — Claude or Gemini scores each job 0–100 against your profile with reasoning
- **Tailored resumes** — AI rewrites your resume for each specific job using matched keywords
- **Human approval gates** — Two mandatory review steps before anything is submitted
- **Job search presets** — Quick filters: Internship, Entry Level, Senior, Remote, Contract
- **RL/DPO training** — The AI learns your resume preferences over time via Direct Preference Optimization
- **Real-time updates** — WebSocket-powered agent status in the dashboard
- **Dual LLM support** — Choose between Claude (Anthropic) and Gemini (Google)
- **Dark dashboard** — Clean Next.js 14 UI with Kanban pipeline, analytics, resume editor
- **MCP server** — Expose agent tools via Model Context Protocol for composability

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, Zustand, Recharts |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| Agents | LangGraph 1.0 with MemorySaver checkpointing |
| LLM | Claude Sonnet 4.6 (Anthropic) + Gemini 2.0 Flash (Google) |
| Scraping | JobSpy, Playwright with stealth |
| Database | PostgreSQL 16 + pgvector |
| Task queue | Celery + Redis |
| ML / RL | sentence-transformers, HuggingFace TRL (DPO) |
| MCP | FastMCP |

---

## Quick start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker + Docker Compose
- An API key for at least one LLM provider:
  - [Anthropic (Claude)](https://console.anthropic.com/) — recommended
  - [Google AI Studio (Gemini)](https://aistudio.google.com/)

### 1. Clone and configure

```bash
git clone https://github.com/parnish007/jobagent.git
cd jobagent/jobagent_code

cp docker/.env.example docker/.env
# Edit docker/.env and fill in at minimum:
#   ANTHROPIC_API_KEY=sk-ant-...   (if using Claude)
#   GEMINI_API_KEY=...             (if using Gemini)
#   SECRET_KEY=<random 32+ char string>
```

### 2. Start infrastructure

```bash
cd docker
docker compose up -d
# PostgreSQL :5432, Redis :6379, pgAdmin :5050
```

### 3. Set up backend

```bash
cd ../backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
playwright install chromium --with-deps

# Run database migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000
```

### 4. Start Celery worker (new terminal)

```bash
cd backend
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
celery -A app.core.celery_app worker --pool=solo --loglevel=info
```

> **Windows users:** Always use `--pool=solo` on Windows. Linux/macOS can use `--pool=prefork -c 4` for parallelism.

### 5. Start frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 6. (Optional) Start MCP server

```bash
cd mcp_server
pip install -r requirements.txt
python server.py
```

---

## First use

1. Open [http://localhost:3000](http://localhost:3000) and **create an account**
2. Go to **Settings** and fill in:
   - Your target job titles and skills (used for AI scoring)
   - Your base resume in Markdown format
   - Choose AI provider (Claude or Gemini)
   - Set your default search query and job type
3. Click **Run Agent** in the sidebar, or use the **Find Jobs** search bar on the dashboard
4. The agent scrapes jobs, scores them, and pauses — review scored jobs in the **Jobs** tab
5. Approve the jobs you like; the agent generates tailored resumes for each
6. Review resumes in the **Resume** tab, edit if needed
7. Confirm submission — the agent submits applications via browser automation
8. Track progress in the **Applications** Kanban board

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Next.js 14 Dashboard              │
│  (jobs, applications, resume, analytics)    │
└──────────────────┬──────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────────┐
│              FastAPI Backend                │
│     (auth, jobs, resume, agent, RL)         │
└───────────┬──────────────────┬──────────────┘
            │ Celery tasks     │ async/await
┌───────────▼──────────────────▼──────────────┐
│           LangGraph Agent Graph             │
│                                             │
│  scrape → score → [GATE 1: job review]  → │
│  generate resumes → [GATE 2: resume review]│
│  → submit applications                      │
└───────────┬──────────────────┬──────────────┘
            │                  │
┌───────────▼────────┐  ┌──────▼──────────────┐
│  Scraping Layer    │  │   LLM Providers     │
│  • JobSpy          │  │   • Claude (Anthropic)│
│  • Playwright      │  │   • Gemini (Google)  │
└───────────┬────────┘  └─────────────────────┘
            │
┌───────────▼──────────────────────────────────┐
│  Data Layer                                  │
│  PostgreSQL 16 + pgvector | Redis            │
└──────────────────────────────────────────────┘
```

### Agent graph

The agent uses LangGraph's stateful graph with checkpointing:

```
[START] → scrape_jobs → score_jobs
                              ↓
              ┌── [INTERRUPT: human_job_review] ──┐
              │   User approves/rejects in UI      │
              └────────────────────────────────────┘
                              ↓
                       generate_resumes
                              ↓
              ┌── [INTERRUPT: human_resume_review] ┐
              │   User reviews/edits resumes        │
              └────────────────────────────────────┘
                              ↓
                   submit_applications → [END]
```

State is persisted via `MemorySaver` — if the server restarts mid-run, the agent can resume from where it left off.

---

## RL / DPO training

Job Agent uses **Direct Preference Optimization (DPO)** to improve resume generation over time.

**How preference data is collected automatically:**

| Signal | When it happens |
|--------|----------------|
| `edit` | You edit an AI-generated resume (edited = preferred) |
| `explicit_rating` | You thumbs up/down a resume version |
| `outcome` | Application receives an interview response |

**When training runs:**
- After 50+ preference pairs are collected
- Go to **Resume → AI Training** tab and click "Start DPO Training"
- Training runs in the background (GPU recommended but not required)
- After training, the fine-tuned model is used for all future resume generation

**Under the hood:**
- Base model: `google/flan-t5-base` (~250MB)
- Framework: HuggingFace TRL `DPOTrainer`
- Similarity scoring (lightweight): `sentence-transformers/all-MiniLM-L6-v2`

---

## Configuration

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for all environment variables.

Key variables:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...      # Claude API key
# OR
GEMINI_API_KEY=...                # Gemini API key

SECRET_KEY=<random-32-chars>      # JWT signing key (CHANGE THIS)

# Optional
DEFAULT_LLM_PROVIDER=claude       # claude | gemini
BRIGHT_DATA_API_KEY=...           # Proxy rotation for scraping
LANGFUSE_PUBLIC_KEY=...           # Agent observability tracing
```

---

## API reference

The API is fully documented at `http://localhost:8000/docs` (Swagger UI) when running in development.

See [docs/API.md](docs/API.md) for the complete reference.

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

- **Bug reports**: [Open an issue](https://github.com/parnish007/jobagent/issues/new?template=bug_report.md)
- **Feature requests**: [Open an issue](https://github.com/parnish007/jobagent/issues/new?template=feature_request.md)
- **Pull requests**: Follow the [PR template](.github/PULL_REQUEST_TEMPLATE.md)

---

## Security

Found a security issue? Please **do not** open a public issue. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

## Roadmap

- [x] Multi-board job scraping (LinkedIn, Indeed, Glassdoor, ZipRecruiter)
- [x] AI job scoring with Claude + Gemini
- [x] Tailored resume generation
- [x] Human approval gates (jobs + resumes)
- [x] Browser automation for form submission
- [x] Real-time WebSocket agent status
- [x] Job search presets (Internship, Remote, Contract, etc.)
- [x] RL/DPO preference learning
- [ ] Workday / Greenhouse / Lever ATS support
- [ ] Email/Slack notifications for high-score matches
- [ ] Browser extension for one-click job capture
- [ ] Multi-user / team mode
- [ ] Production deployment configs

---

## License

MIT © 2026 — see [LICENSE](LICENSE) for details.
