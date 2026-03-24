# API Reference

Base URL: `http://localhost:8000/api/v1`

All endpoints except `/auth/register` and `/auth/login` require a Bearer token:
```
Authorization: Bearer <access_token>
```

Interactive Swagger docs: `http://localhost:8000/docs`

---

## Table of Contents

- [Authentication](#authentication)
- [Jobs](#jobs)
- [Applications](#applications)
- [Resume](#resume)
- [Agent](#agent)
- [WebSocket](#websocket)
- [Error Responses](#error-responses)

---

## Authentication

### Register

```
POST /auth/register
```

**Body**
```json
{
  "email": "you@example.com",
  "password": "securepass123",
  "full_name": "Your Name"
}
```

**Response** `201`
```json
{
  "id": "uuid",
  "email": "you@example.com",
  "full_name": "Your Name",
  "is_active": true
}
```

---

### Login

```
POST /auth/login
```

**Body**
```json
{
  "email": "you@example.com",
  "password": "securepass123"
}
```

**Response** `200`
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer"
}
```

Store the `access_token` and send it as `Authorization: Bearer <token>` on all subsequent requests.

---

### Get current user

```
GET /auth/me
```

**Response** `200`
```json
{
  "id": "uuid",
  "email": "you@example.com",
  "full_name": "Your Name",
  "is_active": true
}
```

---

## Jobs

### List jobs

```
GET /jobs?status=pending_review&limit=50&offset=0
```

**Query params**

| Param | Default | Values |
|-------|---------|--------|
| `status` | `pending_review` | `pending_review`, `approved`, `rejected`, `applied` |
| `limit` | `50` | max `200` |
| `offset` | `0` | pagination offset |

**Response** `200`
```json
[
  {
    "id": "uuid",
    "score": 87.5,
    "score_reasoning": "Strong match on Python and FastAPI. Missing Kubernetes experience.",
    "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
    "missing_skills": ["Kubernetes", "Terraform"],
    "status": "pending_review",
    "raw_job": {
      "id": "uuid",
      "source": "linkedin",
      "url": "https://linkedin.com/jobs/view/...",
      "title": "Senior Backend Engineer",
      "company": "Acme Corp",
      "location": "Remote",
      "description": "We are looking for...",
      "salary_min": 140000,
      "salary_max": 180000,
      "remote": true,
      "posted_date": "2026-03-22"
    }
  }
]
```

Jobs are returned ordered by score descending.

---

### Approve a job

```
POST /jobs/{job_id}/approve
```

**Body** (optional)
```json
{
  "reason": "Great company, strong Python focus"
}
```

**Response** `200`
```json
{ "message": "Job approved" }
```

Approving a job sets its status to `approved`. The agent will generate a tailored resume for it on the next run (or immediately if triggered manually).

---

### Reject a job

```
POST /jobs/{job_id}/reject
```

**Body** (optional)
```json
{
  "reason": "Requires relocation"
}
```

**Response** `200`
```json
{ "message": "Job rejected" }
```

---

### Trigger a scrape

```
POST /jobs/scrape
```

Enqueues a Celery task that runs the scraper and scorer nodes for the authenticated user.

**Body**
```json
{
  "search_query": "backend engineer",
  "location": "Remote",
  "sites": ["linkedin", "indeed", "glassdoor"],
  "results_wanted": 30
}
```

| Field | Required | Default |
|-------|----------|---------|
| `search_query` | Yes | — |
| `location` | No | `"Remote"` |
| `sites` | No | `["linkedin", "indeed", "glassdoor"]` |
| `results_wanted` | No | `20` |

Valid `sites` values: `linkedin`, `indeed`, `glassdoor`, `zip_recruiter`

**Response** `200`
```json
{
  "task_id": "celery-task-uuid",
  "message": "Scrape started"
}
```

---

## Applications

### List applications

```
GET /applications
```

Returns all applications for the authenticated user, ordered by creation date descending.

**Response** `200`
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "scored_job_id": "uuid",
    "resume_version_id": "uuid",
    "status": "submitted",
    "submission_method": "linkedin_easy_apply",
    "notes": null
  }
]
```

**Status values**: `draft`, `resume_ready`, `submitted`, `responded`, `interview`, `offer`, `rejected`, `closed`

---

### Submit an application

```
POST /applications/{application_id}/submit
```

Enqueues a Celery task that runs the Playwright application submission for this application.

**Response** `200`
```json
{
  "task_id": "celery-task-uuid",
  "message": "Application submission started"
}
```

**Errors**
- `400` — application is not in `draft` or `resume_ready` state
- `404` — application not found

---

### Record an outcome

```
POST /applications/{application_id}/outcome
```

Record the result of an application. This data is used for RL reward model training.

**Body**
```json
{
  "outcome": "interview",
  "response_text": "We'd like to schedule a call",
  "days_to_response": 5
}
```

| Field | Required | Values |
|-------|----------|--------|
| `outcome` | Yes | `interview`, `rejected`, `no_response`, `offer` |
| `response_text` | No | Free text |
| `days_to_response` | No | Integer |

**Response** `200`
```json
{ "message": "Outcome recorded" }
```

---

## Resume

### Get base resume

```
GET /resume
```

Returns the user's base resume (stored as plain text/Markdown in their profile).

**Response** `200`
```json
{
  "content": "# Jane Smith\n\n## Experience\n..."
}
```

---

### Update base resume

```
PUT /resume
```

**Body**
```json
{
  "content": "# Jane Smith\n\n## Experience\n..."
}
```

**Response** `200`
```json
{ "message": "Resume updated" }
```

---

### Get generated resume draft

```
GET /resume/{scored_job_id}/draft
```

Returns the most recent tailored resume version generated for a specific job.

**Response** `200`
```json
{
  "id": "uuid",
  "content": "# Jane Smith\n\nResults-driven backend engineer with 5 years...",
  "rl_score": null,
  "user_edited": false,
  "version_number": 1
}
```

**Error**
- `404` — no draft exists for this job yet (trigger generation first)

---

### Trigger resume generation

```
POST /resume/{scored_job_id}/generate
```

Enqueues a Celery task to generate a tailored resume for the specified job. The job must be in `approved` status.

**Response** `200`
```json
{
  "task_id": "celery-task-uuid",
  "message": "Resume generation started"
}
```

---

### Record a resume preference

```
POST /resume/preference
```

Records a preference pair for RL training. Called automatically when a user edits a resume or explicitly rates one version over another.

**Body**
```json
{
  "chosen_version_id": "uuid",
  "rejected_version_id": "uuid",
  "signal_type": "explicit_rating"
}
```

| `signal_type` | Meaning |
|---------------|---------|
| `explicit_rating` | User clicked thumbs up on one version |
| `edit` | User edited this version (implicit preference) |
| `outcome` | Interview → chosen, Rejection → rejected |

**Response** `200`
```json
{ "message": "Preference recorded" }
```

---

## Agent

### Get agent status

```
GET /agent/status
```

Returns the status of the most recent agent run for the authenticated user.

**Response** `200`
```json
{
  "status": "paused",
  "current_step": "awaiting_job_review",
  "jobs_scraped": 42,
  "jobs_scored": 38,
  "applications_submitted": 0,
  "last_run": "2026-03-23T14:30:00Z"
}
```

| `status` | Meaning |
|----------|---------|
| `idle` | No run started yet |
| `running` | Agent is actively executing |
| `paused` | Agent is waiting at a human gate |
| `completed` | Run finished successfully |
| `failed` | Run encountered an unrecoverable error |

---

### Trigger a full agent run

```
POST /agent/run
```

Starts the full pipeline: scrape → score → [human gate] → resume → [human gate] → submit.

**Response** `200`
```json
{
  "task_id": "celery-task-uuid",
  "message": "Agent run started"
}
```

---

## WebSocket

### Agent status stream

```
WS /agent/ws/{user_id}
```

Subscribe to real-time agent status events. Connect with any WebSocket client.

```javascript
const ws = new WebSocket(`ws://localhost:8000/api/v1/agent/ws/${userId}`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
  // { type: "step_complete", step: "score_jobs", jobs_scored: 12 }
  // { type: "gate", gate: "human_job_review" }
  // { type: "ping", user_id: "..." }
};
```

> The WebSocket currently sends pings every 2 seconds. A future update will connect it to Redis pub/sub for real step-complete events.

---

## Error Responses

All errors follow this shape:

```json
{
  "detail": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — invalid state or parameters |
| `401` | Unauthorized — missing or invalid token |
| `404` | Not found |
| `422` | Validation error — request body failed Pydantic validation |
| `500` | Internal server error |

### Validation error example (`422`)

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "search_query"],
      "msg": "Field required"
    }
  ]
}
```
