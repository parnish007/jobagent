# How to Use Job Agent

> A practical step-by-step guide — from zero to submitting your first application.

---

## Step 0 — Install and start everything

### Requirements

| Tool | Version | Where to get it |
|------|---------|----------------|
| Python | 3.12+ | python.org |
| Node.js | 20+ | nodejs.org |
| Docker Desktop | 4.x+ | docker.com |
| Anthropic or Gemini API key | — | console.anthropic.com or aistudio.google.com |

---

### One-time setup

**1. Clone the repo**

```bash
git clone https://github.com/parnish007/jobagent.git
cd jobagent/jobagent_code
# All remaining commands use jobagent_code/ as the root unless stated otherwise
```

**2. Configure environment**

```bash
# pwd: jobagent_code/
cp .env.example .env
```

Open `.env` and fill in at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-...    # from console.anthropic.com
# OR
GEMINI_API_KEY=AIza...          # from aistudio.google.com

SECRET_KEY=any-random-32-char-string-here
# Generate one: python -c "import secrets; print(secrets.token_hex(32))"
```

**3. Install Python dependencies** (one virtualenv covers everything)

```bash
# pwd: jobagent_code/
python -m venv .venv

# Activate:
source .venv/bin/activate      # macOS / Linux
.venv\Scripts\activate         # Windows

pip install -r requirements.txt
playwright install chromium --with-deps
```

**4. Set up the frontend env file**

```bash
# pwd: jobagent_code/
cp frontend/.env.example frontend/.env.local
# Default values work for local development — no changes needed
```

---

### Starting the services

You need **3 terminals** open at the same time. Do these in order:

---

**Terminal 1 — Database + API**

```bash
# pwd: jobagent_code/
# Start PostgreSQL and Redis
docker compose --env-file .env -f docker/docker-compose.yml up -d

# Move into backend and run migrations
cd backend
alembic upgrade head

# Start the API server (leave this running)
uvicorn app.main:app --reload --port 8000
```

> API is ready at `http://localhost:8000` · Swagger docs at `http://localhost:8000/docs`

---

**Terminal 2 — Celery worker** (handles background agent tasks)

```bash
# pwd: jobagent_code/  ← start here, then cd backend
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows

cd backend
celery -A app.core.celery_app worker --pool=solo --loglevel=info
# Leave this running
```

> Windows must use `--pool=solo`. macOS/Linux can use `--pool=prefork -c 4` instead.

---

**Terminal 3 — Frontend**

```bash
# pwd: jobagent_code/frontend/
cd frontend
npm install
npm run dev
# Leave this running
```

Open **http://localhost:3000** ✓

---

## Step 1 — Create your account

1. Go to [http://localhost:3000](http://localhost:3000)
2. Click **Sign up**
3. Enter email + password (min 8 characters, must include a number)

---

## Step 2 — Set up your profile

Go to **Settings** in the sidebar. The AI uses your profile to score every job — the more detail you provide, the better the matches.

### Target Roles *(most important)*

Type the exact roles you want and press **Enter** after each one. Each role becomes a chip:

```
Senior Backend Engineer   ×
ML Engineer               ×
Platform Engineer         ×
```

### AI Model

Choose **Claude** (recommended — better reasoning) or **Gemini** (faster, lower cost). Make sure the matching API key is set in your `.env`.

### Default Job Search

- **Search query** — used when you click **Run Agent** (e.g. `Python Developer`)
- **Location** — `Remote`, `London`, `New York`, etc.
- **Job type** — Full-time / Internship / Contract / etc.
- **Sources** — pick which job boards to scrape (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs)
- **Results** — how many jobs to fetch per run (20–30 is a good starting point)

### Job Preferences

- **Skills** — list everything you know: `Python, React, PostgreSQL, Docker, AWS` — be comprehensive, the AI matches these against job descriptions
- **Salary range** — optional but useful for filtering
- **Remote only** — check this if you only want remote roles

Hit **Save Changes** when done.

---

### Set up your base resume

Go to **Resume** in the sidebar.

**Option A — Upload a file**

Drag and drop (or click to browse) your existing resume. Supported formats: `.pdf`, `.docx`, `.md`, `.txt`. The AI extracts the text automatically.

**Option B — Type it in Markdown**

```markdown
# Your Name
email@example.com | linkedin.com/in/you | github.com/you

## Summary
2 sentences about who you are and what you're looking for.

## Experience
### Job Title — Company (2022–present)
- Achievement with a measurable result
- Another achievement

## Skills
Python, React, PostgreSQL, Docker, AWS

## Education
B.Sc. Computer Science — University, 2020
```

Click **Save**.

---

## Step 3 — Find jobs

On the **Dashboard**, use the search bar:

| What you want | How |
|--------------|-----|
| Any job | Type a title → click Search |
| Internships | Click 🎓 **Internship** preset |
| Entry-level | Click 🌱 **Entry Level** preset |
| Senior roles | Click ⚡ **Senior** preset |
| Remote only | Click 🌍 **Remote Only** preset |
| Contract | Click 📋 **Contract** preset |
| Custom | Click **Advanced** to pick sources and result count |

Or click **Run Agent** in the sidebar to use your saved default search.

The scrape takes 30–120 seconds. The agent status bar at the top shows live progress.

---

## Step 4 — Review scored jobs

After scraping, go to **Jobs** in the sidebar.

Each card shows:
- Job title, company, location
- **Score** (0–100) — match quality against your profile
  - 🟢 75+ → strong match
  - 🟡 55–74 → moderate match
  - 🔴 <55 → weak match
- 1–2 sentence AI reasoning

**Click any card** to open the detail panel — shows matched skills, missing skills, and the full job description.

**Approve** jobs you want to apply for. **Reject** the rest. The agent generates a tailored resume for every job you approve.

---

## Step 5 — Review tailored resumes

Go to **Resume** in the sidebar. Each approved job has a draft that:

- Highlights your skills that match this role
- Incorporates keywords from the job description
- Adjusts your summary to speak to this company

**What to do:**
1. Read through the draft
2. Edit anything that doesn't sound like you
3. Click **Save** — the edited version becomes your AI training data

> Every edit you make teaches the AI your writing style. After 50+ edits, you can trigger DPO fine-tuning from the **AI Training** tab.

---

## Step 6 — Track your applications

Go to **Applications** for the Kanban view:

```
Draft → Resume Ready → Submitted → Responded → Interview → Offer / Rejected
```

When you hear back from a company, open the card and record the outcome. Interview and offer signals feed back into the AI scoring over time.

---

## Step 7 — Watch analytics grow

Go to **Analytics** to see:
- Applications by status
- Interview rate over time
- Offer rate over time

The more you use it, the more useful the trends become.

---

## Daily workflow (once set up)

1. Click **Run Agent** (uses your saved default search)
2. Review ~20 scored jobs — takes 2–3 minutes
3. Approve the best matches
4. Skim the generated resumes — edit anything off
5. Done — applications submit automatically after your review

---

## Tips for better results

**Better scores:**
- Add more skills to your profile — the AI can only match what it knows about you
- Be specific with Target Roles — `Senior Backend Engineer` scores better than just `Engineer`

**Better resumes:**
- Edit AI drafts when they're not quite right — every edit trains the model
- Go to **Resume → AI Training → Start DPO Training** after 50+ edits

**Efficiency:**
- Set your default search in Settings so **Run Agent** just works
- Set auto-approve threshold to 80+ if you trust the scoring

---

## Need help?

- 📖 Detailed setup: [docs/SETUP.md](docs/SETUP.md)
- 🐛 Bug report: [github.com/parnish007/jobagent/issues](https://github.com/parnish007/jobagent/issues)
- 💬 Questions: [github.com/parnish007/jobagent/discussions](https://github.com/parnish007/jobagent/discussions)
