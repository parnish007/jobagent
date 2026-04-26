<div align="center">

# Contributing to Job Agent

**Help build the open-source AI job-application agent everyone deserves.**

[![Good First Issues](https://img.shields.io/github/issues/parnish007/jobagent/good%20first%20issue?label=good%20first%20issues&color=7c3aed)](https://github.com/parnish007/jobagent/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
[![GitHub Discussions](https://img.shields.io/github/discussions/parnish007/jobagent?color=0ea5e9)](https://github.com/parnish007/jobagent/discussions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/parnish007/jobagent/pulls)

</div>

---

Thank you for spending time on this project. Every contribution — no matter how small — makes a real difference. This guide will walk you through everything from your first bug report to landing a complex feature PR.

---

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [What NOT to contribute](#what-not-to-contribute)
- [Before you start](#before-you-start)
- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [First contribution](#first-contribution)
- [Making changes](#making-changes)
- [Commit messages](#commit-messages)
- [Running tests](#running-tests)
- [Submitting a PR](#submitting-a-pr)
- [Code review expectations](#code-review-expectations)
- [Code style](#code-style)
- [Getting help](#getting-help)

---

## Ways to contribute

You do not need to write code to make a meaningful contribution:

| Type | How |
|------|-----|
| Bug report | Open an issue with the `bug` label and fill in the template |
| Feature idea | Start a [GitHub Discussion](https://github.com/parnish007/jobagent/discussions) before opening an issue |
| Documentation | Fix typos, clarify setup steps, add missing examples |
| Testing | Write unit or integration tests — coverage is thin and every test counts |
| Code review | Comment on open PRs even if you are not a maintainer |
| Triage | Reproduce bugs, add missing info to stale issues, close duplicates |
| Translation | UI strings live in `frontend/lib/i18n/` (not yet wired — a great first project) |

---

## What NOT to contribute

To avoid wasted effort, please do **not** open PRs for:

- **Swapping the default LLM provider** — the abstraction layer exists precisely so users can choose; we will not hardcode a new default
- **Replacing the database engine** — PostgreSQL is a firm architectural decision
- **Re-implementing auth from scratch** — the current JWT + bcrypt stack is intentional
- **Large-scale reformatting / style-only PRs** — run the linter locally instead
- **Adding heavyweight ML training loops** — the RL module is intentionally lightweight; massive training pipelines belong in a separate project
- **Features that only work for a single job board** — scrapers must be general or board-agnostic by design

When in doubt, open a Discussion first.

---

## Before you start

- **Check existing issues** — someone may already be working on it
- **For large features** — open an issue first to align on the approach before writing any code; a PR without prior discussion may be closed
- **For bug fixes and small improvements** — you can open a PR directly
- **Read the [README](README.md)** to understand the architecture and data flow

---

## Development setup

Follow the full [Setup Guide](docs/SETUP.md) to get the stack running locally (PostgreSQL, Redis, backend, frontend). Then install the extra test dependencies:

```bash
# From the repo root — virtualenv already activated
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx

# Frontend
cd frontend && npm install
```

> [!TIP]
> `docker compose up -d postgres redis` is the fastest way to get the database and queue running without a manual install. See `docker/docker-compose.yml`.

---

## Project structure

```
jobagent_code/
│
├── .env.example              ← ALL environment variables documented here — start here
├── requirements.txt          ← single requirements file (backend + MCP server)
│
├── backend/
│   └── app/
│       ├── agents/           ← LangGraph nodes: scorer, resume_tailor, application, state
│       ├── api/v1/           ← REST endpoints (auth, jobs, resume, agent runs)
│       ├── core/             ← config, database session, security utils, LLM abstraction
│       ├── models/           ← SQLAlchemy ORM models (User, Job, Application, …)
│       ├── rl/               ← reward model, preference collector, DPO trainer
│       ├── schemas/          ← Pydantic request/response schemas (validation layer)
│       ├── scraping/         ← JobSpy wrapper + Playwright-based scraper
│       └── tasks/            ← Celery background tasks (apply, score, notify)
│   └── alembic/              ← Alembic migration scripts — one per model change
│
├── frontend/
│   ├── app/                  ← Next.js 14 App Router pages (layouts, pages, loading)
│   ├── components/           ← Reusable React components
│   └── lib/                  ← API client, Zustand stores, helper utilities
│
├── mcp_server/               ← FastMCP tools server (exposes agent actions as MCP tools)
└── docker/                   ← Docker Compose + Postgres init.sql
```

---

## First contribution

Not sure where to start? These areas are low-risk and well-scoped:

1. **[`good first issue` label](https://github.com/parnish007/jobagent/issues?q=is%3Aopen+label%3A%22good+first+issue%22)** — curated tasks that do not require deep system knowledge
2. **Tests** — `backend/tests/` has thin coverage; adding a test for any existing endpoint is always welcome
3. **Documentation** — `docs/` and inline docstrings on public functions in `backend/app/`
4. **`.env.example` comments** — if a variable's purpose is unclear, clarify its description
5. **Frontend type safety** — grep for `any` in `frontend/` and replace with proper types

> [!TIP]
> Clone the repo, run the stack with Docker Compose, poke around the UI for 15 minutes, and note anything confusing. That friction is worth a bug report or a docs PR.

---

## Making changes

### Backend rules

1. **Never use raw SQL** — always use SQLAlchemy ORM. Raw SQL bypasses the type system and makes query auditing harder.
2. **Never block the event loop** — all I/O (DB queries, HTTP calls, file reads) must use `async`/`await`. A synchronous call in an async path can freeze the entire server under load.
3. **Always validate inputs via Pydantic schemas** — do not trust raw `request.body()` anywhere.
4. **Create an Alembic migration for every model change:**
   ```bash
   # pwd: jobagent_code/backend/
   alembic revision --autogenerate -m "add resume_version column to applications"
   alembic upgrade head
   ```
   Migrations must be committed in the same PR as the model change — never separately.
5. **Use the LLM abstraction** (`app.core.llm`) — never import `anthropic` or `google.generativeai` directly in business logic. This keeps provider-switching a one-line config change.

### Frontend rules

1. **Use `@tanstack/react-query`** for all server state — fetching, mutations, pagination, and caching. Do not reach for `useState` + `useEffect` for server data.
2. **Use Zustand** (`lib/store.ts`) for global client-side state that is not tied to a server resource.
3. **Follow the existing Tailwind + dark theme conventions** — check `tailwind.config.ts` for the custom color palette before adding new colors.
4. **All pages under `app/dashboard/`** are client components and must have `"use client"` at the top. Server components live at the layout level.

### Adding a new LLM provider

1. Add the API key variable to `backend/app/core/config.py`
2. Implement `_call_<provider>()` in `backend/app/core/llm.py`
3. Add the provider name to `SUPPORTED_PROVIDERS` in `llm.py`
4. Add the provider option to the Settings page LLM selector (`frontend/app/dashboard/settings/page.tsx`)
5. Document the new key and its source URL in `.env.example`

> [!IMPORTANT]
> **Breaking changes require a migration plan.** If your change removes or renames a public API endpoint, a database column, or a configuration key, you must: (1) open an issue tagged `breaking-change` before starting work, (2) describe a migration path for existing deployments in the PR description, and (3) bump the API version if applicable. PRs with silent breaking changes will be closed.

---

## Commit messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) spec. Reviewers use commit history to generate changelogs, so clear messages matter.

**Format:** `<type>(<optional scope>): <short description>`

| Type | When to use |
|------|-------------|
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that is neither a fix nor a feature |
| `test` | Adding or fixing tests |
| `chore` | Tooling, dependencies, CI |
| `perf` | Performance improvement |

**DO:**
```
feat(scraping): add LinkedIn Easy Apply support via Playwright
fix(auth): prevent token refresh race condition on concurrent requests
docs(setup): add Redis password configuration step
test(api): add coverage for /jobs pagination edge cases
```

**DON'T:**
```
fix stuff
WIP
update code
misc changes
```

---

## Running tests

```bash
# Backend — run from the backend/ directory
cd backend
pytest tests/ -v

# Frontend — TypeScript type check
cd frontend
npx tsc --noEmit

# Frontend — ESLint
npm run lint

# Playwright end-to-end (optional, requires running stack)
cd frontend
npx playwright test
```

> [!NOTE]
> Coverage is intentionally not enforced as a hard gate yet — the goal is to grow it organically. Writing a test for the feature you just built is the norm, not the exception.

---

## Submitting a PR

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature   # new feature
   git checkout -b fix/the-bug       # bug fix
   git checkout -b docs/clarify-x    # documentation
   ```
2. Make your changes following the conventions above
3. Run tests and type checks locally (see [Running tests](#running-tests))
4. Push and open a PR — the [PR template](.github/PULL_REQUEST_TEMPLATE.md) will load automatically
5. **Fill out the PR template completely** — PRs without a description will not be reviewed

> [!IMPORTANT]
> Keep PRs focused. A PR that fixes a bug AND adds an unrelated feature is harder to review and slower to merge. Split unrelated changes into separate PRs.

---

## Code review expectations

### What reviewers look for

- Does the change match what the linked issue describes?
- Are new code paths covered by tests?
- Does backend code use `async`/`await` correctly?
- Are there any new dependencies? If so, are they justified?
- Does the PR description explain the *why*, not just the *what*?

### Response time SLA

| Stage | Target |
|-------|--------|
| First review comment | Within 5 business days |
| Follow-up review after requested changes | Within 3 business days |
| Merge after approval | Within 2 business days |

These are goals, not guarantees — this is a volunteer-maintained project. If your PR has been waiting longer than two weeks with no activity, leave a polite comment to ping the maintainers.

### As a PR author

- Respond to review comments within a reasonable time; stale PRs (no activity for 30 days) will be closed and can be re-opened
- Mark resolved threads as resolved
- Do not force-push to a branch after a review has started — it invalidates existing comments

---

## Code style

| Language | Rules |
|----------|-------|
| Python | PEP 8, type hints on **all** function signatures, docstrings on all public functions and classes |
| TypeScript | Strict mode (`"strict": true` in `tsconfig.json`), avoid `any` — use `unknown` + narrowing instead |
| CSS / Tailwind | Utility classes only; no custom CSS files unless absolutely necessary |
| Commits | Conventional Commits format (see above) |

**Python example — preferred style:**

```python
async def score_job(job: Job, user_profile: UserProfile) -> float:
    """Return a relevance score in [0, 1] for the given job and profile.

    Args:
        job: The job listing to evaluate.
        user_profile: The authenticated user's profile data.

    Returns:
        A float between 0 (no match) and 1 (perfect match).
    """
    ...
```

**TypeScript example — preferred style:**

```ts
// Prefer explicit return types on exported functions
export async function fetchJobs(params: JobSearchParams): Promise<Job[]> {
  const { data } = await apiClient.get<Job[]>("/jobs", { params });
  return data;
}
```

---

## Getting help

- [GitHub Discussions](https://github.com/parnish007/jobagent/discussions) — questions, ideas, architecture discussions
- Issues tagged [`help wanted`](https://github.com/parnish007/jobagent/issues?q=is%3Aopen+label%3A%22help+wanted%22) — community input explicitly invited

---

<div align="center">

**Thank you for contributing.** Every issue filed, test written, doc improved, and line of code reviewed makes this project better for every job seeker who uses it. We are glad you are here.

</div>
