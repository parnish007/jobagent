# Job Agent — User Guide

> Complete guide to using Job Agent for your job search

---

## Table of contents

1. [First-time setup](#1-first-time-setup)
2. [The dashboard](#2-the-dashboard)
3. [Searching for jobs](#3-searching-for-jobs)
4. [Reviewing jobs (Gate 1)](#4-reviewing-jobs-gate-1)
5. [Resume generation and review (Gate 2)](#5-resume-generation-and-review-gate-2)
6. [Tracking applications](#6-tracking-applications)
7. [Analytics](#7-analytics)
8. [AI model selection](#8-ai-model-selection)
9. [RL/AI training](#9-rlai-training)
10. [Settings reference](#10-settings-reference)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. First-time setup

### Create your account

1. Open `http://localhost:3000`
2. Click **Sign up** and enter your email + password (min 8 characters, must include a number)
3. You're automatically logged in after registering

### Fill in your profile (Settings)

Go to **Settings** before running the agent for the first time. The AI uses your profile to score jobs.

**What to fill in:**

| Field | Why it matters | Example |
|-------|---------------|---------|
| Target job titles | The AI only scores jobs that match these | `Backend Engineer, Python Developer` |
| Your skills | Used for skill matching in scoring | `Python, FastAPI, PostgreSQL, Docker` |
| Preferred locations | Remote-only or specific cities | `Remote, London` |
| Base resume | Your resume template (Markdown) | See below |
| Default search query | What the agent searches when you click "Run" | `Python developer` |
| AI provider | Claude or Gemini | Claude (recommended) |

### Writing your base resume

Your base resume is written in **Markdown**. The AI uses it as a template to generate tailored versions for each job.

```markdown
# Jane Smith
jane.smith@email.com | linkedin.com/in/janesmith | github.com/janesmith

## Summary
Full-stack developer with 5 years of experience building Python APIs and React frontends...

## Experience

### Senior Backend Engineer — Acme Corp (2022–present)
- Built REST APIs serving 10M requests/day using FastAPI + PostgreSQL
- Reduced database query time by 40% through query optimization

### Software Engineer — Startup Inc (2020–2022)
- Developed core features for B2B SaaS product (Python, React, AWS)

## Skills
**Backend**: Python, FastAPI, Django, PostgreSQL, Redis, Celery
**Frontend**: React, TypeScript, Next.js
**DevOps**: Docker, GitHub Actions, AWS (EC2, RDS, S3)

## Education
B.Sc. Computer Science — University of Example, 2020
```

**Tips:**
- Be comprehensive — include all skills you know, even ones you rarely use
- Use bullet points with numbers where possible (AI can emphasise these for matching jobs)
- Don't fabricate — the AI tailors what you provide, it doesn't invent experience

---

## 2. The dashboard

The main dashboard shows:
- **Stats** — pending jobs, total applications, interviews, match rate
- **Find Jobs** — search bar with preset filters
- **Jobs to Review** — scored jobs waiting for your approval

The **top bar** shows real-time agent status (idle / running / paused / failed).

The **sidebar** has:
- Dashboard
- Jobs (review queue)
- Applications (Kanban pipeline)
- Resume (editor + AI training)
- Analytics
- Settings
- **Run Agent** button (triggers the full pipeline with your default settings)

---

## 3. Searching for jobs

### Using the search bar

1. Type a job title (e.g. "React Developer") in the search box
2. Set a location (e.g. "Remote", "New York", "London")
3. Optionally select a **preset chip**:

| Preset | What it does |
|--------|-------------|
| 🎓 Internship | Adds "internship" to search, sets job_type=internship |
| 🌱 Entry Level | Adds "entry level" to search |
| ⚡ Senior | Adds "senior" to search |
| 🌍 Remote Only | Forces location=Remote |
| 📋 Contract | Sets job_type=contract |
| 🕐 Part-time | Sets job_type=part-time |

4. Click **Search** — a scrape job is queued in the background
5. New jobs appear in your queue within 30–120 seconds depending on sources

### Using Run Agent

Click **Run Agent** in the sidebar to trigger the full pipeline using your default search config (set in Settings). This:
1. Scrapes jobs with your default query + sites
2. Scores all new jobs with AI
3. Pauses for your review

### Advanced options

Click **Advanced** in the search bar to:
- Choose which job boards to search (LinkedIn, Indeed, Glassdoor, ZipRecruiter)
- Set the number of results to fetch (5–50)

---

## 4. Reviewing jobs (Gate 1)

After the agent scrapes and scores jobs, it **pauses** and waits for you.

Go to **Jobs** in the sidebar. You'll see cards showing:
- Job title, company, location
- AI score (0–100) with color coding:
  - 🟢 Green (75+): Strong match
  - 🟡 Amber (55–74): Moderate match
  - 🔴 Red (<55): Weak match
- Score reasoning (1–2 sentences from the AI)
- Salary and remote indicator

**Click a job card** to open the detail panel showing:
- Full AI assessment
- Matched skills (✓ green) and missing skills (✗ red)
- Full job description
- Approve / Reject buttons

**Actions:**
- **Approve** — job moves to resume generation queue
- **Reject** — job is dismissed; the agent skips it

> **Tip:** You don't need to review all jobs before resuming. The agent generates resumes for all approved jobs when you confirm.

---

## 5. Resume generation and review (Gate 2)

After you've approved jobs, the agent generates tailored resumes and **pauses again**.

Go to **Resume** in the sidebar to see generated drafts per job.

Each draft is tailored to:
- Emphasise your skills that match this specific role
- Use keywords from the job description
- Reframe your experience to highlight relevant aspects

**You can:**
- Read the draft in the preview panel
- Edit directly in the text editor (edits are saved as preference signals for RL training)
- Click **Save** to confirm the resume for submission

> **Never submits without confirmation** — you must explicitly confirm each resume before it's used.

---

## 6. Tracking applications

The **Applications** page shows a Kanban board with columns:

| Column | Meaning |
|--------|---------|
| Draft | Application created but resume not yet ready |
| Resume Ready | Resume generated, pending your confirmation |
| Submitted | Application submitted via automation |
| Responded | Company has responded |
| Interview | Interview scheduled |
| Offer | Offer received |
| Rejected | Application rejected |

When you receive a response to an application:
1. Open the application in the Kanban board
2. Record the outcome (interview / rejection / offer)
3. This outcome signal is used to improve future AI decisions

---

## 7. Analytics

The **Analytics** page shows:
- Applications by status (bar chart)
- Total applications, interviews, offers
- Interview rate percentage

As you use the system more, the analytics become more meaningful for understanding your job search performance.

---

## 8. AI model selection

Go to **Settings → AI Model** to choose your LLM provider.

| Provider | Model | Best for |
|----------|-------|---------|
| **Claude (Anthropic)** | claude-sonnet-4-6 | Nuanced reasoning, detailed assessments, better writing quality |
| **Gemini (Google)** | gemini-2.0-flash | Speed, cost-efficiency, high volume searches |

You can switch providers at any time — the change takes effect on the next agent run.

**API key requirements:**
- Claude: Set `ANTHROPIC_API_KEY` in `docker/.env`
- Gemini: Set `GEMINI_API_KEY` in `docker/.env`

---

## 9. RL/AI training

Job Agent learns your resume preferences over time using **DPO (Direct Preference Optimization)**.

### How signals are collected

| Signal type | When it's recorded |
|-------------|-------------------|
| **Edit** | You edit an AI-generated resume (automatic) |
| **Explicit rating** | You thumbs up/down a resume |
| **Outcome** | Application gets an interview |

### Checking training readiness

Go to **Resume → AI Training** tab to see:
- How many preference pairs are collected
- Progress bar toward the 50-pair minimum
- Whether a fine-tuned model is active

### Starting training

Once you have 50+ pairs, click **Start DPO Training**. Training runs in the background (1–4 hours depending on hardware). After training:
- The fine-tuned model is used for all future resume generation
- Resumes will be more aligned with your writing style and preferences

**GPU recommended but not required.** CPU training works but takes much longer.

---

## 10. Settings reference

| Setting | Default | Description |
|---------|---------|-------------|
| Target job titles | — | Comma-separated job titles you're targeting |
| Your skills | — | All your skills — be comprehensive |
| Preferred locations | — | Where you'd like to work |
| Min/max salary | — | Salary range filter |
| Remote only | Off | Only score remote jobs highly |
| Auto-approve threshold | 85 | Jobs above this score skip the review queue |
| Daily application limit | 10 | Maximum applications per day |
| AI provider | Claude | Claude or Gemini |
| Default search query | — | Used by Run Agent button |
| Default location | Remote | Used by Run Agent button |
| Default job type | Any | Full-time, Internship, Contract, etc. |
| Sources | LinkedIn, Indeed | Which job boards to search |
| Results per search | 20 | How many jobs to fetch |

---

## 11. Troubleshooting

### "No jobs appearing after scrape"

- Check the Celery worker is running: `celery -A app.core.celery_app worker --pool=solo`
- Check the backend logs for scraping errors
- Some job boards have rate limits — try reducing `Results per search` or adding a delay

### "Agent status shows Failed"

- Check backend terminal for the full error message
- Common cause: missing `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`
- Verify your API key is valid and has available credits

### "Resume generation fails"

- Ensure you've added your base resume in Settings
- Check that your LLM API key is set and valid

### "WebSocket not connecting" (no live status updates)

- Ensure the backend is running on port 8000
- Check `NEXT_PUBLIC_WS_URL` is set correctly (default: `ws://localhost:8000`)
- The dashboard falls back to polling every 5 seconds if WebSocket fails

### "Frontend shows login loop"

- Clear `localStorage` in your browser dev tools
- Check the backend is running: `curl http://localhost:8000/health`

### "Database migration error"

```bash
# Reset and re-apply migrations
alembic downgrade base
alembic upgrade head
```

### Getting more help

- Check [GitHub Issues](https://github.com/parnish007/jobagent/issues)
- Open a [GitHub Discussion](https://github.com/parnish007/jobagent/discussions)
