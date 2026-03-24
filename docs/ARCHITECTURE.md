# Architecture

This document covers the full system design of Job Agent — component responsibilities, data flow, agent state machine, and database schema.

---

## Table of Contents

- [System Overview](#system-overview)
- [Component Responsibilities](#component-responsibilities)
- [End-to-End Data Flow](#end-to-end-data-flow)
- [Agent Graph](#agent-graph)
- [Human-in-the-Loop Gates](#human-in-the-loop-gates)
- [Database Schema](#database-schema)
- [API Layer](#api-layer)
- [Task Queue](#task-queue)
- [MCP Server](#mcp-server)
- [Key Design Decisions](#key-design-decisions)

---

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│                                                              │
│  /dashboard      — job feed + stats                          │
│  /jobs           — review queue with approve/reject          │
│  /applications   — Kanban pipeline                           │
│  /resume         — split editor with live Markdown preview   │
│  /analytics      — charts: applications, interview rate      │
│  /settings       — profile, preferences, Q&A bank           │
└─────────────────────────┬────────────────────────────────────┘
                          │ HTTP REST  /  WebSocket
┌─────────────────────────▼────────────────────────────────────┐
│                      FastAPI Backend                         │
│                                                              │
│  /api/v1/auth        — JWT register / login                  │
│  /api/v1/jobs        — listing, approve, reject, scrape      │
│  /api/v1/applications — pipeline, submit, outcome           │
│  /api/v1/resume      — base resume, generate draft           │
│  /api/v1/agent       — run trigger, status, WebSocket        │
└─────────┬──────────────────────────────────┬─────────────────┘
          │ Celery tasks                      │ async calls
┌─────────▼─────────────────────────────────▼─────────────────┐
│                    LangGraph Agent Graph                     │
│                                                              │
│  scrape_jobs → score_jobs → [GATE 1] → generate_resumes →   │
│  [GATE 2] → submit_applications                              │
└─────────┬──────────────────────────────────┬─────────────────┘
          │                                  │
┌─────────▼──────────┐            ┌──────────▼─────────────────┐
│  Scraping Layer     │            │  FastMCP Server             │
│                     │            │                             │
│  • JobSpy           │            │  scrape_jobs()              │
│  • Playwright       │            │  score_job()                │
│  • stealth headers  │            │  generate_resume()          │
│  • proxy rotation   │            │  update_job_status()        │
└─────────┬──────────┘            │  record_outcome()           │
          │                        │  get_user_profile()         │
          │                        │  list_pending_jobs()        │
          │                        └─────────────────────────────┘
┌─────────▼────────────────────────────────────────────────────┐
│                        Data Layer                            │
│                                                              │
│  PostgreSQL 16 + pgvector          Redis 7                   │
│  ─────────────────────────         ───────────────           │
│  users / user_profiles             Celery broker             │
│  raw_jobs / scored_jobs            Celery results            │
│  job_embeddings (pgvector)         (future: pub/sub          │
│  applications / outcomes            for WebSocket)           │
│  resume_versions / preferences                               │
│  agent_runs                                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### Frontend (Next.js 14)

- **App Router** with server components where possible; client components only where interactivity is required
- **React Query** for all server state — caching, background refresh, optimistic updates
- **Zustand** for UI-local state (selected job, panel open/closed, etc.)
- **Recharts** for analytics charts
- **Socket.io client** for real-time agent status updates via WebSocket

### Backend (FastAPI)

- Stateless REST API — all state lives in the database
- **JWT authentication** (python-jose) — short-lived access tokens, stored client-side in `localStorage`
- **Async SQLAlchemy 2.0** — non-blocking database queries throughout; no sync code in request handlers
- **Pydantic v2** schemas for request validation and response serialization
- **CORS** configured for `localhost:3000` in development; update `CORS_ORIGINS` for production

### LangGraph Agents

Each agent is an **async node function** in a LangGraph `StateGraph`. Nodes read from and write to `AgentState` (a TypedDict). The graph is compiled with `MemorySaver` checkpointing so state is preserved across restarts.

| Node | Responsibility |
|------|---------------|
| `scraper_node` | Calls JobSpy/Playwright, deduplicates via SHA256 fingerprint, writes `raw_jobs` |
| `scorer_node` | Calls Claude with a scoring prompt, writes `scored_jobs` with 0–100 score + reasoning |
| `human_job_review` | **Interrupt point** — graph pauses here; resumes when user approves jobs via API |
| `resume_node` | Calls Claude with a resume tailoring prompt per approved job, writes `resume_versions` |
| `human_resume_review` | **Interrupt point** — graph pauses here; resumes when user confirms resume via API |
| `application_node` | Playwright automation to detect form type and submit; writes `applications` |

### Scraping Layer

- **JobSpy** handles the heavy lifting for LinkedIn, Indeed, Glassdoor, and ZipRecruiter — it's a synchronous library so it runs in a thread pool executor to avoid blocking the async event loop
- **Playwright** handles custom/dynamic job sites and form interaction for application submission
- **playwright-stealth** patches browser fingerprints to reduce bot detection
- **Deduplication** — every job URL is SHA256-hashed into a `fingerprint` column; duplicate scrapes are silently skipped

### Database

PostgreSQL 16 with the `pgvector` extension for semantic similarity search on job embeddings.

### MCP Server

A FastMCP server that exposes 7 tools callable via the Model Context Protocol. This allows the agents to be composed with external AI systems (e.g., Claude Desktop, other agents) or called directly in tool-use workflows.

---

## End-to-End Data Flow

```
1. User fills profile (settings page)
   → user_profiles row created/updated

2. Agent run triggered (sidebar button or POST /agent/run)
   → Celery task enqueued → LangGraph graph starts

3. scraper_node runs
   → JobSpy fetches jobs from boards
   → Each job fingerprinted + deduplicated
   → New jobs inserted into raw_jobs

4. scorer_node runs
   → For each raw_job: Claude prompt with user profile + job description
   → Claude returns: {score, reasoning, matched_skills, missing_skills}
   → scored_jobs rows created with status = pending_review

5. Graph pauses at human_job_review interrupt
   → Dashboard shows pending_review jobs with scores
   → User clicks Approve/Reject on each card
   → POST /jobs/{id}/approve updates scored_job.status = approved

6. Graph resumes (POST /agent/resume or WebSocket trigger)
   → resume_node generates tailored resume per approved job
   → ResumeVersion rows created

7. Graph pauses at human_resume_review interrupt
   → User opens Resume tab, reviews generated resume for each job
   → User edits if needed, clicks confirm
   → resume_version.user_edited = true if modified

8. Graph resumes → application_node
   → Playwright opens job URL
   → Detects form type (LinkedIn Easy Apply, Indeed Quick Apply, custom)
   → Fills form with resume content + Q&A bank answers
   → Application row created with status = submitted

9. User records outcomes (interviews, rejections) in Applications tab
   → application_outcomes row created
   → (Phase 2) Preference pairs saved for RL reward model training
```

---

## Agent Graph

```
[START]
   │
   ▼
scrape_jobs
   │
   ▼
score_jobs ──── (0 scored) ──────────────────► [END]
   │
   │ (jobs scored > 0)
   ▼
human_job_review ◄──── INTERRUPT: waits for user approval
   │
   │ (approved_job_ids populated)
   ▼
generate_resumes ──── (0 generated) ──────────► [END]
   │
   │ (resumes generated > 0)
   ▼
human_resume_review ◄── INTERRUPT: waits for user review
   │
   │ (resume_approved = true)
   ▼
submit_applications
   │
   ▼
[END]
```

### State transitions

The `AgentState` TypedDict flows through every node. Key fields:

```python
class AgentState(TypedDict):
    user_id: str
    agent_run_id: str
    thread_id: str               # LangGraph checkpoint ID
    scrape_config: dict
    raw_job_ids: list[str]
    scored_job_ids: list[str]
    approved_job_ids: list[str]  # Set by human gate 1
    resume_version_ids: list[str]
    resume_approved: bool         # Set by human gate 2
    application_ids: list[str]
    jobs_scraped: int
    jobs_scored: int
    errors: list[str]
    current_step: str
    messages: list               # Append-only for LLM message history
```

---

## Human-in-the-Loop Gates

LangGraph's `interrupt_before` mechanism pauses execution before a node and persists the full state to the checkpointer. Execution resumes when the API is called.

### Gate 1 — Job Review

- **Triggers**: After `score_jobs` finishes scoring at least one job
- **What the user sees**: Job cards with score, reasoning, matched/missing skills
- **User action**: Approve or reject each job via the dashboard
- **Resume signal**: When the user has reviewed all pending jobs, the frontend calls the agent resume endpoint (or it's triggered by the next agent run)

### Gate 2 — Resume Review

- **Triggers**: After `generate_resumes` creates at least one draft
- **What the user sees**: Split-panel resume editor with live Markdown preview
- **User action**: Review, optionally edit, then confirm submission
- **Edit tracking**: If the user edits the resume, `user_edited = true` — this becomes a positive preference signal for the RL reward model

---

## Database Schema

```sql
-- Core user tables
users              (id, email, hashed_password, full_name, is_active)
user_profiles      (id, user_id, target_titles[], skills[], salary_min/max,
                    remote_only, blacklisted_companies[], base_resume_text,
                    auto_approve_score_threshold, daily_application_limit)
qa_bank            (id, user_id, question, answer, category)

-- Job pipeline
raw_jobs           (id, fingerprint, source, url, title, company, location,
                    description, salary_min/max, remote, posted_date, raw_data)
scored_jobs        (id, raw_job_id, user_id, score, score_reasoning,
                    matched_skills[], missing_skills[], status)
job_embeddings     (id, job_id, embedding vector(1536))  -- pgvector

-- Application pipeline
applications       (id, user_id, scored_job_id, resume_version_id,
                    status, submission_method, form_answers)
application_outcomes (id, application_id, outcome, days_to_response)

-- Resume + RL
resume_versions    (id, user_id, scored_job_id, content, rl_score,
                    generation_prompt, user_edited, version_number)
resume_preferences (id, user_id, chosen_version_id, rejected_version_id,
                    signal_type)   -- DPO training pairs

-- Observability
agent_runs         (id, user_id, status, current_step, jobs_scraped,
                    jobs_scored, applications_submitted, thread_id,
                    error_message, duration_seconds)
```

### Key indexes

```sql
UNIQUE  raw_jobs(fingerprint)                          -- dedup
INDEX   scored_jobs(user_id, status)                   -- feed queries
INDEX   applications(user_id, status)                  -- kanban queries
UNIQUE  scored_jobs(raw_job_id)                        -- one score per job
IVFFLAT job_embeddings(embedding) vector_cosine_ops   -- semantic search
```

### Job status lifecycle

```
raw_jobs:     (created) → (permanent)

scored_jobs:  pending_review → approved
                            ↘ rejected
                            → applied

applications: draft → resume_ready → submitted → responded → interview
                                                           ↘ rejected
                                  → offer
                                  → closed
```

---

## API Layer

See [API.md](API.md) for the full reference. High-level groupings:

```
POST  /api/v1/auth/register
POST  /api/v1/auth/login
GET   /api/v1/auth/me

GET   /api/v1/jobs?status=pending_review
POST  /api/v1/jobs/{id}/approve
POST  /api/v1/jobs/{id}/reject
POST  /api/v1/jobs/scrape

GET   /api/v1/applications
POST  /api/v1/applications/{id}/submit
POST  /api/v1/applications/{id}/outcome

GET   /api/v1/resume
PUT   /api/v1/resume
GET   /api/v1/resume/{job_id}/draft
POST  /api/v1/resume/{job_id}/generate
POST  /api/v1/resume/preference

GET   /api/v1/agent/status
POST  /api/v1/agent/run
WS    /api/v1/agent/ws/{user_id}
```

All endpoints except `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`.

---

## Task Queue

Celery with Redis as both broker and result backend. All long-running operations run as Celery tasks:

| Task | Trigger | Duration |
|------|---------|---------|
| `run_full_agent` | POST /agent/run | 5–30 min (depends on jobs + LLM calls) |
| `run_scrape_task` | POST /jobs/scrape | 1–5 min |
| `run_resume_task` | POST /resume/{id}/generate | 10–30 sec per job |
| `run_submit_task` | POST /applications/{id}/submit | 30–120 sec per application |

Workers run with `--pool=solo` on Windows. On Linux/macOS use `--pool=prefork -c 4` for concurrency.

---

## MCP Server

The FastMCP server (`mcp_server/server.py`) exposes these tools:

| Tool | Description |
|------|-------------|
| `scrape_jobs` | Scrape job listings from specified boards |
| `score_job` | LLM-score a single job against a user profile |
| `generate_resume` | Generate a tailored resume for a job |
| `get_user_profile` | Fetch a user's preferences and skills |
| `update_job_status` | Approve or reject a scored job |
| `record_outcome` | Log an application outcome for RL feedback |
| `list_pending_jobs` | List jobs awaiting user review |

These tools allow Job Agent to be used as a building block in larger AI workflows — e.g., a Claude Desktop agent that monitors your inbox and automatically records interview outcomes.

---

## Key Design Decisions

### Why LangGraph?

LangGraph provides explicit state machine semantics with checkpointing. This means:
- The agent graph is inspectable — you can see exactly which node is running
- Interrupts are first-class — pausing for human approval is built in, not hacked
- State survives restarts — if the server goes down mid-run, the agent resumes from the checkpoint

### Why Celery instead of running agents directly in FastAPI?

Agent runs can take 5–30 minutes (scraping is slow; LLM calls add up). Running long tasks directly in FastAPI would tie up request handlers. Celery decouples execution from the HTTP layer, supports task monitoring, and handles retries.

### Why pgvector?

Job embeddings enable semantic similarity search — useful for finding jobs similar to ones the user has previously approved, and for deduplicating semantically identical listings even when the URLs differ. The `ivfflat` index makes queries on thousands of embeddings fast.

### Why not auto-submit everything?

The explicit human gates are intentional. Job applications carry professional risk — a bad resume or wrong-fit job submitted at scale would hurt the user's reputation. The system is designed to amplify human judgment, not replace it.

### Why DPO for the RL layer?

Direct Preference Optimization is simpler than PPO-based RL from human feedback:
- No separate reward model training loop
- Works directly on preference pairs (chosen vs. rejected resume)
- The HuggingFace `trl` library has a production-ready `DPOTrainer`
- Preference data naturally accumulates from user edits and interview outcomes
