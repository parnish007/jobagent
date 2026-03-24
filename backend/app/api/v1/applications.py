import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.application import Application, ApplicationOutcome, ApplicationStatus
from app.schemas.application import ApplicationRead, ApplicationOutcomeCreate
from app.api.deps import get_current_user

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("", response_model=list[ApplicationRead])
async def list_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application)
        .where(Application.user_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{application_id}/submit")
async def submit_application(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    app = await _get_application(application_id, current_user.id, db)
    if app.status not in (ApplicationStatus.draft, ApplicationStatus.resume_ready):
        raise HTTPException(status_code=400, detail="Application cannot be submitted in current state")

    from app.tasks.agent_tasks import run_submit_task
    task = run_submit_task.delay(str(application_id), str(current_user.id))
    return {"task_id": task.id, "message": "Application submission started"}


@router.post("/{application_id}/outcome")
async def record_outcome(
    application_id: uuid.UUID,
    payload: ApplicationOutcomeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    app = await _get_application(application_id, current_user.id, db)
    outcome = ApplicationOutcome(
        application_id=app.id,
        outcome=payload.outcome,
        response_text=payload.response_text,
        days_to_response=payload.days_to_response,
    )
    db.add(outcome)
    app.status = ApplicationStatus.responded
    await db.commit()
    return {"message": "Outcome recorded"}


async def _get_application(app_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Application:
    result = await db.execute(
        select(Application).where(Application.id == app_id, Application.user_id == user_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app
