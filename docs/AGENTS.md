# Agent System

Job Agent uses [LangGraph](https://github.com/langchain-ai/langgraph) to build a stateful multi-agent pipeline. This document covers the graph structure, each node's implementation, the human-in-the-loop mechanism, and how to extend the system.

---

## Table of Contents

- [Overview](#overview)
- [AgentState](#agentstate)
- [Graph Structure](#graph-structure)
- [Nodes](#nodes)
  - [scraper_node](#scraper_node)
  - [scorer_node](#scorer_node)
  - [resume_node](#resume_node)
  - [application_node](#application_node)
- [Human Gates](#human-gates)
- [Checkpointing](#checkpointing)
- [Running the Graph](#running-the-graph)
- [Extending the Graph](#extending-the-graph)
- [LLM Prompts](#llm-prompts)

---

## Overview

The agent pipeline is a directed graph compiled from a LangGraph `StateGraph`. Each node is an async Python function that receives the current `AgentState`, does its work, and returns a partial state update (a dict with only the keys it changed).

```
scrape_jobs
    │
score_jobs ──── (no jobs scored) ──────► END
    │
human_job_review  ◄─ INTERRUPT
    │
    │ (approved_job_ids set by user)
    │
generate_resumes ──── (no resumes) ───► END
    │
human_resume_review  ◄─ INTERRUPT
    │
    │ (resume_approved = true)
    │
submit_applications
    │
   END
```

The graph is compiled with `MemorySaver` as the checkpointer and `interrupt_before=["human_job_review", "human_resume_review"]` so execution automatically pauses at both human gates.

---

## AgentState

`AgentState` is a `TypedDict` defined in `backend/app/agents/state.py`. Every node reads from it and returns a partial update.

```python
class AgentState(TypedDict):
    # Identity
    user_id: str            # UUID of the user this run belongs to
    agent_run_id: str       # UUID of the agent_runs row
    thread_id: str          # LangGraph checkpoint thread ID

    # Scraping config
    scrape_config: dict     # {search_query, location, sites, results_wanted}

    # Pipeline data (accumulated as graph progresses)
    raw_job_ids: list[str]          # New raw_jobs inserted this run
    scored_job_ids: list[str]       # ScoredJob IDs created this run
    jobs_pending_review: list[dict] # Summary of jobs waiting for human review
    approved_job_ids: list[str]     # Set by human gate 1
    rejected_job_ids: list[str]     # Set by human gate 1
    resume_version_ids: list[str]   # ResumeVersion IDs created this run
    application_ids: list[str]      # Application IDs created this run
    applications_submitted: list[str]

    # Human gate flags
    human_approval_received: bool
    resume_approved: bool

    # Progress counters (synced to agent_runs table)
    jobs_scraped: int
    jobs_scored: int
    jobs_approved: int
    resumes_generated: int
    applications_submitted_count: int

    # Error tracking
    errors: list[str]       # Non-fatal errors (node continues on error)
    current_step: str       # String description of current progress

    # LLM message history (append-only via add_messages reducer)
    messages: Annotated[list, add_messages]
```

**Key convention**: nodes never fail the entire graph on individual item errors. Instead they append to `errors` and continue processing other items. This ensures a failing job doesn't prevent all other jobs from being scored.

---

## Graph Structure

File: `backend/app/agents/graph.py`

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

graph = StateGraph(AgentState)

graph.add_node("scrape_jobs", scraper_node)
graph.add_node("score_jobs", scorer_node)
graph.add_node("generate_resumes", resume_node)
graph.add_node("submit_applications", application_node)
graph.add_node("human_job_review", _human_job_review_node)
graph.add_node("human_resume_review", _human_resume_review_node)

graph.set_entry_point("scrape_jobs")
graph.add_edge("scrape_jobs", "score_jobs")

# Conditional: only proceed to human gate if jobs were scored
graph.add_conditional_edges("score_jobs", should_continue_after_scoring, {
    "human_job_review": "human_job_review",
    END: END,
})

# After human gate: only proceed if jobs were approved
graph.add_conditional_edges("human_job_review", _after_job_review, {
    "generate_resumes": "generate_resumes",
    END: END,
})

# Conditional: only proceed to second gate if resumes were generated
graph.add_conditional_edges("generate_resumes", should_continue_after_resume, {
    "human_resume_review": "human_resume_review",
    END: END,
})

# After second gate: only proceed if user approved resume
graph.add_conditional_edges("human_resume_review", should_submit, {
    "submit_applications": "submit_applications",
    END: END,
})

graph.add_edge("submit_applications", END)

agent_graph = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["human_job_review", "human_resume_review"],
)
```

---

## Nodes

### scraper_node

**File**: `backend/app/agents/scraper_agent.py`

**What it does**:
1. Calls `jobspy_scraper.scrape_jobs()` with the user's `scrape_config`
2. For each returned job, computes a SHA256 fingerprint of the job URL
3. Skips jobs whose fingerprint already exists in `raw_jobs` (deduplication)
4. Inserts new `RawJob` rows to the database
5. Returns the list of newly inserted raw_job IDs

**Inputs from state**: `user_id`, `scrape_config`

**Writes to state**: `raw_job_ids`, `jobs_scraped`, `errors`

**Writes to DB**: `raw_jobs`

**Error handling**: Individual job insertion errors are caught and appended to `errors`. The node continues processing remaining jobs.

---

### scorer_node

**File**: `backend/app/agents/scorer_agent.py`

**What it does**:
1. Loads the user's `UserProfile` from the database
2. For each `raw_job_id` in state:
   - Constructs a scoring prompt with the user profile + job details
   - Calls Claude Sonnet with the prompt
   - Parses the JSON response: `{score, reasoning, matched_skills, missing_skills}`
   - Inserts a `ScoredJob` row with `status = pending_review`
3. Returns the list of scored_job IDs

**Inputs from state**: `user_id`, `raw_job_ids`

**Writes to state**: `scored_job_ids`, `jobs_scored`, `errors`

**Writes to DB**: `scored_jobs`

**LLM model**: `claude-sonnet-4-6` (configurable via `DEFAULT_MODEL`)

**Prompt structure**:
```
System: You are a job matching expert. Score this job listing against the candidate profile.

Candidate Profile: {skills, experience, titles, locations, salary range}
Job: {title, company, location, description (truncated to 3000 chars)}

Return JSON: {score: 0-100, reasoning: str, matched_skills: [], missing_skills: []}
```

---

### resume_node

**File**: `backend/app/agents/resume_agent.py`

**What it does**:
1. Loads the user's `base_resume_text` from their `UserProfile`
2. For each `approved_job_id` in state:
   - Loads the `ScoredJob` and its `RawJob`
   - Constructs a resume tailoring prompt
   - Calls Claude Sonnet with the prompt
   - Inserts a `ResumeVersion` row with the generated content
3. Returns the list of resume_version IDs

**Inputs from state**: `user_id`, `approved_job_ids`

**Writes to state**: `resume_version_ids`, `resumes_generated`, `errors`

**Writes to DB**: `resume_versions`

**Prompt structure**:
```
You are an expert resume writer. Create a tailored resume for this specific job.

Base Resume: {base_resume_text}
Target Job: {title, company, description (truncated to 3000 chars)}
Matched Skills: {matched_skills}

Instructions:
1. Rewrite to emphasize skills most relevant to this role
2. Use keywords from the job description naturally
3. Do not invent experiences — keep facts accurate
4. Format in clean Markdown
5. Include: Contact info, Summary, Experience, Skills, Education

Return only the resume text in Markdown format.
```

---

### application_node

**File**: `backend/app/agents/application_agent.py`

**What it does**:
1. For each `resume_version_id` in state:
   - Loads the `ResumeVersion`, its `ScoredJob`, and the `RawJob` URL
   - Creates an `Application` row with `status = draft`
   - Calls `_submit_via_playwright(job_url, resume_content)`
   - If submission succeeds: updates status to `submitted`
   - If submission fails: leaves status as `draft`, adds a note for manual submission

**Inputs from state**: `user_id`, `resume_version_ids`

**Writes to state**: `application_ids`, `applications_submitted`, `applications_submitted_count`, `errors`

**Writes to DB**: `applications`

**Playwright flow**:
```python
async def _submit_via_playwright(job_url, resume_content):
    # 1. Open browser with stealth headers
    # 2. Navigate to job URL
    # 3. Detect form type:
    #    - LinkedIn Easy Apply button → click, return "linkedin_easy_apply"
    #    - Indeed Quick Apply button → click, return "indeed_quick_apply"
    #    - Unknown → return (False, "unknown")
    # 4. Close browser
```

> Full form-filling automation (filling text fields, uploading resume PDF, answering screening questions) is the most complex part of the system and is incrementally implemented. The current implementation detects and initiates the apply flow; complete form automation is a near-future addition.

---

## Human Gates

Human gates are implemented using LangGraph's `interrupt_before` mechanism. When the graph reaches a node listed in `interrupt_before`, execution pauses and the full state is persisted to the checkpointer.

### How it works

```python
# Compile with interrupt points
agent_graph = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["human_job_review", "human_resume_review"],
)

# First invocation — runs scrape → score → pauses at human_job_review
result = await agent_graph.ainvoke(initial_state, config={"configurable": {"thread_id": "abc123"}})
# result["current_step"] == "awaiting_job_review"

# User reviews jobs via the dashboard (approves some, rejects others)
# This updates scored_jobs.status in the database

# Resume from the same thread — passes approved_job_ids, runs resume → pauses at human_resume_review
update = {"approved_job_ids": ["id1", "id2"], "human_approval_received": True}
result = await agent_graph.ainvoke(update, config={"configurable": {"thread_id": "abc123"}})
# result["current_step"] == "awaiting_resume_review"

# User reviews resumes, confirms submission
update = {"resume_approved": True}
result = await agent_graph.ainvoke(update, config={"configurable": {"thread_id": "abc123"}})
# result["current_step"] == "application_complete"
```

The `thread_id` is stored in `agent_runs.thread_id` so the API can resume the correct graph instance.

---

## Checkpointing

`MemorySaver` stores checkpoint state in memory. This means state is lost if the process restarts.

**For production**, replace `MemorySaver` with a persistent checkpointer:

```python
# PostgreSQL checkpointer (requires langgraph-checkpoint-postgres)
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

checkpointer = AsyncPostgresSaver.from_conn_string(settings.DATABASE_URL)
agent_graph = graph.compile(checkpointer=checkpointer, interrupt_before=[...])
```

Install: `pip install langgraph-checkpoint-postgres`

---

## Running the Graph

### Via the API (recommended)

```bash
# Trigger a full run
curl -X POST http://localhost:8000/api/v1/agent/run \
  -H "Authorization: Bearer $TOKEN"

# Check status
curl http://localhost:8000/api/v1/agent/status \
  -H "Authorization: Bearer $TOKEN"
```

### Programmatically

```python
from app.agents.graph import agent_graph

initial_state = {
    "user_id": "user-uuid",
    "agent_run_id": "run-uuid",
    "thread_id": "thread-uuid",
    "scrape_config": {
        "search_query": "Python backend engineer",
        "location": "Remote",
        "sites": ["linkedin", "indeed"],
        "results_wanted": 20,
    },
    "raw_job_ids": [],
    "scored_job_ids": [],
    "approved_job_ids": [],
    "rejected_job_ids": [],
    "resume_version_ids": [],
    "application_ids": [],
    "applications_submitted": [],
    "jobs_scraped": 0,
    "jobs_scored": 0,
    "jobs_approved": 0,
    "resumes_generated": 0,
    "applications_submitted_count": 0,
    "errors": [],
    "messages": [],
    "human_approval_received": False,
    "resume_approved": False,
    "current_step": "starting",
}

config = {"configurable": {"thread_id": "thread-uuid"}}
result = await agent_graph.ainvoke(initial_state, config=config)
```

---

## Extending the Graph

### Adding a new node

1. Create `backend/app/agents/my_node.py`:

```python
from app.agents.state import AgentState

async def my_node(state: AgentState) -> dict:
    # Do work...
    return {
        "current_step": "my_node_complete",
        "errors": state.get("errors", []),
    }
```

2. Register it in `graph.py`:

```python
from app.agents.my_node import my_node

graph.add_node("my_node", my_node)
graph.add_edge("score_jobs", "my_node")   # insert at desired position
graph.add_edge("my_node", "human_job_review")
```

3. Add any new fields to `AgentState` if needed.

### Adding a new human gate

```python
graph.add_node("human_third_gate", _placeholder_node)
graph.add_edge("my_node", "human_third_gate")

# Add to interrupt_before list
agent_graph = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["human_job_review", "human_resume_review", "human_third_gate"],
)
```

### Swapping the LLM

The LLM model is set in `config.py`:

```env
DEFAULT_MODEL=claude-sonnet-4-6
```

To use a different model, change `DEFAULT_MODEL` in your `.env`. Any model supported by the Anthropic SDK works. To use OpenAI models, replace the `anthropic.AsyncAnthropic` client with an OpenAI client in the scorer/resume nodes.

---

## LLM Prompts

### Job Scoring Prompt

**Location**: `scorer_agent.py` → `SCORING_PROMPT`

**Goal**: Return a structured JSON score for job-candidate fit.

**Key design choices**:
- Description truncated to 3000 chars to fit context efficiently
- Returns JSON directly (no markdown wrapper) for easy parsing
- `matched_skills` and `missing_skills` are arrays so the frontend can render them visually

### Resume Tailoring Prompt

**Location**: `resume_agent.py` → `RESUME_PROMPT`

**Goal**: Produce a job-specific resume that is factually accurate and keyword-optimized.

**Key design choices**:
- Explicit constraint: "do not invent experiences"
- Format requirement: Markdown output for easy editing and rendering
- `matched_skills` passed in context to focus the rewrite
- 2048 max tokens — enough for a full resume without being wasteful

Both prompts are plain string templates. To iterate on prompt quality, edit them directly in their respective files — no other code changes needed.
