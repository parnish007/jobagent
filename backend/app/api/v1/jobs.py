import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.job import ScoredJob, JobStatus
from app.schemas.job import ScoredJobRead, ScrapeRequest, JobActionRequest, JOB_PRESETS
from app.api.deps import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[ScoredJobRead])
async def list_jobs(
    status: str = Query("pending_review", description="Filter by status: pending_review | approved | rejected | applied"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    min_score: float = Query(0, ge=0, le=100, description="Minimum match score filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List scored jobs for the current user, filtered by status and optional score threshold."""
    query = (
        select(ScoredJob)
        .options(selectinload(ScoredJob.raw_job))
        .where(
            ScoredJob.user_id == current_user.id,
            ScoredJob.status == status,
        )
        .order_by(ScoredJob.score.desc())
        .limit(limit)
        .offset(offset)
    )
    if min_score > 0:
        query = query.where(ScoredJob.score >= min_score)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/presets")
async def list_presets():
    """Return all available job type presets with their descriptions."""
    return {
        key: {
            "name": key.replace("_", " ").title(),
            **vals,
        }
        for key, vals in JOB_PRESETS.items()
    }


@router.get("/{job_id}", response_model=ScoredJobRead)
async def get_job(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single scored job by ID, including the raw job details."""
    result = await db.execute(
        select(ScoredJob)
        .options(selectinload(ScoredJob.raw_job))
        .where(ScoredJob.id == job_id, ScoredJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/approve")
async def approve_job(
    job_id: uuid.UUID,
    payload: JobActionRequest = JobActionRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a job for resume generation and application."""
    job = await _get_scored_job(job_id, current_user.id, db)
    job.status = JobStatus.approved
    await db.commit()
    return {"message": "Job approved", "job_id": str(job_id)}


@router.post("/{job_id}/reject")
async def reject_job(
    job_id: uuid.UUID,
    payload: JobActionRequest = JobActionRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a job — it will not be processed further."""
    job = await _get_scored_job(job_id, current_user.id, db)
    job.status = JobStatus.rejected
    await db.commit()
    return {"message": "Job rejected", "job_id": str(job_id)}


@router.post("/scrape")
async def trigger_scrape(
    payload: ScrapeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    Trigger a job scrape with the given search parameters.
    Supports presets: internship, entry_level, senior, remote, contract, part_time.
    """
    from app.tasks.agent_tasks import run_scrape_task
    resolved = payload.resolved()
    task = run_scrape_task.delay(str(current_user.id), resolved)
    return {
        "task_id": task.id,
        "message": "Scrape started",
        "config": resolved,
    }


async def _get_scored_job(job_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> ScoredJob:
    result = await db.execute(
        select(ScoredJob).where(ScoredJob.id == job_id, ScoredJob.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
