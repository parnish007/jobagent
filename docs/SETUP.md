# Local Setup Guide

Step-by-step instructions for running Job Agent locally on macOS, Linux, or Windows.

> **TL;DR for experienced developers**: see the [Quick Start](../README.md#quick-start) in the README.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Environment variables](#1-environment-variables)
- [2. Python environment](#2-python-environment)
- [3. Infrastructure — Docker](#3-infrastructure--docker)
- [4. Backend — migrations and API](#4-backend--migrations-and-api)
- [5. Frontend](#5-frontend)
- [6. Celery worker](#6-celery-worker)
- [7. MCP server (optional)](#7-mcp-server-optional)
- [Verification](#verification)
- [Common issues](#common-issues)
- [Resetting the database](#resetting-the-database)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Desktop | 4.x+ | Must be running before step 3 |
| Python | 3.12+ | Use `pyenv` or system Python |
| Node.js | 20 LTS | For the frontend |
| Git | Any | — |

**API keys needed (at least one):**
- **Anthropic** — [console.anthropic.com](https://console.anthropic.com) (Claude — recommended)
- **Google AI Studio** — [aistudio.google.com](https://aistudio.google.com) (Gemini — optional)

---

## 1. Environment variables

```bash
# pwd: jobagent_code/
git clone https://github.com/parnish007/jobagent.git
cd jobagent/jobagent_code

cp .env.example .env
```

Open `.env` and fill in **at minimum**:

```env
ANTHROPIC_API_KEY=sk-ant-...        # your Anthropic key
SECRET_KEY=some-random-32-char-string-here
```

To generate a secure `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

All available variables and their defaults are documented directly in [`.env.example`](../.env.example).

---

## 2. Python environment

One virtualenv at the repo root covers the backend, agents, and MCP server.

```bash
# pwd: jobagent_code/
python -m venv .venv
```

**Activate it:**

| Platform | Command |
|----------|---------|
| macOS / Linux | `source .venv/bin/activate` |
| Windows (PowerShell) | `.venv\Scripts\Activate.ps1` |
| Windows (cmd) | `.venv\Scripts\activate.bat` |

**Install all dependencies:**

```bash
pip install -r requirements.txt
```

**Install Playwright browser:**

```bash
playwright install chromium --with-deps
```

> On Linux, `--with-deps` installs required system packages. On macOS/Windows it is optional but recommended.

---

## 3. Infrastructure — Docker

Make sure Docker Desktop is running, then from the repo root:

```bash
# pwd: jobagent_code/
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

Check both containers are healthy:

```bash
docker compose -f docker/docker-compose.yml ps
```

Expected output:

```
NAME                    STATUS
jobagent_postgres       Up (healthy)
jobagent_redis          Up (healthy)
```

> The `docker/init.sql` file automatically enables the `vector` and `uuid-ossp` PostgreSQL extensions on first start.

### Optional: pgAdmin (database GUI)

```bash
docker compose --env-file .env -f docker/docker-compose.yml --profile tools up -d
```

pgAdmin will be at `http://localhost:5050`
- Email: `admin@jobagent.local`
- Password: `admin`
- Add server → host: `postgres`, port: `5432`, user/password from your `.env`

---

## 4. Backend — migrations and API

> **This section runs in Terminal 1. Leave it running.**

The virtualenv is at the repo root, but `alembic` and `uvicorn` must be run from the `backend/` directory because `alembic.ini` and the app module are there.

```bash
# pwd: jobagent_code/  →  cd into backend
cd backend

# Run database migrations
alembic upgrade head
```

Expected output:

```
INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial schema
INFO  [alembic.runtime.migration] Running upgrade 001 -> 002, add llm search fields
```

Start the API server:

```bash
# pwd: jobagent_code/backend/
uvicorn app.main:app --reload --port 8000
```

The API is now available at:

| URL | Description |
|-----|-------------|
| `http://localhost:8000/api/v1` | API base |
| `http://localhost:8000/docs` | Swagger UI (dev only) |
| `http://localhost:8000/redoc` | ReDoc (dev only) |
| `http://localhost:8000/health` | Health check |

---

## 5. Frontend

> **Open Terminal 2 (new terminal window).**

```bash
# pwd: jobagent_code/frontend/
cd frontend

# Copy the frontend env file (only needed once)
cp ../.env.example .env.local
# Default values (NEXT_PUBLIC_API_URL=http://localhost:8000) work for local dev

npm install
npm run dev
```

Dashboard available at `http://localhost:3000`.

---

## 6. Celery worker

> **Open Terminal 3 (new terminal window). Leave it running alongside Terminal 1.**

Celery handles all long-running background tasks (scraping, scoring, resume generation, submission). It **must** be running for the agent to work.

```bash
# pwd: jobagent_code/  →  activate venv first, then cd backend
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows

cd backend
celery -A app.core.celery_app worker --pool=solo --loglevel=info
```

> **Windows:** `--pool=solo` is required.
> **macOS/Linux:** you can use `--pool=prefork -c 4` for concurrent task execution.

You should see:

```
[tasks]
  . agent_tasks.run_full_agent
  . agent_tasks.run_resume_task
  . agent_tasks.run_scrape_task
  . agent_tasks.run_submit_task

celery@hostname ready.
```

---

## 7. MCP server (optional)

The MCP server exposes agent tools to external AI systems via the Model Context Protocol.

```bash
# pwd: jobagent_code/mcp_server/
# No extra install needed — mcp and fastmcp are already in requirements.txt
cd mcp_server
python server.py
```

To use with Claude Desktop, add to your MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "jobagent": {
      "command": "python",
      "args": ["/absolute/path/to/jobagent_code/mcp_server/server.py"]
    }
  }
}
```

---

## Verification

Once all services are running, verify everything works end to end:

### 1. Backend health

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok", "service": "Job Agent"}
```

### 2. Register a test account

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "testpass123", "full_name": "Your Name"}'
```

### 3. Login and get a token

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "testpass123"}'
# Expected: {"access_token": "...", "token_type": "bearer"}
```

### 4. Trigger a test scrape

```bash
TOKEN="paste-your-access-token-here"
curl -X POST http://localhost:8000/api/v1/jobs/scrape \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"search_query": "python developer", "location": "Remote", "results_wanted": 5}'
```

### 5. Frontend

Open `http://localhost:3000` — should redirect to the login page.

---

## Common issues

### `asyncpg: could not connect to server`

PostgreSQL isn't ready or not running. Check:

```bash
docker compose -f docker/docker-compose.yml ps
# postgres should show: Up (healthy)

docker compose -f docker/docker-compose.yml logs postgres
```

If the container isn't running, start it again:

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

---

### `alembic: can't find revision` or `ModuleNotFoundError`

Alembic must be run from the `backend/` directory (not from `backend/alembic/` and not from the repo root):

```bash
cd backend
alembic upgrade head
```

---

### `playwright: executable doesn't exist`

Re-run the browser install (with the virtualenv activated):

```bash
playwright install chromium --with-deps
```

---

### `celery: No module named 'app'`

Celery must be started from the `backend/` directory with the virtualenv already activated. Order matters:

```bash
# Correct order:
source .venv/bin/activate    # 1. activate venv (from jobagent_code/)
cd backend                   # 2. then cd into backend
celery -A app.core.celery_app worker --pool=solo
```

---

### Frontend shows blank page or 401 errors

Check:
1. Backend is running on port 8000 (`curl http://localhost:8000/health`)
2. `frontend/.env.local` exists and contains `NEXT_PUBLIC_API_URL=http://localhost:8000`
3. You're logged in (JWT stored in `localStorage` — try logging out and back in)

---

### pgvector extension error on migration

The Docker image `pgvector/pgvector:pg16` includes the extension, and `docker/init.sql` enables it automatically on first container start.

If you're using a non-pgvector Postgres image, enable it manually:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## Resetting the database

To wipe all data and start fresh (runs from the repo root):

```bash
# pwd: jobagent_code/

# 1. Stop everything and delete volumes
docker compose --env-file .env -f docker/docker-compose.yml down -v

# 2. Start fresh containers
docker compose --env-file .env -f docker/docker-compose.yml up -d

# 3. Re-run migrations
cd backend && alembic upgrade head
```
