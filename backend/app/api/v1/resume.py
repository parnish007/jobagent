"""Resume API routes — base resume, upload, tailored drafts, RL preference collection, DPO training status."""
import io
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.user import User, UserProfile
from app.models.resume import ResumeVersion, ResumePreference
from app.schemas.resume import ResumeVersionRead, ResumeUpdate, ResumePreferenceCreate
from app.api.deps import get_current_user

router = APIRouter(prefix="/resume", tags=["resume"])


# ─── Resume file parsing helpers ─────────────────────────────────────────────

def _extract_pdf_text(contents: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(contents))
    return "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()


def _extract_docx_text(contents: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(contents))
    lines: list[str] = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            lines.append("")
            continue
        style = para.style.name if para.style else ""
        if "Heading 1" in style:
            lines.append(f"# {text}")
        elif "Heading 2" in style:
            lines.append(f"## {text}")
        elif "Heading 3" in style:
            lines.append(f"### {text}")
        else:
            lines.append(text)
    return "\n".join(lines).strip()


# ─── Base resume ──────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    save: bool = Query(False, description="Save extracted text as base resume immediately"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a resume file and extract its text.

    Supported formats:
    - **.md / .txt** — returned as-is
    - **.pdf** — text extracted with pypdf
    - **.docx** — text extracted and converted to Markdown headings

    Pass `?save=true` to automatically store the result as the base resume.
    """
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ("pdf", "docx", "md", "txt"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Accepted: .pdf, .docx, .md, .txt",
        )

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5 MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5 MB.")

    if ext in ("md", "txt"):
        text = contents.decode("utf-8", errors="replace")
    elif ext == "pdf":
        try:
            text = _extract_pdf_text(contents)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not parse PDF: {exc}") from exc
    else:  # docx
        try:
            text = _extract_docx_text(contents)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not parse DOCX: {exc}") from exc

    if save:
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
        profile = result.scalar_one_or_none()
        if not profile:
            profile = UserProfile(user_id=current_user.id)
            db.add(profile)
        profile.base_resume_text = text
        await db.commit()

    return {"content": text, "filename": filename, "saved": save}


@router.get("", response_model=dict)
async def get_base_resume(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's base resume template."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    return {"content": profile.base_resume_text if profile else ""}


@router.put("")
async def update_base_resume(
    payload: ResumeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the user's base resume template used for all generation."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        # Auto-create profile if missing
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    profile.base_resume_text = payload.content
    await db.commit()
    return {"message": "Resume updated"}


# ─── Tailored drafts ─────────────────────────────────────────────────────────

@router.get("/versions")
async def list_resume_versions(
    job_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all resume versions, optionally filtered by job_id."""
    query = select(ResumeVersion).where(ResumeVersion.user_id == current_user.id)
    if job_id:
        query = query.where(ResumeVersion.scored_job_id == job_id)
    query = query.order_by(ResumeVersion.created_at.desc()).limit(50)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{job_id}/draft", response_model=ResumeVersionRead)
async def get_resume_draft(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the latest tailored resume for a specific job."""
    result = await db.execute(
        select(ResumeVersion)
        .where(
            ResumeVersion.user_id == current_user.id,
            ResumeVersion.scored_job_id == job_id,
        )
        .order_by(ResumeVersion.version_number.desc())
    )
    draft = result.scalars().first()
    if not draft:
        raise HTTPException(status_code=404, detail="No resume draft found for this job. Generate one first.")
    return draft


@router.post("/{job_id}/generate")
async def generate_resume(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    """Trigger tailored resume generation for a specific approved job."""
    from app.tasks.agent_tasks import run_resume_task
    task = run_resume_task.delay(str(job_id), str(current_user.id))
    return {"task_id": task.id, "message": "Resume generation started"}


@router.put("/{version_id}/content")
async def update_resume_version(
    version_id: uuid.UUID,
    payload: ResumeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the content of a resume version (user editing).
    Marks the version as user_edited=True and triggers an 'edit' preference signal.
    """
    result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == version_id,
            ResumeVersion.user_id == current_user.id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Resume version not found")

    original_content = version.content
    version.content = payload.content
    version.user_edited = True
    await db.commit()

    # Auto-record an edit preference signal: edited version is "chosen" over original
    # We create a new version for the original content to pair against
    if original_content != payload.content:
        from app.rl.preference_collector import collect_preference_pair
        # Save original as a new version for tracking
        original_version = ResumeVersion(
            id=uuid.uuid4(),
            user_id=current_user.id,
            scored_job_id=version.scored_job_id,
            content=original_content,
            version_number=version.version_number,
            user_edited=False,
            generation_prompt=version.generation_prompt,
        )
        db.add(original_version)
        await db.flush()
        await collect_preference_pair(
            user_id=str(current_user.id),
            chosen_version_id=str(version_id),
            rejected_version_id=str(original_version.id),
            signal_type="edit",
        )
        await db.commit()

    return {"message": "Resume updated", "user_edited": True}


# ─── RL preference recording ─────────────────────────────────────────────────

@router.post("/preference")
async def record_preference(
    payload: ResumePreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Record an explicit (chosen, rejected) resume preference pair for DPO training.

    Use this when showing the user two versions of a resume and asking which is better.
    Signal types: explicit_rating | edit | outcome
    """
    # Verify both versions belong to this user
    for version_id in [payload.chosen_version_id, payload.rejected_version_id]:
        result = await db.execute(
            select(ResumeVersion).where(
                ResumeVersion.id == version_id,
                ResumeVersion.user_id == current_user.id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Resume version {version_id} not found")

    pref = ResumePreference(
        id=uuid.uuid4(),
        user_id=current_user.id,
        chosen_version_id=payload.chosen_version_id,
        rejected_version_id=payload.rejected_version_id,
        signal_type=payload.signal_type,
    )
    db.add(pref)
    await db.commit()
    return {"message": "Preference recorded. Thank you for the feedback!"}


# ─── RL training status ───────────────────────────────────────────────────────

@router.get("/rl/status")
async def rl_training_status(
    current_user: User = Depends(get_current_user),
):
    """
    Return RL training readiness status.
    Shows how many preference pairs are collected and whether training can begin.
    """
    from app.rl.preference_collector import get_preference_count
    from app.rl.dpo_trainer import get_fine_tuned_model_path

    count = await get_preference_count(str(current_user.id))
    min_pairs = 50
    model_path = get_fine_tuned_model_path(str(current_user.id))

    return {
        "preference_pairs_collected": count,
        "min_pairs_for_training": min_pairs,
        "ready_to_train": count >= min_pairs,
        "model_trained": model_path is not None,
        "model_path": str(model_path) if model_path else None,
        "progress_pct": min(100, round((count / min_pairs) * 100)),
    }


@router.post("/rl/train")
async def trigger_dpo_training(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    Trigger DPO fine-tuning in the background.
    Requires at least 50 preference pairs. Training runs asynchronously.
    """
    from app.rl.preference_collector import get_preference_count

    count = await get_preference_count(str(current_user.id))
    if count < 50:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 50 preference pairs to train. You have {count}. Keep rating resumes!",
        )

    async def _run_training():
        from app.rl.dpo_trainer import train_dpo
        result = await train_dpo(str(current_user.id))
        import logging
        logging.getLogger(__name__).info(f"DPO training result for {current_user.id}: {result}")

    background_tasks.add_task(_run_training)
    return {
        "message": "DPO training started in the background",
        "pairs_available": count,
    }
