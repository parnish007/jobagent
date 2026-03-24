"""Celery tasks wrapping agent runs — publishes real-time events to Redis."""
import asyncio
import json
import uuid
from datetime import datetime

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.agent import AgentRun, AgentRunStatus


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ─── Redis event publisher ────────────────────────────────────────────────────

async def _publish_event(user_id: str, event: dict) -> None:
    """Publish a JSON event to the user's Redis pub/sub channel."""
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        channel = f"agent:events:{user_id}"
        await redis_client.publish(channel, json.dumps(event))
        await redis_client.aclose()
    except Exception:
        pass  # Non-critical — events are best-effort


# ─── Full agent pipeline ──────────────────────────────────────────────────────

@celery_app.task(bind=True, name="agent_tasks.run_full_agent")
def run_full_agent(self, user_id: str, scrape_config: dict | None = None):
    """
    Run the full agent pipeline:
    scrape_jobs → score_jobs → [human gate: job review] → generate_resumes
    → [human gate: resume review] → submit_applications
    """
    return _run_async(_run_full_agent_async(user_id, self.request.id, scrape_config or {}))


async def _run_full_agent_async(user_id: str, task_id: str, scrape_config: dict):
    from app.agents.graph import agent_graph

    thread_id = str(uuid.uuid4())
    start_time = datetime.utcnow()

    async with AsyncSessionLocal() as db:
        run = AgentRun(
            user_id=uuid.UUID(user_id),
            status=AgentRunStatus.running,
            current_step="starting",
            thread_id=thread_id,
        )
        db.add(run)
        await db.commit()
        run_id = str(run.id)

    await _publish_event(user_id, {
        "type": "status_update",
        "status": "running",
        "current_step": "starting",
        "run_id": run_id,
    })

    try:
        # Load user's preferred LLM provider
        from sqlalchemy import select
        from app.models.user import UserProfile
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id)))
            profile = result.scalar_one_or_none()
            llm_provider = profile.preferred_llm_provider if profile else None

        initial_state = {
            "user_id": user_id,
            "agent_run_id": run_id,
            "thread_id": thread_id,
            "scrape_config": scrape_config or {
                "search_query": "software engineer",
                "location": "Remote",
                "results_wanted": 20,
            },
            "llm_provider": llm_provider,
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

        config = {"configurable": {"thread_id": thread_id}}

        # Run until first interrupt (scrape + score)
        result = await agent_graph.ainvoke(initial_state, config=config)

        jobs_scraped = result.get("jobs_scraped", 0)
        jobs_scored = result.get("jobs_scored", 0)
        current_step = result.get("current_step", "")

        await _publish_event(user_id, {
            "type": "score_complete",
            "jobs_scraped": jobs_scraped,
            "jobs_scored": jobs_scored,
        })

        # Determine status
        is_paused = current_step.startswith("awaiting")
        final_status = AgentRunStatus.paused if is_paused else AgentRunStatus.completed

        if is_paused:
            await _publish_event(user_id, {
                "type": "paused",
                "reason": current_step,
                "jobs_scored": jobs_scored,
            })

        async with AsyncSessionLocal() as db:
            db_run = await db.get(AgentRun, uuid.UUID(run_id))
            if db_run:
                db_run.status = final_status
                db_run.jobs_scraped = jobs_scraped
                db_run.jobs_scored = jobs_scored
                db_run.applications_submitted = result.get("applications_submitted_count", 0)
                db_run.current_step = current_step
                db_run.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
                await db.commit()

        return result

    except Exception as e:
        await _publish_event(user_id, {"type": "error", "message": str(e)})
        async with AsyncSessionLocal() as db:
            db_run = await db.get(AgentRun, uuid.UUID(run_id))
            if db_run:
                db_run.status = AgentRunStatus.failed
                db_run.error_message = str(e)
                await db.commit()
        raise


# ─── Standalone tasks ─────────────────────────────────────────────────────────

@celery_app.task(name="agent_tasks.run_scrape_task")
def run_scrape_task(user_id: str, config: dict):
    """Standalone scrape task — scrapes jobs without running the full pipeline."""
    from app.agents.scraper_agent import scraper_node
    state = {"user_id": user_id, "scrape_config": config, "errors": []}
    return _run_async(_scrape_and_publish(user_id, state))


async def _scrape_and_publish(user_id: str, state: dict):
    from app.agents.scraper_agent import scraper_node
    result = await scraper_node(state)
    await _publish_event(user_id, {
        "type": "scrape_complete",
        "jobs_scraped": result.get("jobs_scraped", 0),
    })
    return result


@celery_app.task(name="agent_tasks.run_resume_task")
def run_resume_task(job_id: str, user_id: str):
    """Generate a tailored resume for a single approved job."""
    from app.agents.resume_agent import resume_node
    state = {"user_id": user_id, "approved_job_ids": [job_id], "errors": []}
    return _run_async(resume_node(state))


@celery_app.task(name="agent_tasks.run_submit_task")
def run_submit_task(application_id: str, user_id: str):
    """Submit a single application via Playwright."""
    from app.agents.application_agent import application_node
    state = {"user_id": user_id, "resume_version_ids": [], "errors": []}
    return _run_async(application_node(state))
