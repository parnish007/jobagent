"""
Job Agent MCP Server — exposes agent tools via FastMCP protocol.
Agents can call these tools directly instead of going through the HTTP API.

Run: python server.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from mcp.server.fastmcp import FastMCP
from app.core.config import settings

mcp = FastMCP("Job Agent Tools")


# ─── Job tools ───────────────────────────────────────────────────────────────

@mcp.tool()
async def scrape_jobs(
    search_query: str,
    location: str = "Remote",
    sites: list[str] = ["linkedin", "indeed"],
    results_wanted: int = 20,
) -> dict:
    """Scrape job listings from multiple job boards.

    Args:
        search_query: Job title or keywords to search for
        location: Location to search in (e.g., 'Remote', 'New York')
        sites: Job boards to scrape (linkedin, indeed, glassdoor, zip_recruiter)
        results_wanted: Maximum number of results per board
    """
    from app.scraping.jobspy_scraper import scrape_jobs as _scrape
    jobs = await _scrape(search_query, location, sites, results_wanted)
    return {"jobs_found": len(jobs), "jobs": jobs[:10]}  # return sample


@mcp.tool()
async def score_job(job_id: str, user_id: str) -> dict:
    """Score a raw job against a user's profile using LLM.

    Args:
        job_id: UUID of the raw_job to score
        user_id: UUID of the user to score against
    """
    from app.core.database import AsyncSessionLocal
    from app.models.job import RawJob
    from app.models.user import UserProfile
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        job = await db.get(RawJob, uuid.UUID(job_id))
        profile_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id))
        )
        profile = profile_result.scalar_one_or_none()

    if not job:
        return {"error": f"Job {job_id} not found"}

    from app.agents.scorer_agent import scorer_node
    result = await scorer_node({"user_id": user_id, "raw_job_ids": [job_id], "errors": []})
    return result


@mcp.tool()
async def generate_resume(job_id: str, user_id: str) -> dict:
    """Generate a tailored resume for a specific job.

    Args:
        job_id: UUID of the scored_job to generate resume for
        user_id: UUID of the user
    """
    from app.agents.resume_agent import resume_node
    result = await resume_node({"user_id": user_id, "approved_job_ids": [job_id], "errors": []})
    return result


@mcp.tool()
async def get_user_profile(user_id: str) -> dict:
    """Get a user's profile and job preferences.

    Args:
        user_id: UUID of the user
    """
    from app.core.database import AsyncSessionLocal
    from app.models.user import UserProfile
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id))
        )
        profile = result.scalar_one_or_none()

    if not profile:
        return {"error": "Profile not found"}

    return {
        "target_titles": profile.target_titles,
        "target_locations": profile.target_locations,
        "skills": profile.skills,
        "years_experience": profile.years_experience,
        "remote_only": profile.remote_only,
        "salary_min": profile.salary_min,
        "salary_max": profile.salary_max,
        "blacklisted_companies": profile.blacklisted_companies,
    }


@mcp.tool()
async def update_job_status(job_id: str, status: str, user_id: str) -> dict:
    """Update the status of a scored job (approve/reject).

    Args:
        job_id: UUID of the scored_job
        status: New status — 'approved' or 'rejected'
        user_id: UUID of the user (for authorization)
    """
    from app.core.database import AsyncSessionLocal
    from app.models.job import ScoredJob, JobStatus
    from sqlalchemy import select
    import uuid

    if status not in ("approved", "rejected"):
        return {"error": "status must be 'approved' or 'rejected'"}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScoredJob).where(
                ScoredJob.id == uuid.UUID(job_id),
                ScoredJob.user_id == uuid.UUID(user_id),
            )
        )
        job = result.scalar_one_or_none()
        if not job:
            return {"error": f"Job {job_id} not found"}
        job.status = JobStatus(status)
        await db.commit()

    return {"success": True, "job_id": job_id, "new_status": status}


@mcp.tool()
async def record_outcome(application_id: str, outcome: str, days_to_response: int = None) -> dict:
    """Record the outcome of a job application (for RL feedback).

    Args:
        application_id: UUID of the application
        outcome: Outcome type — 'interview', 'rejected', 'no_response', 'offer'
        days_to_response: Days from application to response
    """
    from app.core.database import AsyncSessionLocal
    from app.models.application import Application, ApplicationOutcome, ApplicationStatus
    import uuid

    valid_outcomes = ("interview", "rejected", "no_response", "offer")
    if outcome not in valid_outcomes:
        return {"error": f"outcome must be one of {valid_outcomes}"}

    async with AsyncSessionLocal() as db:
        app = await db.get(Application, uuid.UUID(application_id))
        if not app:
            return {"error": "Application not found"}

        outcome_record = ApplicationOutcome(
            application_id=app.id,
            outcome=outcome,
            days_to_response=days_to_response,
        )
        db.add(outcome_record)
        app.status = ApplicationStatus.responded
        await db.commit()

    return {"success": True, "outcome": outcome}


@mcp.tool()
async def list_pending_jobs(user_id: str, limit: int = 20) -> dict:
    """List jobs pending user review.

    Args:
        user_id: UUID of the user
        limit: Maximum number of jobs to return
    """
    from app.core.database import AsyncSessionLocal
    from app.models.job import ScoredJob, RawJob, JobStatus
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    import uuid

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScoredJob)
            .options(selectinload(ScoredJob.raw_job))
            .where(
                ScoredJob.user_id == uuid.UUID(user_id),
                ScoredJob.status == JobStatus.pending_review,
            )
            .order_by(ScoredJob.score.desc())
            .limit(limit)
        )
        jobs = result.scalars().all()

    return {
        "count": len(jobs),
        "jobs": [
            {
                "id": str(j.id),
                "score": j.score,
                "title": j.raw_job.title,
                "company": j.raw_job.company,
                "location": j.raw_job.location,
                "url": j.raw_job.url,
                "reasoning": j.score_reasoning,
            }
            for j in jobs
        ],
    }


if __name__ == "__main__":
    mcp.run()
