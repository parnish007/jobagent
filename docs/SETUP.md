# Local Setup Guide

Step-by-step instructions for running Job Agent locally on macOS, Linux, or Windows.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Environment Setup](#1-environment-setup)
- [2. Infrastructure (Docker)](#2-infrastructure-docker)
- [3. Backend](#3-backend)
- [4. Frontend](#4-frontend)
- [5. Celery Worker](#5-celery-worker)
- [6. MCP Server (optional)](#6-mcp-server-optional)
- [Verification](#verification)
- [Common Issues](#common-issues)
- [Resetting the Database](#resetting-the-database)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Desktop | 4.x+ | Includes Docker Compose v2 |
| Python | 3.12+ | Use `pyenv` or system Python |
| Node.js | 20+ | LTS recommended |
| Git | Any | — |

**API Keys needed:**
- **Anthropic API key** — required. Get one at [console.anthropic.com](https://console.anthropic.com)
- Everything else is optional (see [CONFIGURATION.md](CONFIGURATION.md))

---

## 1. Environment Setup

```bash
# Clone the repo (adjust to your URL)
git clone https://github.com/parnish007/jobagent.git
cd jobagent/jobagent_code

# Copy the env template
cp docker/.env.example docker/.env
```

Open `docker/.env` in your editor and fill in at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-...        # your Anthropic key
SECRET_KEY=some-random-32-char-string-here
```

To generate a secure SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 2. Infrastructure (Docker)

Start PostgreSQL 16 (with pgvector) and Redis:

```bash
cd docker
docker compose up -d
```

Verify both containers are healthy:
```bash
docker compose ps
```

Expected output:
```
NAME                    STATUS
jobagent_postgres       Up (healthy)
jobagent_redis          Up (healthy)
```

> The `init.sql` file automatically enables the `vector` and `uuid-ossp` PostgreSQL extensions on first start. You do not need to do this manually.

### Optional: pgAdmin

If you want a database GUI:
```bash
docker compose --profile tools up -d
```

pgAdmin will be at `http://localhost:5050`
- Email: `admin@jobagent.local`
- Password: `admin`
- Add server: host `postgres`, port `5432`, user/password from your `.env`

---

## 3. Backend

### Create a virtual environment

```bash
cd ../backend
python -m venv .venv
```

Activate it:
- **macOS/Linux**: `source .venv/bin/activate`
- **Windows (PowerShell)**: `.venv\Scripts\Activate.ps1`
- **Windows (cmd)**: `.venv\Scripts\activate.bat`

### Install dependencies

```bash
pip install -r requirements.txt
```

### Install Playwright browsers

```bash
playwright install chromium --with-deps
```

> On Linux, `--with-deps` installs system dependencies. On macOS/Windows it's optional but recommended.

### Configure environment

The backend reads from a `.env` file in the `backend/` directory. You can either:

**Option A** — copy from docker:
```bash
cp ../docker/.env .env
```

**Option B** — create a minimal `.env`:
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/jobagent
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
SECRET_KEY=your-secret-key
```

### Run database migrations

```bash
alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial schema
```

### Start the API server

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now available at:
- **API base**: `http://localhost:8000/api/v1`
- **Interactive docs (Swagger)**: `http://localhost:8000/docs`
- **Alternative docs (ReDoc)**: `http://localhost:8000/redoc`
- **Health check**: `http://localhost:8000/health`

---

## 4. Frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create a frontend env file:
```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

Start the development server:
```bash
npm run dev
```

Dashboard available at `http://localhost:3000`

---

## 5. Celery Worker

Open another terminal and activate the backend virtualenv again:

```bash
cd backend
source .venv/bin/activate   # or Windows equivalent

celery -A app.core.celery_app worker --pool=solo --loglevel=info
```

> **Windows**: `--pool=solo` is required. On macOS/Linux you can use `--pool=prefork -c 4` for concurrent task execution.

You should see:
```
[tasks]
  . agent_tasks.run_full_agent
  . agent_tasks.run_resume_task
  . agent_tasks.run_scrape_task
  . agent_tasks.run_submit_task

[2026-03-23 ...] celery@hostname ready.
```

---

## 6. MCP Server (optional)

The MCP server exposes agent tools to external AI systems via the Model Context Protocol.

```bash
cd mcp_server
pip install -r requirements.txt
python server.py
```

To use with Claude Desktop, add to your MCP config:
```json
{
  "mcpServers": {
    "jobagent": {
      "command": "python",
      "args": ["/path/to/jobagent_code/mcp_server/server.py"]
    }
  }
}
```

---

## Verification

Once all services are running, run through this checklist:

### Backend health
```bash
curl http://localhost:8000/health
# → {"status": "ok", "service": "Job Agent"}
```

### Register a test account
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "testpass123", "full_name": "Your Name"}'
```

### Login and get a token
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "testpass123"}'
# → {"access_token": "...", "token_type": "bearer"}
```

### Trigger a test scrape
```bash
TOKEN="your-token-here"
curl -X POST http://localhost:8000/api/v1/jobs/scrape \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"search_query": "python developer", "location": "Remote", "results_wanted": 5}'
```

### Frontend
Open `http://localhost:3000` — you should see the dashboard (it will redirect to login).

---

## Common Issues

### `asyncpg: could not connect to server`
The PostgreSQL container isn't ready yet. Wait a few seconds and retry, or check:
```bash
docker compose ps       # postgres should show (healthy)
docker compose logs postgres
```

### `alembic: can't find revision`
Make sure you're running alembic from the `backend/` directory, not from `backend/alembic/`:
```bash
cd backend
alembic upgrade head
```

### `playwright: executable doesn't exist`
Re-run the install command:
```bash
playwright install chromium --with-deps
```

### `celery: No module named 'app'`
Celery must be started from the `backend/` directory with the virtualenv activated:
```bash
cd backend && source .venv/bin/activate
celery -A app.core.celery_app worker --pool=solo
```

### Frontend shows blank page / 401 errors
Check that:
1. The backend is running on port 8000
2. `NEXT_PUBLIC_API_URL` in `frontend/.env.local` points to `http://localhost:8000`
3. You're logged in (token stored in `localStorage`)

### pgvector extension error on migration
The Docker image `pgvector/pgvector:pg16` includes the extension, and `init.sql` enables it automatically. If you're using a non-pgvector Postgres image, you'll need to enable it manually:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Resetting the Database

To wipe all data and start fresh:

```bash
# Stop services
docker compose down -v    # -v removes volumes including postgres data

# Restart infra
docker compose up -d

# Re-run migrations
cd ../backend
alembic upgrade head
```
