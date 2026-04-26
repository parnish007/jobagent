<div align="center">

# Security Policy

**Job Agent takes security seriously. Please read this document before reporting a vulnerability.**

[![Maintained](https://img.shields.io/badge/maintained-yes-brightgreen.svg)](https://github.com/parnish007/jobagent)
[![Responsible Disclosure](https://img.shields.io/badge/disclosure-responsible-blue.svg)](mailto:parnishklpo@gmail.com)

</div>

---

## Table of contents

- [Supported versions](#supported-versions)
- [Scope](#scope)
- [Reporting a vulnerability](#reporting-a-vulnerability)
- [Response timeline](#response-timeline)
- [Security architecture](#security-architecture)
- [Deployment recommendations](#deployment-recommendations)

---

## Supported versions

Only the latest release on the `main` branch receives security fixes. There are no long-term support (LTS) branches at this time.

| Version | Supported |
|---------|-----------|
| `main` (latest) | Yes |
| Older tagged releases | No — please upgrade |

---

## Scope

### In scope

The following are valid targets for responsible disclosure:

- The Job Agent backend API (`backend/`)
- Authentication and session management (JWT issuance, refresh, revocation)
- The FastMCP tools server (`mcp_server/`)
- The Next.js frontend (`frontend/`) — XSS, CSRF, credential leakage
- The Docker Compose configuration (`docker/`)
- Dependency vulnerabilities in `requirements.txt` or `package.json`

### Out of scope

The following are **not** valid targets and reports about them will be closed:

- Vulnerabilities in third-party services (Anthropic API, Google Generative AI, LinkedIn, Indeed, etc.) — report those to the respective vendor
- Rate limiting on non-auth endpoints (intentional trade-off for self-hosted deployments)
- Issues that only reproduce on end-of-life operating systems or unsupported runtime versions
- Social engineering attacks against maintainers
- Physical security

> [!NOTE]
> Job Agent is a self-hosted tool. The threat model assumes the operator controls the deployment environment. If you are using a managed/cloud deployment, additional hardening is your responsibility as the operator.

---

## Reporting a vulnerability

> [!IMPORTANT]
> **Do NOT report security vulnerabilities through public GitHub issues.** Public disclosure before a patch is available puts every user at risk.

Send a private report to: **parnishklpo@gmail.com**

### What to include

A good report helps us triage and fix the issue faster. Please include as many of the following as are applicable:

- [ ] **Summary** — one or two sentences describing the vulnerability class (e.g., "SQL injection in the job search endpoint")
- [ ] **Affected component** — file path(s) and function/endpoint name(s)
- [ ] **Steps to reproduce** — a minimal, numbered sequence of steps that reliably triggers the issue
- [ ] **Proof of concept** — a curl command, script, or screenshot demonstrating the impact
- [ ] **Potential impact** — what data or functionality is at risk, and under what conditions
- [ ] **Affected versions** — the Git commit hash or release tag where you observed the issue
- [ ] **Suggested fix** (optional) — if you have a proposed remediation

> [!TIP]
> You do not need a perfect PoC to report. A well-described issue with partial reproduction steps is far more useful than no report at all.

### Expectations

- You will receive an acknowledgement within **48 hours**
- We will keep you informed throughout the investigation
- We will not take legal action against researchers who act in good faith and follow this policy
- Researchers who responsibly disclose valid vulnerabilities will be credited in our release notes (unless you prefer to remain anonymous)

**Please do not:**
- Publicly disclose the vulnerability before a patch is released
- Access or modify data that does not belong to you
- Perform denial-of-service attacks against any deployment
- Exfiltrate data beyond what is necessary to demonstrate the issue

---

## Response timeline

| Milestone | Target time (from receipt) |
|-----------|---------------------------|
| Acknowledgement | 48 hours |
| Initial triage (confirmed or declined) | 5 business days |
| Fix confirmed / workaround available | 14 days for critical, 30 days for moderate |
| Patch released | Within 7 days of fix confirmed |
| Public disclosure | Coordinated with reporter after patch release |

---

## Security architecture

Job Agent is designed with security-first principles throughout the stack.

### Authentication

- Passwords are hashed with **bcrypt** at cost factor 12
- JWT **access tokens** expire after 60 minutes
- JWT **refresh tokens** expire after 7 days
- Password minimum requirements: 8+ characters, at least one letter and one number

### API security

- All endpoints except `/auth/register` and `/auth/login` require a valid JWT
- Rate limiting on login: **10 requests per minute per IP**
- CORS is restricted to configured origins (`CORS_ORIGINS` env variable)
- Security headers on all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security` (production mode only)
- Swagger/ReDoc API docs are **disabled in production** (`ENVIRONMENT=production`)
- Every response carries an `X-Request-ID` header for request tracing and incident correlation

### Data isolation

- All database queries use **parameterized statements** via SQLAlchemy ORM — SQL injection is structurally prevented
- Every query that touches user data filters on `user_id` — cross-user data access is not possible through the ORM layer
- Uploaded resumes are stored with a UUID filename, not the original user-supplied name

### Secrets management

- All secrets are loaded exclusively from **environment variables** — nothing is hardcoded
- The `.env` file is listed in `.gitignore`; only `.env.example` (with placeholder values) is committed
- The LLM abstraction layer (`backend/app/core/llm.py`) is the only place that reads API keys — they are never passed to user-visible responses or logged
- Celery task arguments do not contain raw credentials

### Scraping

- Browser automation (Playwright) runs in a **sandboxed subprocess**, isolated from the main API process
- No credentials for external job boards are stored — scraping is session-based and ephemeral

---

## Deployment recommendations

If you deploy Job Agent to a publicly accessible host, follow all of these steps:

1. **Rotate `SECRET_KEY`** — replace the default with a cryptographically random 32+ character string: `openssl rand -hex 32`
2. **Enable HTTPS** — set `ENVIRONMENT=production`; the app will set `Strict-Transport-Security` automatically
3. **Restrict `CORS_ORIGINS`** — set it to your actual frontend domain, not `*`
4. **Use strong, unique database passwords** and restrict the PostgreSQL port to the Docker internal network only
5. **Never commit `.env` files** — if you accidentally push secrets, rotate them immediately
6. **Rotate API keys regularly** — set a calendar reminder to rotate Anthropic, Google, and other provider keys every 90 days
7. **Keep dependencies updated** — run `pip install -U -r requirements.txt` and `npm update` in `frontend/` regularly; watch for CVE announcements for FastAPI, Next.js, and SQLAlchemy
8. **Run the database as a non-root user** — the default Docker Compose setup does this; verify if you customise the stack
9. **Enable PostgreSQL SSL** in production — set `DATABASE_URL` with `?sslmode=require`
10. **Review Docker socket exposure** — do not mount the Docker socket inside the app container unless explicitly required
