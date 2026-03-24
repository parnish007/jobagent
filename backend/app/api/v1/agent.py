"""Agent API routes — status polling, run trigger, and real-time WebSocket updates."""
import json
import uuid
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserProfile
from app.models.agent import AgentRun
from app.api.deps import get_current_user
from app.schemas.job import ScrapeRequest

router = APIRouter(prefix="/agent", tags=["agent"])


# ─── Status ───────────────────────────────────────────────────────────────────

@router.get("/status")
async def agent_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent agent run status for the current user."""
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.user_id == current_user.id)
        .order_by(AgentRun.created_at.desc())
        .limit(1)
    )
    run = result.scalar_one_or_none()
    if not run:
        return {"status": "idle", "last_run": None}
    return {
        "status": run.status,
        "current_step": run.current_step,
        "jobs_scraped": run.jobs_scraped,
        "jobs_scored": run.jobs_scored,
        "applications_submitted": run.applications_submitted,
        "last_run": run.created_at,
        "error_message": run.error_message,
    }


# ─── Run ─────────────────────────────────────────────────────────────────────

@router.post("/run")
async def trigger_agent_run(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger the full agent pipeline using the user's default search config.
    The agent will: scrape → score → [human gate] → generate resumes → [human gate] → submit.
    """
    from app.tasks.agent_tasks import run_full_agent

    # Load user's default search config from profile
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    scrape_config = {
        "search_query": (profile.default_search_query if profile else None) or "software engineer",
        "location": (profile.default_search_location if profile else None) or "Remote",
        "sites": (profile.default_search_sites if profile else None) or ["linkedin", "indeed"],
        "results_wanted": (profile.default_results_wanted if profile else None) or 20,
        "job_type": profile.default_job_type if profile else None,
    }

    task = run_full_agent.delay(str(current_user.id), scrape_config)
    return {
        "task_id": task.id,
        "message": "Agent run started",
        "scrape_config": scrape_config,
    }


@router.post("/run/custom")
async def trigger_custom_run(
    payload: ScrapeRequest,
    current_user: User = Depends(get_current_user),
):
    """Trigger an agent run with a custom search config (overrides profile defaults)."""
    from app.tasks.agent_tasks import run_full_agent
    resolved = payload.resolved()
    task = run_full_agent.delay(str(current_user.id), resolved)
    return {
        "task_id": task.id,
        "message": "Agent run started with custom config",
        "scrape_config": resolved,
    }


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/{user_id}")
async def websocket_agent_status(websocket: WebSocket, user_id: str):
    """
    Real-time agent status updates via WebSocket + Redis pub/sub.

    The client connects here. The server subscribes to the Redis channel
    `agent:events:{user_id}` and forwards all published messages to the client.

    Message format (JSON):
        { "type": "status_update", "status": "running", "current_step": "scoring", ... }
        { "type": "job_scraped",  "count": 5 }
        { "type": "score_complete", "scored": 12 }
        { "type": "paused",       "reason": "awaiting_job_review" }
        { "type": "complete",     "jobs_scraped": 15, "applications": 3 }
        { "type": "error",        "message": "..." }
    """
    await websocket.accept()
    channel = f"agent:events:{user_id}"

    try:
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(channel)

        # Send initial connection ack
        await websocket.send_json({"type": "connected", "channel": channel})

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    await websocket.send_json(data)
                except (json.JSONDecodeError, Exception):
                    pass  # Ignore malformed messages

    except WebSocketDisconnect:
        pass
    except ImportError:
        # Fallback: poll agent status every 3 seconds if redis.asyncio not available
        import asyncio
        from app.core.database import AsyncSessionLocal
        while True:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(AgentRun)
                        .where(AgentRun.user_id == uuid.UUID(user_id))
                        .order_by(AgentRun.created_at.desc())
                        .limit(1)
                    )
                    run = result.scalar_one_or_none()
                    if run:
                        await websocket.send_json({
                            "type": "status_update",
                            "status": run.status,
                            "current_step": run.current_step,
                            "jobs_scraped": run.jobs_scraped,
                            "jobs_scored": run.jobs_scored,
                            "applications_submitted": run.applications_submitted,
                        })
                await asyncio.sleep(3)
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await redis_client.aclose()
        except Exception:
            pass
