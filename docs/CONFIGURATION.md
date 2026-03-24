# Configuration Reference

All configuration is managed via environment variables, loaded from a `.env` file by `pydantic-settings`.

For local development, copy `docker/.env.example` to `docker/.env` (for Docker services) and `backend/.env` (for the Python backend). Both files can be identical.

---

## Table of Contents

- [Required Variables](#required-variables)
- [Database](#database)
- [Redis & Celery](#redis--celery)
- [Authentication](#authentication)
- [AI / LLM](#ai--llm)
- [Scraping](#scraping)
- [Observability](#observability)
- [Frontend](#frontend)
- [Application Behaviour](#application-behaviour)
- [Full Example](#full-example)

---

## Required Variables

These must be set before the application will work:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude. Get one at [console.anthropic.com](https://console.anthropic.com) |
| `SECRET_KEY` | Random secret for JWT signing. Minimum 32 characters. Generate with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | PostgreSQL async connection string (see below) |
| `REDIS_URL` | Redis connection string (see below) |

---

## Database

```env
# Format: postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/jobagent

# For Docker Compose (backend container talking to postgres service):
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/jobagent
```

### PostgreSQL variables (used by Docker Compose only)

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=jobagent
```

These are only read by the `postgres` Docker service, not by the Python backend. The backend uses `DATABASE_URL` directly.

### pgvector requirement

The database must have the `pgvector` extension enabled. This happens automatically via `docker/init.sql` when using the provided Docker image (`pgvector/pgvector:pg16`).

If using an external PostgreSQL instance:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## Redis & Celery

```env
# Format: redis://HOST:PORT[/DB_NUMBER]
REDIS_URL=redis://localhost:6379

# For Docker Compose (backend container talking to redis service):
REDIS_URL=redis://redis:6379
```

Redis is used as both the Celery task broker and result backend. No additional Celery-specific configuration is needed — it is derived from `REDIS_URL` in `celery_app.py`.

---

## Authentication

```env
# JWT signing secret — must match across all backend instances
SECRET_KEY=your-random-32-char-string-here

# JWT algorithm (RS256 for production with key pairs; HS256 is fine for single-server)
ALGORITHM=HS256

# Token expiry in minutes (default: 30)
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Production note**: Use RS256 with asymmetric keys if you plan to run multiple backend instances or issue tokens from a separate auth service.

---

## AI / LLM

```env
# Claude (required)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Which Claude model to use (default: claude-sonnet-4-6)
DEFAULT_MODEL=claude-sonnet-4-6

# OpenAI fallback (optional)
OPENAI_API_KEY=sk-...
```

### Model selection

`DEFAULT_MODEL` is used for both job scoring and resume generation. Available Anthropic models:

| Model ID | Speed | Cost | Notes |
|----------|-------|------|-------|
| `claude-sonnet-4-6` | Fast | Medium | Recommended — best quality/cost ratio |
| `claude-opus-4-6` | Slow | High | Highest quality, use for resume generation if budget allows |
| `claude-haiku-4-5-20251001` | Fastest | Lowest | Good for scoring at scale; weaker resume quality |

You can set different models per use case by editing `scorer_agent.py` and `resume_agent.py` directly.

---

## Scraping

```env
# Bright Data residential proxy (optional but recommended for scraping at scale)
# Without this, scraping from the same IP will eventually be rate-limited
BRIGHT_DATA_API_KEY=your-api-key
```

JobSpy handles proxy configuration internally when `BRIGHT_DATA_API_KEY` is set.

**Without proxies**: Works fine for personal use (10–50 jobs/day). LinkedIn may temporarily block after heavy usage.

**With proxies**: Required for scraping 100+ jobs/day reliably.

### JobSpy scrape limits

| Board | Rate limit notes |
|-------|-----------------|
| LinkedIn | Most restrictive — rotate IPs for > 20 results |
| Indeed | Moderate — works well up to 50 results |
| Glassdoor | Moderate |
| ZipRecruiter | Most permissive |

---

## Observability

```env
# Langfuse — agent tracing (optional but highly recommended for debugging)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com

# For self-hosted Langfuse:
# LANGFUSE_HOST=http://localhost:3000
```

When Langfuse keys are set, every LLM call and agent node execution is traced with inputs, outputs, latency, and token counts. This is invaluable for debugging scoring prompt quality and resume generation issues.

Sign up free at [langfuse.com](https://langfuse.com) or self-host via their Docker Compose setup.

---

## Frontend

```env
# Backend API base URL (used by Next.js for API calls)
NEXT_PUBLIC_API_URL=http://localhost:8000

# WebSocket base URL for real-time agent status
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

These variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser. Place them in `frontend/.env.local` for local development.

For production, update both to your deployed backend URL:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

---

## Application Behaviour

These are set in `backend/app/core/config.py` with sensible defaults. Override via env var if needed.

```env
# Show SQLAlchemy queries in logs (default: false)
DEBUG=false

# Allow cross-origin requests from these origins
# Default: ["http://localhost:3000", "http://localhost:3001"]
# For production, set to your frontend URL
CORS_ORIGINS=["https://app.yourdomain.com"]

# App name (shown in API docs title)
APP_NAME=Job Agent
```

### Per-user automation settings

These are stored in the `user_profiles` table and configured per-user in the Settings page, not as env vars:

| Setting | Default | Description |
|---------|---------|-------------|
| `auto_approve_score_threshold` | `85` | Jobs scoring above this are auto-approved (future feature) |
| `daily_application_limit` | `10` | Maximum applications to submit per day |

---

## Full Example

```env
# =============================================================
# Job Agent — .env
# =============================================================

# PostgreSQL (Docker Compose)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=a-secure-db-password
POSTGRES_DB=jobagent

# Backend
DATABASE_URL=postgresql+asyncpg://postgres:a-secure-db-password@localhost:5432/jobagent
REDIS_URL=redis://localhost:6379
SECRET_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...
DEFAULT_MODEL=claude-sonnet-4-6

# Scraping (optional)
BRIGHT_DATA_API_KEY=

# Observability (optional)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```
