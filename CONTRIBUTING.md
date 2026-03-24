# Contributing to Job Agent

Thank you for your interest in contributing!

---

## Before you start

- **Check existing issues** — someone may already be working on it
- **For large features** — open an issue first to align on the approach before writing code
- **For bug fixes** — you can open a PR directly
- **Read the [README](README.md)** to understand the project architecture and data flow

---

## Development setup

Follow the full [Setup Guide](docs/SETUP.md) to get everything running. Then install the extra test dependencies:

```bash
# pwd: jobagent_code/  (virtualenv already activated)
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx

# Frontend
cd frontend && npm install
```

---

## Project structure

```
jobagent_code/
├── .env.example          ← all environment variables documented here
├── requirements.txt      ← single requirements file (backend + MCP server)
├── backend/
│   ├── app/
│   │   ├── agents/       ← LangGraph nodes (scorer, resume, application, state)
│   │   ├── api/v1/       ← REST endpoints (auth, jobs, resume, agent)
│   │   ├── core/         ← config, database, security, LLM abstraction
│   │   ├── models/       ← SQLAlchemy ORM models
│   │   ├── rl/           ← reward model, preference collector, DPO trainer
│   │   ├── schemas/      ← Pydantic request/response schemas
│   │   ├── scraping/     ← JobSpy scraper + Playwright scraper
│   │   └── tasks/        ← Celery background tasks
│   └── alembic/          ← database migrations
├── frontend/
│   ├── app/              ← Next.js App Router pages
│   ├── components/       ← React components
│   └── lib/              ← API client, Zustand stores, utilities
├── mcp_server/           ← FastMCP tools server
└── docker/               ← Docker Compose + init.sql
```

---

## Making changes

### Backend rules

1. **Never use raw SQL** — always use SQLAlchemy ORM
2. **Never block the event loop** — all DB/network calls must use `async`/`await`
3. **Always validate inputs** via Pydantic schemas
4. **Create a migration for every model change:**
   ```bash
   # pwd: jobagent_code/backend/
   alembic revision --autogenerate -m "describe your change"
   alembic upgrade head
   ```
5. **Use the LLM abstraction** (`app.core.llm`) — never import `anthropic` or `google.generativeai` directly in business logic

### Frontend rules

1. Use `@tanstack/react-query` for all server state (fetching, mutations, caching)
2. Use Zustand (`lib/store.ts`) for global client state
3. Follow the existing Tailwind + dark theme conventions
4. All pages under `app/dashboard/` are client components (`"use client"`)

### Adding a new LLM provider

1. Add the API key variable to `backend/app/core/config.py`
2. Implement `_call_<provider>()` in `backend/app/core/llm.py`
3. Add the provider name to `SUPPORTED_PROVIDERS` in `llm.py`
4. Add the option to the Settings page LLM selector (`frontend/app/dashboard/settings/page.tsx`)
5. Document the new key in `.env.example`

---

## Running tests

```bash
# Backend — run from backend/ directory
cd backend
pytest tests/ -v

# Frontend — type check
cd frontend
npx tsc --noEmit

# Frontend — lint
npm run lint
```

Coverage is not yet comprehensive — writing tests is one of the best ways to contribute.

---

## Submitting a PR

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/the-bug
   ```
2. Make your changes following the conventions above
3. Run tests and type checks locally (see above)
4. Push and open a PR using the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
5. Fill out the PR template completely — PRs without a description will not be reviewed

---

## Code style

| Language | Rules |
|----------|-------|
| Python | PEP 8, type hints on all functions, docstrings on public APIs |
| TypeScript | Strict mode, avoid `any` |
| Commits | Conventional format — `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...` |

---

## Getting help

- [GitHub Discussions](https://github.com/parnish007/jobagent/discussions) for questions
- Tag issues with `help wanted` to invite community input

Thank you for contributing!
