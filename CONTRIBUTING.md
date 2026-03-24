# Contributing to Job Agent

Thank you for your interest in contributing! This document explains how to get involved.

---

## Before you start

- **Check existing issues** — someone may already be working on it
- **For large features** — open an issue first to discuss the approach before writing code
- **For bug fixes** — you can open a PR directly
- **Read the [README](README.md)** to understand the project architecture

---

## Development setup

Follow the [Quick Start](README.md#quick-start) guide. Then:

```bash
# Install backend dev dependencies
cd backend
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx

# Install frontend dev dependencies
cd frontend
npm install
```

---

## Project structure

```
jobagent_code/
├── backend/          # FastAPI + LangGraph agents
│   ├── app/
│   │   ├── agents/   # LangGraph nodes
│   │   ├── api/v1/   # REST endpoints
│   │   ├── core/     # Config, DB, security, LLM abstraction
│   │   ├── models/   # SQLAlchemy models
│   │   ├── rl/       # RL/DPO training module
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── scraping/ # JobSpy + Playwright scrapers
│   │   └── tasks/    # Celery tasks
│   └── alembic/      # Database migrations
├── frontend/         # Next.js 14 dashboard
│   ├── app/          # Next.js App Router pages
│   ├── components/   # React components
│   └── lib/          # API client, Zustand stores
├── mcp_server/       # FastMCP tools server
└── docker/           # Docker Compose + init scripts
```

---

## Making changes

### Backend

1. **Never use raw SQL** — always use SQLAlchemy ORM
2. **Never block the event loop** — all DB/network operations must be `async`/`await`
3. **Always add input validation** via Pydantic schemas
4. **Add database migrations** for any model changes:
   ```bash
   # Create a new migration
   alembic revision --autogenerate -m "describe your change"
   # Apply it
   alembic upgrade head
   ```
5. **Use the LLM abstraction** (`app.core.llm`) — never import `anthropic` or `google.generativeai` directly in business logic

### Frontend

1. Use `@tanstack/react-query` for all server state
2. Use Zustand (`lib/store.ts`) for global client state
3. Follow the existing Tailwind + dark theme conventions
4. All pages in `app/dashboard/` are client components (`"use client"`)

### Adding a new LLM provider

1. Add the API key to `core/config.py`
2. Implement `_call_<provider>()` in `core/llm.py`
3. Add the provider name to `SUPPORTED_PROVIDERS`
4. Add the option to the Settings page LLM selector

---

## Testing

```bash
# Backend
cd backend
pytest tests/ -v

# Frontend type check
cd frontend
npx tsc --noEmit

# Frontend lint
npm run lint
```

We don't have full coverage yet — writing tests is a great first contribution!

---

## Submitting a PR

1. Fork the repo and create a branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes following the conventions above
3. Run tests and type checks locally
4. Push and open a PR using the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
5. Fill out the PR template completely — incomplete PRs will not be reviewed

---

## Code style

- **Python**: PEP 8, type hints everywhere, docstrings on public functions
- **TypeScript**: Strict mode, no `any` except where unavoidable
- **Commits**: Descriptive messages (`feat: add Gemini support`, `fix: websocket reconnect`)

---

## Getting help

- Open a [GitHub Discussion](https://github.com/parnish007/jobagent/discussions) for questions
- Tag issues with `help wanted` if you'd like community input

Thank you for contributing! 🙏
