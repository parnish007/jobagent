"""Full LangGraph agent graph with human-in-the-loop gates."""
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.state import AgentState
from app.agents.scraper_agent import scraper_node
from app.agents.scorer_agent import scorer_node
from app.agents.resume_agent import resume_node
from app.agents.application_agent import application_node


def should_continue_after_scoring(state: AgentState) -> str:
    """Route after scoring: if jobs scored, pause for human review."""
    if state.get("jobs_scored", 0) > 0:
        return "human_job_review"
    return END


def should_continue_after_resume(state: AgentState) -> str:
    """Route after resume generation: if resumes ready, pause for human review."""
    if state.get("resumes_generated", 0) > 0:
        return "human_resume_review"
    return END


def should_submit(state: AgentState) -> str:
    """Route after resume review: if approved, go to application submission."""
    if state.get("resume_approved", False) and state.get("approved_job_ids"):
        return "submit_applications"
    return END


def build_graph() -> StateGraph:
    """Build and compile the full agent graph."""
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("scrape_jobs", scraper_node)
    graph.add_node("score_jobs", scorer_node)
    graph.add_node("generate_resumes", resume_node)
    graph.add_node("submit_applications", application_node)

    # Human interrupt nodes (these pause execution)
    graph.add_node("human_job_review", _human_job_review_node)
    graph.add_node("human_resume_review", _human_resume_review_node)

    # Edges
    graph.set_entry_point("scrape_jobs")
    graph.add_edge("scrape_jobs", "score_jobs")
    graph.add_conditional_edges("score_jobs", should_continue_after_scoring, {
        "human_job_review": "human_job_review",
        END: END,
    })
    graph.add_conditional_edges("human_job_review", _after_job_review, {
        "generate_resumes": "generate_resumes",
        END: END,
    })
    graph.add_conditional_edges("generate_resumes", should_continue_after_resume, {
        "human_resume_review": "human_resume_review",
        END: END,
    })
    graph.add_conditional_edges("human_resume_review", should_submit, {
        "submit_applications": "submit_applications",
        END: END,
    })
    graph.add_edge("submit_applications", END)

    # Compile with memory checkpointing (supports interrupt/resume)
    checkpointer = MemorySaver()
    return graph.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_job_review", "human_resume_review"],
    )


async def _human_job_review_node(state: AgentState) -> dict:
    """Placeholder — execution pauses here until user approves jobs."""
    return {"current_step": "awaiting_job_review"}


async def _human_resume_review_node(state: AgentState) -> dict:
    """Placeholder — execution pauses here until user reviews resumes."""
    return {"current_step": "awaiting_resume_review"}


def _after_job_review(state: AgentState) -> str:
    if state.get("approved_job_ids"):
        return "generate_resumes"
    return END


# Singleton graph instance
agent_graph = build_graph()
