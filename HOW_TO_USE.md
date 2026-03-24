# How to Use Job Agent

> A practical, step-by-step guide to get from zero to submitting your first application.

---

## Step 0 — Install and start everything

### Requirements
- Python 3.12+
- Node.js 20+
- Docker Desktop running

### One-time setup

```bash
# 1. Clone the repo
git clone https://github.com/parnish007/jobagent.git
cd jobagent/jobagent_code

# 2. Copy and fill environment variables
cp docker/.env.example docker/.env
```

Open `docker/.env` and set at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-...       # Get from console.anthropic.com
# OR
GEMINI_API_KEY=AIza...             # Get from aistudio.google.com

SECRET_KEY=any-random-32-char-string-here
```

```bash
# 3. Start PostgreSQL + Redis
cd docker && docker compose up -d && cd ..

# 4. Set up backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
playwright install chromium --with-deps
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 5. Start Celery worker (new terminal, same folder)
.venv\Scripts\activate
celery -A app.core.celery_app worker --pool=solo --loglevel=info

# 6. Start frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** ✓

---

## Step 1 — Create your account

1. Click **Sign up**
2. Enter email + password (8+ characters, must include a number)
3. You're in

---

## Step 2 — Set up your profile (Settings)

Go to **Settings** in the sidebar. This is the most important step — the AI uses your profile to score every job.

### Fill in each section:

**AI Model**
- Choose **Claude** (recommended, best quality) or **Gemini** (faster)
- Make sure the matching API key is set in your `.env`

**Default Job Search**
- Set a search query like `Python Developer` or `React Engineer`
- Set your preferred location (`Remote`, `London`, `New York`)
- Pick a job type (Full-time / Internship / Contract / etc.)
- Choose which job boards to search

**Job Preferences**
- **Target titles**: `Software Engineer, Backend Developer` (comma-separated)
- **Skills**: everything you know — `Python, React, PostgreSQL, Docker, AWS` — be comprehensive, the AI uses this for scoring
- **Salary range**: optional but useful for filtering
- Check **Remote only** if you only want remote roles

**Base Resume** (do this in the Resume tab)
Go to **Resume** in the sidebar. Paste your resume in **Markdown format**:

```markdown
# Your Name
email@example.com | linkedin.com/in/you | github.com/you

## Summary
2 sentences about who you are and what you're looking for.

## Experience
### Job Title — Company (2022–present)
- Achievement with a number
- Another achievement

## Skills
Python, React, PostgreSQL, Docker, AWS

## Education
Degree — University, Year
```

Click **Save**.

Hit **Save Changes** in Settings when done.

---

## Step 3 — Find jobs

On the **Dashboard**, use the **Find Jobs** search bar:

| What you want | How to do it |
|--------------|-------------|
| Any job | Type a title, click Search |
| Internships | Click 🎓 **Internship** preset chip |
| Entry-level jobs | Click 🌱 **Entry Level** |
| Senior roles | Click ⚡ **Senior** |
| Remote only | Click 🌍 **Remote Only** |
| Contract work | Click 📋 **Contract** |

Or click **Run Agent** in the sidebar to use your default search config.

The scrape takes 30–120 seconds. You'll see the agent status update in the top bar.

---

## Step 4 — Review scored jobs

After scraping, go to **Jobs** in the sidebar.

Each card shows:
- Job title, company, location
- **Score** (0–100) — how well it matches your profile
  - 🟢 75+ = strong match
  - 🟡 55–74 = moderate match
  - 🔴 <55 = weak match
- AI reasoning (1–2 sentences)

**Click any card** to open the full detail panel showing matched/missing skills and the full job description.

**Approve** jobs you want to apply for. **Reject** the rest.

> You can also use the **Jobs** tab to filter by status (Pending Review / Approved / Rejected).

---

## Step 5 — Review your tailored resumes

After approving jobs, the agent generates a custom resume for each one. Go to **Resume** in the sidebar.

For each approved job you'll see a draft that:
- Emphasises your skills that match this role
- Incorporates keywords from the job description
- Adjusts your summary to address this specific company

**What to do:**
1. Read through the draft
2. Edit anything you want (your edits are saved as AI training data)
3. Click **Save** to confirm it for submission

---

## Step 6 — Track your applications

Go to **Applications** for the Kanban view:

```
Draft → Resume Ready → Submitted → Responded → Interview → Offer/Rejected
```

When you hear back from a company, open the application and record the outcome. This data helps the AI improve.

---

## Step 7 — Watch analytics grow

Go to **Analytics** to see:
- Applications by status
- Interview rate
- Offer rate

The more you use it, the more useful this becomes.

---

## Quick tips

**Getting better scores:**
- Add more skills to your profile — the AI can only match what it knows about you
- Write a detailed base resume — the AI tailors what you give it

**Getting better resumes:**
- Edit the AI drafts when they're not quite right — every edit trains the AI
- After 50+ edits/ratings, go to **Resume → AI Training** and click **Start DPO Training**

**Running efficiently:**
- Set your default search config in Settings so **Run Agent** just works
- Use presets to quickly find niche job types
- Set auto-approve threshold to 85+ if you trust the AI scoring

**Daily workflow once set up:**
1. Click **Run Agent**
2. Review ~20 scored jobs (2–3 min)
3. Approve the best ones
4. Quickly review generated resumes, edit if needed
5. Done — applications are submitted automatically

---

## Keyboard shortcuts (coming soon)

| Key | Action |
|-----|--------|
| `A` | Approve selected job |
| `R` | Reject selected job |
| `→` / `←` | Next / previous job |

---

## Need help?

- 📖 Full docs: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- 🐛 Bug report: [github.com/parnish007/jobagent/issues](https://github.com/parnish007/jobagent/issues)
- 💬 Questions: [github.com/parnish007/jobagent/discussions](https://github.com/parnish007/jobagent/discussions)
