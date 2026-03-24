# Job Agent — The Story Behind It

> How a first-year CS student got tired of the internship grind and built an AI that does it for them.

---

## It started with rejection emails I couldn't explain

First year of CS. Everyone around me is applying for internships. I start doing the same.

The process goes like this: find a job posting, copy-paste your resume, tweak the summary paragraph to mention the company name, hit apply, wait. Get a rejection. Don't know why. Try again somewhere else.

After a few weeks of this I had three problems that were genuinely bothering me:

**I had no idea what was a good fit.** Every job posting looks the same when you're reading ten a day. "Proficient in Python, strong communication skills, passion for technology." I couldn't tell which roles were actually worth applying to versus which ones were going to be a waste of time because I was clearly underqualified or overqualified.

**My resume said the same thing to everyone.** I knew you were supposed to tailor your resume to each job. I also knew that doing it properly for every application would take an hour each time. So I didn't. I sent the same document everywhere and convinced myself it was fine.

**I had no idea where I'd applied.** A spreadsheet. Then the spreadsheet got out of date. Then I stopped updating it. Then I genuinely didn't know if I'd already applied somewhere or not.

I complained about this to a friend. He said "just use LinkedIn Easy Apply." I did. I applied to 30 things in one afternoon and heard back from zero of them. Faster rejection, same result.

That's when I started thinking: what if I could automate the smart parts too, not just the clicking?

---

## The idea

I wanted a system that would:

1. Go find relevant jobs for me every day across multiple boards
2. Actually read each job description and tell me whether I was a good fit and why
3. Rewrite my resume for each job I wanted to apply to — not copy-paste, actually rewrite it
4. Let me review and approve everything before it did anything real
5. Keep track of where everything stood

That last point was important to me. I'd heard about people building bots that auto-apply to hundreds of jobs. That felt wrong. A real person made the decision to post that job. The least I could do was make a real decision to apply. I just wanted the robot to do the research and paperwork.

So the design was: **AI does the boring work, I make all the real decisions.**

---

## What I knew going in (not much)

I was a first-year student. I'd done the intro Python course. I'd built a few small scripts. I knew what an API was in theory. I had never built a full-stack application. I had never touched a database. I didn't know what async meant.

I picked this project specifically because it would force me to learn things I didn't know yet. I made a list of what I thought I'd need:

- A way to scrape job listings (scraping? I'd heard of it)
- An AI to score and summarize jobs (I'd used ChatGPT, I knew APIs existed)
- A database to store everything
- A web interface so I could actually use it
- Some kind of task runner for the background work

Simple enough. I was very wrong about the "simple" part.

---

## Building it: the real order things happened

### First: getting jobs onto a screen

The first thing I needed was actual job data. I found a Python library called `JobSpy` that could pull listings from LinkedIn, Indeed, Glassdoor, and ZipRecruiter with a single function call. This felt like cheating in the best way.

```python
from jobspy import scrape_jobs
df = scrape_jobs(site_name=["linkedin", "indeed"], search_term="python intern", location="Remote")
```

I ran it and got a pandas DataFrame with hundreds of jobs. I stared at it for a while. This was real data. This actually worked. I added Google Jobs to the list too once I realized JobSpy supported it.

The problem was that every time I ran it, I'd see the same jobs again. I had to figure out deduplication. I learned about hashing — I took `title + company + url`, ran it through SHA-256, stored that hash as a unique key. If the same job appeared on two boards or if I ran the scraper twice, it would only be stored once. First real problem, first real solution.

### Second: making the AI understand what I wanted

I had a list of jobs. Now I needed the AI to read each one and tell me if I should apply.

My first attempt was terrible. I just sent the job description to the API and asked "is this good for me?" The AI had no idea who I was. It gave me generic responses.

I realized I needed to give the AI a profile of myself — my skills, what kind of roles I wanted, how much experience I had — and ask it to score the job *against that profile*. So I built a user profile system with fields for skills, target roles, years of experience, and preferences.

Then I had to figure out how to get consistent, parseable responses from the AI. Raw text wasn't useful — I needed structured data I could store and display. I discovered that if you tell the AI "respond only with JSON in this exact format," it mostly does. I built `get_llm_json()`, a wrapper that sends the prompt, parses the response, and retries if the JSON comes back malformed (which happens more than you'd think).

The scoring prompt took many iterations. My first version just asked for a score. I got random numbers that didn't mean anything. Eventually I built a rubric:

- 40 points for skills overlap
- 30 points for seniority fit
- 20 points for domain relevance
- 10 points for location/remote preference

With explicit point breakdowns, the scores became consistent and explainable. A score of 72 meant something specific — good skills match, slight seniority gap. That was useful information.

### Third: the async wall

This is where things got hard.

I wanted to score multiple jobs at the same time — sending one API call at a time and waiting for each would take forever. I needed concurrent requests. I had to learn what `async`/`await` meant.

I spent a week understanding the Python event loop. The mental model that finally clicked for me was: async isn't about doing multiple things simultaneously, it's about not *waiting* while one thing finishes before starting the next. While the AI is thinking about job #1, we can send job #2. While it's thinking about #2, we can send #3.

Once I understood that, I rewrote the entire backend to be async. `async def` everywhere, `await` on every database call and API call. Every database query uses SQLAlchemy's async engine. FastAPI is async-native, which is part of why I picked it.

The catch: some libraries (the AI SDKs, JobSpy) are synchronous. Calling them from an async function blocks the event loop. Solution: `asyncio.get_event_loop().run_in_executor(None, sync_function)` — push the sync work to a thread pool, await its result. I wrote this pattern maybe thirty times.

### Fourth: the human gates (the important architectural decision)

I had a working pipeline: scrape → score → generate resume → done. I could have made it fully automatic. I chose not to.

The reason was simple: I thought about what it would actually feel like to use this system. If a bot was submitting applications on my behalf without me reading them, I would feel anxious every time. What did it say? What resume did it send? Did it fabricate something?

I added two mandatory pause points where the system stops and waits for me:

1. **After scoring** — I see every scored job, decide which ones I want to apply to
2. **After resume generation** — I read the tailored resume before it's submitted

The technical implementation used LangGraph's `interrupt_before` feature, which literally stops execution at a named node and saves the entire state to memory. When I come back and say "continue," it picks up exactly where it left off. It was the right tool for this problem — if I'd tried to implement this with manual state flags and Celery, it would have been fragile and complex.

The principle I wrote in my design notes: *"The robot does the research. The human makes the decision."*

### Fifth: the database design rabbit hole

I had been storing everything in dictionaries in memory. Every time I restarted the server, all the data was gone. I needed a real database.

I chose PostgreSQL because everyone said it was the serious choice, and I wanted to learn the serious choice. I used SQLAlchemy as the ORM — so I could write Python classes that automatically become database tables, without writing SQL directly.

The schema took several attempts to get right. The key insight was separating raw scraped data from scored data:

- `raw_jobs` — exactly what was scraped, never modified
- `scored_jobs` — the AI's evaluation, linked to a raw job

This separation means if I improve the scoring model later, I can re-score existing raw jobs without touching the original data.

I also added `pgvector` — a PostgreSQL extension that lets you store vector embeddings as a native column type. This was for the reward model: instead of calling the expensive LLM to evaluate resume quality, I could embed the resume and job description as 384-dimensional vectors and compute cosine similarity. Cheap, fast, no API call.

### Sixth: making it real-time

The scraping takes 30–90 seconds. Sitting there watching a spinner with no feedback is a bad user experience. I wanted to show live progress: "found 23 jobs on LinkedIn," "scoring job 7 of 23," "waiting for your review."

I learned about WebSockets — a persistent two-way connection between the browser and the server. I also learned about Redis pub/sub — a message broadcasting system where any process can publish events to a channel and any subscriber gets them immediately.

The architecture I built: the Celery worker (running the agent) publishes events to a Redis channel named `agent:events:{user_id}`. The FastAPI WebSocket endpoint subscribes to that channel and forwards events to the browser. The React component receives the events and updates the UI.

If the WebSocket connection drops, the frontend falls back to polling the `/agent/status` endpoint every 5 seconds. I added a small WiFi icon to the UI so I could tell which mode was active. Small detail, but it made me feel like I understood what was happening in my own system.

### Seventh: the resume generation and the RL idea

Getting the AI to write a tailored resume was harder than scoring. Scoring is just classification — give me a number and a reason. Resume generation is creative writing that needs to stay truthful, use specific keywords, and sound like the person who wrote the original.

My final prompt structure:
1. Here is the candidate's base resume
2. Here is the job description
3. Here is the list of skills that match
4. Rewrite the resume to emphasise the matching skills, mirror the job's language, adjust the summary — but do not fabricate anything

The "do not fabricate" instruction was important to me. I wanted a tool I could trust.

The RL part came from a realization: every time I edited the AI's resume draft, I was giving it feedback. "This version is better than that version." That's training data. I built a preference collection system that records those comparisons automatically — the edited version is "chosen," the original AI draft is "rejected." After 50 such comparisons, you can trigger Direct Preference Optimization (DPO) fine-tuning on a small model (`flan-t5-base`), which makes future generations closer to your preferred style.

I haven't gotten to 50 edits yet. But the infrastructure is there.

### Eighth: making it look like a real product

I had an API. I needed a UI.

I chose Next.js 14 with the App Router because it seemed like what people were actually using. I used Tailwind CSS because writing styles in utility classes is fast. I used `@tanstack/react-query` for data fetching because it handles caching, loading states, and background refetching automatically.

The dashboard has:
- A job search bar with preset chips (Internship, Remote, Senior, Contract, Entry Level) that fill in search parameters automatically
- A job feed with scored cards showing the AI's reasoning
- A slide-over detail panel when you click a job
- A resume page with a drag-and-drop upload zone (you can upload a PDF or DOCX and it extracts the text)
- A Kanban board for applications
- A settings page with a chip-based input for target roles

The settings page target roles section was one of the last things I built and one of the things I'm most happy with. Instead of a text field where you type comma-separated values, you type a role and press Enter and it becomes a chip you can delete individually. Small interaction detail, much cleaner experience.

---

## What I'd do differently

**I'd use `AsyncPostgresSaver` instead of `MemorySaver` for LangGraph checkpoints.** `MemorySaver` stores agent state in RAM, so it's lost if the server restarts mid-run. The right solution is storing checkpoints in the same PostgreSQL database as everything else. I know how to do this now; it's on the roadmap.

**I'd write integration tests from the beginning.** I have almost no automated tests. Every time I change something, I manually test the happy path in the browser. This doesn't scale. The right approach is a test database and `pytest-asyncio` tests that hit real endpoints.

**I'd think harder about the LLM prompt structure earlier.** I spent a lot of time iterating on prompts that could have been better from the start if I'd read more about structured output and rubric-based scoring before writing the first version.

---

## What I'm proud of

**The two-gate architecture.** It's a real design decision, not an accident. The system is built so that it's architecturally impossible for something to be submitted without my approval — it's not a flag I can accidentally set wrong, it's a graph interrupt that has to be explicitly resumed.

**The LLM abstraction.** Every part of the system calls `get_llm_response()` or `get_llm_json()`. Switching from Claude to Gemini is a settings change, not a code change. I built this after having to change the provider in four places manually, which is how I learned why abstractions exist.

**The unified setup.** One `.env.example` at the root. One `requirements.txt` at the root. One virtualenv. No `cd` into subdirectories just to install dependencies. I got annoyed at projects with fractured setup instructions and made sure mine wasn't one of them.

**The real-time feedback.** The WebSocket pub/sub pipeline from Celery worker → Redis → FastAPI → browser feels like a small distributed systems project inside the larger one. The fact that it falls back to polling gracefully means it works even when something breaks.

---

## The numbers

- ~100 files across backend, frontend, MCP server, docker, and docs
- 11 database tables
- 5 job boards scraped
- 2 LLM providers supported
- 2 human review gates
- 3 RL signal types (edit, explicit rating, interview outcome)
- 0 applications submitted without user approval

---

## What's next

- **Workday / Greenhouse / Lever ATS support** — right now the submission only handles LinkedIn Easy Apply and Indeed Quick Apply. Most serious companies use proprietary ATS systems that are harder to automate. Getting these right is the next major feature.

- **Email/Slack notifications** — when a high-score job appears, I want to know immediately, not just when I open the dashboard.

- **Production deployment** — right now this only runs locally. The next step is a proper deployment guide with Docker Compose for production, environment hardening, and a cloud setup guide.

- **More users** — the system is currently single-user by design but the schema supports multi-user already (every row is scoped to a `user_id`). The missing piece is a proper onboarding flow.

---

## Why I'm sharing this

I built this to solve my own problem. It works — I use it. But I also built it to see if I could build something real, not a tutorial project, not a CRUD app with a different name. Something with actual moving parts, actual design decisions, actual tradeoffs.

If you're a CS student in the same position I was — frustrated with the job search, not sure how to apply what you're learning to something real — this is the kind of project I'd recommend. Pick a problem you actually have. Build the solution. You'll learn ten times more than any course.

---

*Built by a first-year CS student who got tired of rejection emails and decided to do something about it.*

**GitHub**: [github.com/parnish007/jobagent](https://github.com/parnish007/jobagent)
