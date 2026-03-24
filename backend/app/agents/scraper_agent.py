"""Scraper agent node — fetches jobs from multiple boards and writes raw_jobs."""
import hashlib
import uuid
from typing import Any

from app.agents.state import AgentState
from app.core.database import AsyncSessionLocal
from app.models.job import RawJob, JobSource


async def scraper_node(state: AgentState) -> dict[str, Any]:
    """LangGraph node: scrape jobs based on user config."""
    config = state.get("scrape_config", {})
    raw_job_ids = []
    errors = list(state.get("errors", []))

    try:
        from app.scraping.jobspy_scraper import scrape_jobs
        jobs = await scrape_jobs(
            search_query=config.get("search_query", "software engineer"),
            location=config.get("location", "Remote"),
            sites=config.get("sites", ["linkedin", "indeed"]),
            results_wanted=config.get("results_wanted", 20),
        )

        async with AsyncSessionLocal() as db:
            for job_data in jobs:
                fingerprint = hashlib.sha256(job_data["url"].encode()).hexdigest()

                # Check for duplicate
                from sqlalchemy import select
                result = await db.execute(
                    select(RawJob).where(RawJob.fingerprint == fingerprint)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    continue

                raw_job = RawJob(
                    id=uuid.uuid4(),
                    fingerprint=fingerprint,
                    source=job_data.get("source", JobSource.custom),
                    url=job_data["url"],
                    title=job_data["title"],
                    company=job_data["company"],
                    location=job_data.get("location"),
                    description=job_data.get("description"),
                    salary_min=job_data.get("salary_min"),
                    salary_max=job_data.get("salary_max"),
                    salary_currency=job_data.get("salary_currency"),
                    employment_type=job_data.get("employment_type"),
                    remote=job_data.get("remote"),
                    posted_date=job_data.get("posted_date"),
                    raw_data=job_data,
                )
                db.add(raw_job)
                raw_job_ids.append(str(raw_job.id))

            await db.commit()

    except Exception as e:
        errors.append(f"scraper_node error: {str(e)}")

    return {
        "raw_job_ids": raw_job_ids,
        "jobs_scraped": len(raw_job_ids),
        "errors": errors,
        "current_step": "scraping_complete",
    }
