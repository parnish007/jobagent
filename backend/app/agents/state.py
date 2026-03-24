from typing import TypedDict, Optional, Annotated
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """Shared state passed between all LangGraph nodes."""
    # Run context
    user_id: str
    agent_run_id: str
    thread_id: str

    # Scraping
    scrape_config: dict          # {search_query, location, sites, results_wanted}
    raw_job_ids: list[str]       # IDs of newly scraped raw_jobs

    # Scoring
    scored_job_ids: list[str]    # IDs of ScoredJob rows just created
    jobs_pending_review: list[dict]   # Jobs awaiting human approval

    # Human gate 1 — job approval
    approved_job_ids: list[str]
    rejected_job_ids: list[str]
    human_approval_received: bool

    # Resume generation
    resume_version_ids: list[str]   # Generated resume versions

    # Human gate 2 — resume review
    resume_approved: bool

    # Application
    application_ids: list[str]
    applications_submitted: list[str]

    # Progress counters
    jobs_scraped: int
    jobs_scored: int
    jobs_approved: int
    resumes_generated: int
    applications_submitted_count: int

    # Error tracking
    errors: list[str]
    current_step: str

    # Messages for LLM reasoning (append-only)
    messages: Annotated[list, add_messages]
