# Job Agent — Full Technical Description

> Everything about this project: what it is, why it's built this way, how every piece works, and how they connect.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [End-to-End Data Flow](#3-end-to-end-data-flow)
4. [Backend — FastAPI](#4-backend--fastapi)
5. [Database — PostgreSQL + pgvector](#5-database--postgresql--pgvector)
6. [LangGraph Agent System](#6-langgraph-agent-system)
7. [LLM Abstraction Layer](#7-llm-abstraction-layer)
8. [Scraping Layer](#8-scraping-layer)
9. [Task Queue — Celery + Redis](#9-task-queue--celery--redis)
10. [Real-time — WebSocket + Redis Pub/Sub](#10-real-time--websocket--redis-pubsub)
11. [Authentication and Security](#11-authentication-and-security)
12. [RL / DPO Pipeline](#12-rl--dpo-pipeline)
13. [Frontend — Next.js 14](#13-frontend--nextjs-14)
14. [MCP Server](#14-mcp-server)
15. [File Structure Reference](#15-file-structure-reference)
16. [Environment Variables Reference](#16-environment-variables-reference)

---

## 1. Project Overview

Job Agent is a full-stack AI application that automates the repetitive parts of job searching while keeping the user in full control at every critical step.

### The problem it solves

Finding a job manually means:
- Checking 5+ job boards every day
- Deciding whether each role is worth applying to
- Rewriting your resume for each application
- Tracking which applications are at what stage

Job Agent automates all of that. It scrapes jobs from multiple boards, scores each one against your profile using an LLM, waits for you to approve the ones you want, then generates a tailored resume for each approved job — and only submits after a second human review.

### Core design principle: human gates

The agent **never submits anything automatically**. It pauses at two points and waits for the user:

1. **After scoring** — user approves or rejects each scored job
2. **After resume generation** — user reviews and edits each tailored resume before submission

This is enforced at the architecture level using LangGraph's `interrupt_before` mechanism, not by conditional logic that could be bypassed.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (User)                        │
│         Next.js 14 Dashboard — http://localhost:3000    │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP REST + WebSocket
                           │ (JWT Bearer auth on every request)
┌──────────────────────────▼──────────────────────────────┐
│                  FastAPI Backend                        │
│            http://localhost:8000/api/v1                 │
│                                                         │
│  /auth    /jobs    /resume    /agent    /applications   │
└──────────┬────────────────────────────┬─────────────────┘
           │ enqueue task               │ async SQLAlchemy
           │                            │
┌──────────▼─────────┐      ┌───────────▼─────────────────┐
│   Celery Worker    │      │   PostgreSQL 16 + pgvector  │
│   (background      │      │   (jobs, users, resumes,    │
│    agent tasks)    │      │    embeddings, preferences) │
└──────────┬─────────┘      └─────────────────────────────┘
           │ runs
┌──────────▼─────────────────────────────────────────────┐
│              LangGraph Agent Graph                     │
│                                                        │
│   scrape_jobs                                          │
│       → score_jobs (LLM)                               │
│       → [INTERRUPT: human_job_review]                  │
│       → generate_resumes (LLM)                         │
│       → [INTERRUPT: human_resume_review]               │
│       → submit_applications (Playwright)               │
└──────────┬─────────────────────┬──────────────────────┘
           │                     │
┌──────────▼──────────┐  ┌───────▼──────────────────────┐
│   Scraping Layer    │  │      LLM Providers           │
│   • JobSpy          │  │   • Claude (Anthropic SDK)   │
│   • Playwright      │  │   • Gemini (Google AI SDK)   │
└─────────────────────┘  └──────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│   Redis                                                 │
│   • Celery broker + result backend                      │
│   • Pub/sub channel per user for real-time events       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. End-to-End Data Flow

Here is the complete lifecycle of a job search session, from button click to submitted application.

### Phase 1 — Trigger

User clicks **Run Agent** on the dashboard (or submits a custom search). The frontend POSTs to `POST /api/v1/agent/run`. The FastAPI endpoint:

1. Reads the user's profile from the database (skills, target roles, LLM provider, default search config)
2. Enqueues a `run_full_agent` Celery task with the user ID and search parameters
3. Returns a `task_id` immediately (HTTP 202)

### Phase 2 — Scraping

The Celery worker picks up the task and begins executing the LangGraph agent graph. The first node, `scrape_jobs`, calls `jobspy_scraper.scrape_jobs()`:

- Queries up to 5 job boards concurrently (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs)
- Filters to jobs posted in the last 72 hours
- Deduplicates using a SHA-256 fingerprint of `(title + company + url)`
- Saves each unique job as a `RawJob` record in PostgreSQL
- Publishes a `scrape_complete` event to the Redis channel `agent:events:{user_id}`

### Phase 3 — Scoring

The `score_jobs` node iterates over each raw job and calls the LLM:

- Builds a prompt including the job description, user's skills, target roles, and years of experience
- Requests a JSON response with: `score` (0–100), `reasoning`, `matched_skills`, `missing_skills`, `highlights`
- Saves a `ScoredJob` record linked to the `RawJob`
- Publishes a `scoring_progress` event after each batch

### Phase 4 — Human Gate 1: Job Review

The LangGraph graph reaches the `human_job_review` interrupt node and **pauses**. The agent state is persisted to `MemorySaver`. The Celery task publishes a `waiting_for_approval` event.

The user opens the **Jobs** tab, reviews each scored card, and clicks Approve or Reject. Each action calls `POST /api/v1/jobs/{job_id}/approve` or `/reject`, which updates `scored_jobs.status` in the database.

When the user clicks **Continue** (or after all jobs are actioned), the frontend calls `POST /api/v1/agent/resume`, which resumes the LangGraph graph from the checkpoint.

### Phase 5 — Resume Generation

The `generate_resumes` node iterates over all approved jobs. For each job:

- Loads the user's `base_resume_text` from their profile
- Builds a prompt with the job description, matched skills, and job requirements
- Calls the LLM to produce a tailored resume in Markdown
- Saves it as a `ResumeVersion` (version 1) linked to the `ScoredJob`
- Computes an RL score using the reward model (cosine similarity of resume ↔ job description embeddings)

### Phase 6 — Human Gate 2: Resume Review

The graph pauses at `human_resume_review`. The user opens the **Resume** tab, reads each draft, makes edits, and clicks Save.

When a user saves an edited resume:
- The new content is saved as the updated `ResumeVersion`
- The system automatically records an **edit preference signal** (original = rejected, edited = chosen) in the `resume_preferences` table

### Phase 7 — Submission

The graph resumes and reaches `submit_applications`. For each approved and resume-confirmed job, Playwright:

1. Opens the job URL in a headless Chromium browser
2. Detects the application form type (LinkedIn Easy Apply, Indeed Quick Apply, or custom form)
3. Fills fields using the user's profile and the tailored resume
4. Submits and records the result as an `Application` record

### Phase 8 — Outcome Tracking

As the user hears back from companies, they update the **Applications** Kanban board (`Draft → Submitted → Interview → Offer/Rejected`). Each outcome update triggers an `outcome` preference signal that feeds back into the RL pipeline.

---

## 4. Backend — FastAPI

### Framework choices

**FastAPI** was chosen for:
- Native `async`/`await` support — critical for non-blocking database and LLM calls
- Pydantic v2 for request/response validation at zero cost
- Auto-generated OpenAPI docs (available at `/docs` in development)
- WebSocket support built in

### API structure

```
/api/v1/
├── auth/
│   ├── POST   /register          create account
│   ├── POST   /login             get access + refresh token
│   ├── POST   /refresh           exchange refresh token for new access token
│   ├── GET    /profile           get current user's profile
│   └── PUT    /profile           update profile (upsert)
├── jobs/
│   ├── POST   /scrape            trigger a scrape (enqueues Celery task)
│   ├── GET    /                  list scored jobs (filterable by status, score)
│   ├── GET    /{job_id}          single job with raw job nested
│   ├── POST   /{job_id}/approve  mark job as approved
│   ├── POST   /{job_id}/reject   mark job as rejected
│   └── GET    /presets           list available search presets
├── resume/
│   ├── POST   /upload            upload PDF/DOCX/MD → extract text
│   ├── GET    /                  get base resume
│   ├── PUT    /                  save base resume
│   ├── GET    /versions          list all tailored versions
│   ├── GET    /{job_id}/draft    get latest draft for a job
│   ├── POST   /{job_id}/generate trigger resume generation
│   ├── PUT    /{version_id}/content update (auto-records edit preference)
│   ├── POST   /preference        record explicit preference pair
│   ├── GET    /rl/status         DPO training readiness
│   └── POST   /rl/train          trigger DPO fine-tuning
├── agent/
│   ├── GET    /status            polling status endpoint
│   ├── POST   /run               run with profile defaults
│   ├── POST   /run/custom        run with custom search params
│   └── WS     /ws/{user_id}      WebSocket for real-time events
└── applications/
    ├── GET    /                  list applications (Kanban data)
    ├── GET    /{id}              single application detail
    └── PUT    /{id}/status       update pipeline stage
```

### Middleware stack

Requests pass through this middleware chain before reaching route handlers:

```
Request →
  RequestIDMiddleware        (adds X-Request-ID header for tracing)
  SecurityHeadersMiddleware  (X-Content-Type-Options, X-Frame-Options, HSTS in prod)
  CORSMiddleware             (localhost:3000 allowed in dev)
  slowapi RateLimiter        (10/min on login, 200/min on general API)
  JWTBearer                  (validates Bearer token, injects current_user)
→ Route handler
```

### Dependency injection

All routes use FastAPI's `Depends()` system:

- `get_db()` — yields an `AsyncSession`, commits on success, rolls back on exception
- `get_current_user()` — decodes JWT, queries user from DB, raises 401 if invalid

---

## 5. Database — PostgreSQL + pgvector

### Why PostgreSQL + pgvector

PostgreSQL handles relational data (users, jobs, resumes, applications). The `pgvector` extension adds a native `vector` column type and approximate nearest-neighbor index, which powers semantic similarity search — used in the reward model to compare resume embeddings to job description embeddings.

### Schema overview

```
users
  └── user_profiles          (1:1 — job preferences, skills, resume, LLM config)
  └── qa_bank                (1:many — interview Q&A pairs)

raw_jobs                     (scraped job listings, deduplicated by SHA-256 fingerprint)
  └── scored_jobs            (1:1 — AI score, reasoning, skills match, status)
      └── resume_versions    (1:many — tailored resume drafts, versioned)
          └── resume_preferences (1:many — DPO training pairs)

applications                 (1:1 with scored_job — submission record)
  └── application_outcomes   (1:many — interview, offer, rejection events)

job_embeddings               (pgvector — job description as 384-dim vector)

agent_runs                   (one record per agent execution — status, logs)
```

### Key design decisions

**SHA-256 deduplication on `raw_jobs`**: The `url` field is hashed to a `fingerprint` column with a unique constraint. Duplicate jobs from multiple sources are silently skipped on insert, which means a user running the agent twice won't see the same job twice.

**Separate `raw_jobs` and `scored_jobs` tables**: Raw jobs are immutable once scraped. Scores are separate so the same raw job can theoretically be re-scored with a different model or profile without touching the original data.

**`pgvector` for semantic scoring**: Job descriptions are embedded using `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional vectors). The reward model computes cosine similarity between a resume embedding and the job embedding to produce a numerical RL score without needing an LLM call.

**JSON columns for lists**: `target_titles`, `skills`, `blacklisted_companies`, etc. are stored as `JSON` columns. This avoids a many-to-many join table for data that is always read and written as a single unit.

### Migrations

Alembic manages all schema changes:

```
alembic/versions/
├── 001_initial_schema.py       — all 11 tables, pgvector + uuid-ossp extensions
└── 002_add_llm_search_fields.py — preferred_llm_provider, default_search_* fields
```

All new model changes must go through a migration file. Never modify the schema directly.

---

## 6. LangGraph Agent System

### Why LangGraph

LangGraph is a library for building stateful multi-step AI workflows as a directed graph. The alternative was a hand-rolled state machine in Celery tasks, but LangGraph provides:

- **Checkpointing** (`MemorySaver`) — if the server restarts mid-run, the agent graph can resume from the last checkpoint
- **Human-in-the-loop** via `interrupt_before` — the graph can pause at any node and wait for external input before continuing
- **Typed state** — the `AgentState` TypedDict is passed through every node, so each node only accesses what it needs

### Agent state

`AgentState` is a `TypedDict` that flows through every node:

```python
class AgentState(TypedDict):
    user_id: str
    llm_provider: str           # "claude" | "gemini"
    search_config: dict         # query, location, sites, results_wanted, job_type
    scraped_job_ids: list[str]  # raw_job IDs from scraping
    scored_job_ids: list[str]   # scored_job IDs after scoring
    approved_job_ids: list[str] # user-approved job IDs
    resume_version_ids: list[str]
    submitted_app_ids: list[str]
    error: Optional[str]
```

### Graph definition

```python
graph = StateGraph(AgentState)

graph.add_node("scrape_jobs",           scrape_node)
graph.add_node("score_jobs",            score_node)
graph.add_node("human_job_review",      human_job_review_node)   # interrupt
graph.add_node("generate_resumes",      resume_node)
graph.add_node("human_resume_review",   human_resume_review_node)  # interrupt
graph.add_node("submit_applications",   submit_node)

graph.set_entry_point("scrape_jobs")
graph.add_edge("scrape_jobs",         "score_jobs")
graph.add_edge("score_jobs",          "human_job_review")
graph.add_edge("human_job_review",    "generate_resumes")
graph.add_edge("generate_resumes",    "human_resume_review")
graph.add_edge("human_resume_review", "submit_applications")
graph.add_edge("submit_applications", END)

compiled = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["human_job_review", "human_resume_review"]
)
```

### How interrupts work

When the graph reaches `human_job_review`:

1. Execution stops **before** entering that node
2. The full graph state is serialized and saved to `MemorySaver`
3. The Celery task publishes a `waiting_for_approval` event to Redis
4. The task returns (the worker is free)

When the user finishes reviewing and clicks Continue:

1. The frontend calls `POST /api/v1/agent/resume`
2. The API calls `compiled.invoke(None, config={"thread_id": user_id})`
3. LangGraph loads the checkpoint, resumes from `human_job_review`, and continues

### Scorer node

The scorer calls `get_llm_json()` with a rubric prompt:

```
Given this job description and this candidate profile, score the job 0–100.
Score breakdown:
- 40 points: skills overlap (matched skills / required skills)
- 30 points: seniority fit
- 20 points: industry/domain relevance
- 10 points: location/remote preference

Return JSON: { score, reasoning, matched_skills, missing_skills, highlights }
```

### Resume generation node

The resume node calls `get_llm_response()` with a tailoring prompt:

```
Rewrite this base resume for the following job posting.
- Emphasise skills that appear in both the resume and the job description
- Mirror the language and keywords from the job description
- Adjust the summary to speak directly to this company's needs
- Do not fabricate experience or skills
- Output Markdown only
```

---

## 7. LLM Abstraction Layer

`backend/app/core/llm.py` provides two public functions used throughout the codebase:

```python
async def get_llm_response(
    prompt: str,
    user_id: str,
    system: str = "",
    max_tokens: int = 2000,
) -> str: ...

async def get_llm_json(
    prompt: str,
    user_id: str,
    schema_hint: str = "",
) -> dict: ...
```

`get_llm_json()` wraps `get_llm_response()` and adds:
- JSON parsing with `json.loads()`
- Automatic retry on parse failure (the LLM sometimes returns markdown-fenced JSON)
- Schema hint passed in the system prompt to improve reliability

### Provider routing

The provider is resolved per-call from the user's `preferred_llm_provider` profile field. If that's not set, it falls back to `settings.DEFAULT_LLM_PROVIDER` (from `.env`).

```python
def _resolve_provider(user_id: str) -> str:
    profile = get_profile_sync(user_id)
    return profile.preferred_llm_provider or settings.DEFAULT_LLM_PROVIDER
```

### Claude implementation

Uses the Anthropic Python SDK's `messages.create()`:

```python
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
message = client.messages.create(
    model=settings.DEFAULT_CLAUDE_MODEL,   # "claude-sonnet-4-6"
    max_tokens=max_tokens,
    system=system,
    messages=[{"role": "user", "content": prompt}],
)
return message.content[0].text
```

### Gemini implementation

Uses the Google AI Python SDK:

```python
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel(settings.DEFAULT_GEMINI_MODEL)  # "gemini-2.0-flash"
response = model.generate_content(prompt)
return response.text
```

Both implementations are wrapped in `asyncio.get_event_loop().run_in_executor()` to avoid blocking the async FastAPI event loop (both SDKs are synchronous).

---

## 8. Scraping Layer

### JobSpy scraper

`backend/app/scraping/jobspy_scraper.py` wraps the `jobspy` library, which handles the complex anti-scraping measures on each job board internally.

```python
async def scrape_jobs(
    search_query: str,
    location: str = "Remote",
    sites: list[str] | None = None,   # linkedin, indeed, glassdoor, zip_recruiter, google
    results_wanted: int = 20,
) -> list[dict]:
```

JobSpy is synchronous (it uses `requests` internally), so it runs in a thread pool via `loop.run_in_executor()` to avoid blocking the async event loop.

Returns: `source`, `url`, `title`, `company`, `location`, `description`, `salary_min/max`, `employment_type`, `remote`, `posted_date`

Retried up to 3 times with exponential backoff using `tenacity`.

### Playwright scraper

`backend/app/scraping/playwright_scraper.py` handles:

1. **Custom site scraping** — for job boards not covered by JobSpy, Playwright opens the page and extracts structured data from the DOM
2. **Application form detection** — determines whether a job uses LinkedIn Easy Apply, Indeed Quick Apply, or a custom ATS form
3. **Form filling** — fills form fields with the user's profile data during the submission phase

The scraper uses `playwright-stealth` to randomize browser fingerprints (user agent, viewport, WebGL, canvas) and avoid bot detection.

```python
async def detect_application_type(url: str) -> str:
    # Returns: "linkedin_easy_apply" | "indeed_quick_apply" | "custom_form" | "unknown"
```

---

## 9. Task Queue — Celery + Redis

### Why Celery

The LangGraph agent pipeline takes 30–120 seconds (scraping + LLM calls). A synchronous HTTP request would time out. Celery moves the work to a background worker process:

1. FastAPI receives the request, enqueues the task, returns HTTP 202 immediately
2. The Celery worker picks up the task and runs the full pipeline
3. The user sees progress via WebSocket events

### Task definitions

```python
# agent_tasks.py

@celery_app.task(name="agent_tasks.run_full_agent")
def run_full_agent(user_id: str, search_config: dict) -> dict:
    """Full pipeline: scrape → score → (wait) → resume → (wait) → submit"""

@celery_app.task(name="agent_tasks.run_scrape_task")
def run_scrape_task(user_id: str, search_config: dict) -> dict:
    """Scrape only, no scoring"""

@celery_app.task(name="agent_tasks.run_resume_task")
def run_resume_task(job_id: str, user_id: str) -> dict:
    """Generate resume for a single job"""

@celery_app.task(name="agent_tasks.run_submit_task")
def run_submit_task(application_id: str, user_id: str) -> dict:
    """Submit a single application"""
```

### Async inside Celery

Celery tasks are synchronous. The LangGraph agent and all database operations are async. Bridge:

```python
def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
```

Each Celery task calls `_run_async(async_pipeline(...))`.

### Windows requirement

On Windows, `multiprocessing` uses `spawn` instead of `fork`, which is incompatible with Celery's default prefork pool. `--pool=solo` runs tasks in the same process as the worker, which avoids this issue at the cost of no parallelism.

---

## 10. Real-time — WebSocket + Redis Pub/Sub

### Architecture

```
Celery Worker
    │ redis.publish("agent:events:{user_id}", json_event)
    │
Redis
    │ redis.subscribe("agent:events:{user_id}")
    │
FastAPI WebSocket handler (/agent/ws/{user_id})
    │
Browser WebSocket connection
    │
AgentStatusWidget (React component)
```

### Event format

Every event published to Redis is a JSON object:

```json
{
  "type": "scrape_complete",
  "data": { "jobs_found": 23 },
  "timestamp": "2026-03-24T10:15:30Z"
}
```

Event types: `started`, `scrape_complete`, `scoring_progress`, `scoring_complete`, `waiting_for_approval`, `resume_generating`, `resume_complete`, `waiting_for_resume_review`, `submitting`, `complete`, `error`

### Fallback polling

The `AgentStatusWidget` frontend component tries WebSocket first. If the connection fails (backend not running, network issue), it automatically falls back to polling `GET /agent/status` every 5 seconds. A WiFi icon in the top bar shows which mode is active.

---

## 11. Authentication and Security

### JWT flow

```
POST /auth/login
  → validates email + bcrypt password
  → returns { access_token (60 min), refresh_token (7 days) }

POST /auth/refresh
  → validates refresh_token
  → returns new { access_token }

All other endpoints:
  → Authorization: Bearer <access_token>
  → JWTBearer dependency decodes token, queries user
```

### Token structure

Access token payload:
```json
{ "sub": "user-uuid", "type": "access", "exp": 1234567890 }
```

Refresh token payload:
```json
{ "sub": "user-uuid", "type": "refresh", "exp": 1234567890 }
```

The `type` claim prevents a refresh token from being used as an access token and vice versa.

### Password rules

- Minimum 8 characters
- Must contain at least one letter and one number
- Hashed with bcrypt (cost factor 12) via `passlib`
- Never stored in plaintext anywhere

### Security headers

`SecurityHeadersMiddleware` adds to every response:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000  (production only)
```

### Rate limiting

`slowapi` middleware limits:
- `POST /auth/login` — 10 requests per minute per IP
- All other endpoints — 200 requests per minute per IP

### Production mode

When `ENVIRONMENT=production`:
- Swagger UI (`/docs`) and ReDoc (`/redoc`) are disabled
- HSTS header is added
- `DEBUG=false` suppresses stack traces in error responses

---

## 12. RL / DPO Pipeline

### Overview

The goal is to make the resume generator improve over time based on the user's feedback, without the user having to do any explicit training work.

### Step 1 — Preference collection

Three types of signals are collected automatically:

| Signal type | When | What it records |
|-------------|------|----------------|
| `edit` | User saves an edited resume | Edited version = chosen, original AI draft = rejected |
| `explicit_rating` | User thumbs up/down in the UI | Directly chosen vs rejected |
| `outcome` | Application gets an interview | Resume that led to interview = chosen |

Each signal creates one row in `resume_preferences (chosen_version_id, rejected_version_id, signal_type)`.

### Step 2 — Reward model (cosine similarity)

While waiting for 50+ pairs, the system scores resumes using a lightweight reward model:

```python
# rl/reward_model.py
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def score_resume(resume_text: str, job_description: str) -> float:
    resume_emb = model.encode([resume_text])
    job_emb    = model.encode([job_description])
    return float(cosine_similarity(resume_emb, job_emb)[0][0]) * 100
```

This score is stored as `resume_versions.rl_score` and shown in the UI as a quality indicator.

### Step 3 — DPO fine-tuning (optional, GPU recommended)

Once 50+ preference pairs exist, the user can trigger DPO training:

```python
# rl/dpo_trainer.py

base_model = "google/flan-t5-base"   # ~250 MB, runs on CPU
trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    beta=0.1,              # KL divergence penalty
    train_dataset=dataset, # (prompt, chosen, rejected) triples
    tokenizer=tokenizer,
    args=training_args,
)
trainer.train()
model.save_pretrained(f"models/user_{user_id}/dpo")
```

The fine-tuned model is saved per-user and used for all future resume generation for that user. `beta=0.1` is a low KL penalty — it allows the model to deviate meaningfully from the base model while not overfitting.

### Why flan-t5-base

`flan-t5-base` (~250M parameters) was chosen because:
- It runs on CPU without requiring a GPU
- It was pre-trained on instruction-following tasks, so it responds well to the resume generation prompt format
- It is small enough to fine-tune on a single user's data (50–200 preference pairs) without overfitting

The tradeoff is quality — Claude/Gemini produce much better resumes. The fine-tuned model improves the AI prompt generation, not the final LLM output directly.

---

## 13. Frontend — Next.js 14

### Framework structure

```
frontend/
├── app/                        ← Next.js 14 App Router
│   ├── page.tsx                ← root: redirects to /dashboard or /login
│   ├── (auth)/login/page.tsx   ← login + register form
│   └── dashboard/
│       ├── layout.tsx          ← sidebar + header shell
│       ├── page.tsx            ← main dashboard with job search bar
│       ├── jobs/page.tsx       ← job feed with filtering
│       ├── resume/page.tsx     ← resume editor + AI training tab
│       ├── applications/page.tsx ← Kanban board
│       ├── analytics/page.tsx  ← charts
│       └── settings/page.tsx   ← profile, roles, LLM, search config
├── components/
│   ├── agent/AgentStatusWidget.tsx   ← real-time status + WebSocket
│   ├── jobs/JobSearchBar.tsx         ← search input + preset chips
│   ├── jobs/JobFeed.tsx              ← scrollable job card list
│   ├── jobs/JobCard.tsx              ← individual job card
│   └── jobs/JobDetailPanel.tsx       ← slide-over detail view
└── lib/
    ├── api.ts                  ← Axios client (auth interceptors)
    └── store.ts                ← Zustand stores (auth, agent, job detail)
```

### State management

Two types of state, managed separately:

**Server state** — data that lives in the database (jobs, profile, resume versions): managed by `@tanstack/react-query`. Every query has a `queryKey`, results are cached and invalidated on mutation.

**Client state** — ephemeral UI state (auth token, which job is selected, agent running status): managed by `Zustand` stores.

```typescript
// lib/store.ts

useAuthStore   — { token, setToken, logout }
useAgentStore  — { status, jobsFound, currentStep, setAgentStatus }
useJobDetailStore — { selectedJobId, setSelectedJobId }
```

### Auth flow

```
1. User logs in → POST /auth/login
2. Backend returns { access_token, refresh_token }
3. Frontend stores both in localStorage
4. Axios interceptor reads token on every request:
   config.headers.Authorization = `Bearer ${token}`
5. On 401 response:
   → try POST /auth/refresh with refresh_token
   → if success: store new access_token, retry original request
   → if fail: clear tokens, redirect to /login
```

### Resume upload

The resume page accepts file uploads via a drag-and-drop zone:

```typescript
// Sends multipart/form-data to POST /resume/upload
const form = new FormData();
form.append("file", file);
const res = await api.post("/resume/upload?save=false", form);
setContent(res.data.content);  // populate the editor with extracted text
```

Supported: `.pdf`, `.docx`, `.md`, `.txt`. Max size: 5 MB. The backend extracts text and returns it — the user can review and edit before saving.

### Target roles chip input

The settings page uses a custom chip input for target roles. Typing a role and pressing Enter or `,` adds a chip. Backspace removes the last chip. This maps to `user_profiles.target_titles` in the database.

---

## 14. MCP Server

`mcp_server/server.py` uses FastMCP to expose the agent's capabilities as tools that any MCP-compatible AI client (Claude Desktop, Claude Code, custom agents) can call directly.

### Available tools

| Tool | What it does |
|------|-------------|
| `scrape_jobs(query, location, sites)` | Run a job scrape and return job IDs |
| `score_job(job_id, user_id)` | Score a specific job against a user's profile |
| `generate_resume(job_id, user_id)` | Generate a tailored resume for a job |
| `get_user_profile(user_id)` | Return the user's profile as structured data |
| `update_job_status(job_id, status)` | Approve or reject a job |
| `record_outcome(application_id, outcome)` | Log interview / offer / rejection |
| `list_pending_jobs(user_id)` | Return jobs awaiting user review |

### Use case

With the MCP server running, a user with Claude Desktop can say:

> "Find me Python engineer jobs in London, score them against my profile, and show me the top 5"

Claude will call `scrape_jobs()` → `score_job()` → `list_pending_jobs()` directly without opening the dashboard.

---

## 15. File Structure Reference

```
jobagent_code/
│
├── .env.example                 ← all environment variables documented
├── .env                         ← your local config (gitignored)
├── requirements.txt             ← all Python dependencies (backend + MCP)
├── .gitignore
├── README.md
├── HOW_TO_USE.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
├── LICENSE
│
├── backend/
│   ├── alembic.ini              ← Alembic config (points to app/core/database.py)
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 001_initial_schema.py
│   │       └── 002_add_llm_search_fields.py
│   └── app/
│       ├── main.py              ← FastAPI app, middleware, router registration
│       ├── agents/
│       │   ├── state.py         ← AgentState TypedDict
│       │   ├── scorer_agent.py  ← LangGraph score_jobs node
│       │   ├── resume_agent.py  ← LangGraph generate_resumes node
│       │   └── application_agent.py ← LangGraph submit_applications node
│       ├── api/
│       │   ├── deps.py          ← get_db, get_current_user dependencies
│       │   └── v1/
│       │       ├── router.py    ← registers all sub-routers
│       │       ├── auth.py
│       │       ├── jobs.py
│       │       ├── resume.py
│       │       ├── agent.py     ← WebSocket + run/resume endpoints
│       │       └── applications.py
│       ├── core/
│       │   ├── config.py        ← Settings (pydantic-settings, reads .env)
│       │   ├── database.py      ← async SQLAlchemy engine + session factory
│       │   ├── security.py      ← JWT, bcrypt, password validation
│       │   ├── llm.py           ← Claude + Gemini abstraction
│       │   └── celery_app.py    ← Celery instance configuration
│       ├── models/
│       │   ├── base.py          ← DeclarativeBase + TimestampMixin
│       │   ├── user.py          ← User, UserProfile, QABank
│       │   ├── job.py           ← RawJob, ScoredJob, JobEmbedding
│       │   ├── resume.py        ← ResumeVersion, ResumePreference
│       │   ├── application.py   ← Application, ApplicationOutcome
│       │   └── agent.py         ← AgentRun
│       ├── rl/
│       │   ├── reward_model.py       ← cosine similarity scoring
│       │   ├── preference_collector.py ← collect + query training pairs
│       │   └── dpo_trainer.py        ← HuggingFace TRL DPO training
│       ├── schemas/
│       │   ├── user.py          ← UserCreate, UserLogin, UserProfileUpdate, Token
│       │   ├── job.py           ← RawJobRead, ScoredJobRead, ScrapeRequest, JOB_PRESETS
│       │   └── resume.py        ← ResumeVersionRead, ResumeUpdate, ResumePreferenceCreate
│       ├── scraping/
│       │   ├── jobspy_scraper.py    ← JobSpy wrapper (5 boards)
│       │   └── playwright_scraper.py ← browser automation + form detection
│       └── tasks/
│           └── agent_tasks.py   ← Celery task definitions + Redis event publisher
│
├── frontend/
│   ├── .env.local               ← NEXT_PUBLIC_* vars (gitignored, copy from .env.example)
│   ├── package.json
│   ├── tsconfig.json
│   ├── app/
│   │   ├── page.tsx             ← root redirect (checks localStorage for token)
│   │   ├── (auth)/login/page.tsx
│   │   └── dashboard/
│   │       ├── layout.tsx
│   │       ├── page.tsx         ← JobSearchBar + JobFeed
│   │       ├── jobs/page.tsx
│   │       ├── resume/page.tsx  ← upload zone + editor + RL tab
│   │       ├── applications/page.tsx
│   │       ├── analytics/page.tsx
│   │       └── settings/page.tsx ← target roles chips + all profile fields
│   ├── components/
│   │   ├── agent/AgentStatusWidget.tsx
│   │   └── jobs/
│   │       ├── JobSearchBar.tsx
│   │       ├── JobFeed.tsx
│   │       ├── JobCard.tsx
│   │       └── JobDetailPanel.tsx
│   └── lib/
│       ├── api.ts               ← Axios with JWT interceptors
│       ├── store.ts             ← Zustand stores
│       └── utils.ts             ← cn() helper and shared utilities
│
├── mcp_server/
│   └── server.py                ← FastMCP tool definitions
│
├── docker/
│   ├── docker-compose.yml       ← postgres (pgvector) + redis + pgadmin
│   └── init.sql                 ← enables vector + uuid-ossp extensions
│
└── docs/
    ├── DESCRIPTION.md           ← this file
    ├── SETUP.md                 ← detailed local setup guide
    └── USER_GUIDE.md            ← end-user feature documentation
```

---

## 16. Environment Variables Reference

All variables are in [`.env.example`](../.env.example). Here is what each one does:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | Yes | `postgres` | PostgreSQL username (Docker) |
| `POSTGRES_PASSWORD` | Yes | `postgres` | PostgreSQL password (Docker) |
| `POSTGRES_DB` | Yes | `jobagent` | Database name (Docker) |
| `DATABASE_URL` | Yes | `postgresql+asyncpg://...` | Full async connection string for SQLAlchemy |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection string for Celery + pub/sub |
| `SECRET_KEY` | Yes | — | JWT signing key — must be random and secret |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime |
| `DEFAULT_LLM_PROVIDER` | No | `claude` | Server default — `claude` or `gemini` |
| `ANTHROPIC_API_KEY` | If using Claude | — | From console.anthropic.com |
| `DEFAULT_CLAUDE_MODEL` | No | `claude-sonnet-4-6` | Claude model ID |
| `GEMINI_API_KEY` | If using Gemini | — | From aistudio.google.com |
| `DEFAULT_GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model ID |
| `BRIGHT_DATA_API_KEY` | No | — | Proxy rotation for scraping (optional) |
| `LANGFUSE_PUBLIC_KEY` | No | — | Agent tracing via Langfuse (optional) |
| `LANGFUSE_SECRET_KEY` | No | — | Langfuse secret (optional) |
| `LANGFUSE_HOST` | No | `https://cloud.langfuse.com` | Langfuse endpoint |
| `ENVIRONMENT` | No | `development` | `development` disables HSTS, enables Swagger UI |
| `DEBUG` | No | `false` | Enables verbose error responses |
| `RATE_LIMIT_LOGIN` | No | `10/minute` | slowapi rate limit for `/auth/login` |
| `RATE_LIMIT_API` | No | `200/minute` | slowapi rate limit for all other endpoints |

Frontend only (in `frontend/.env.local`):

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL for API calls |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000` | Backend WebSocket URL |
