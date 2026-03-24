"""Resume generator agent — creates tailored resumes using the configured LLM provider."""
import uuid
from typing import Any

from app.agents.state import AgentState
from app.core.llm import get_llm_response, LLMError
from app.core.database import AsyncSessionLocal
from app.models.job import ScoredJob, RawJob
from app.models.resume import ResumeVersion
from app.models.user import UserProfile


RESUME_SYSTEM_PROMPT = """You are an expert resume writer with 15 years of experience helping candidates land jobs at top companies.
You tailor resumes to specific roles, emphasizing the most relevant experience and using keywords from job descriptions.
You NEVER fabricate experience — you only reorganize and reframe what is provided."""

RESUME_PROMPT = """Create a tailored resume for this specific job application.

## Candidate's Base Resume
{base_resume}

## Target Job
Title: {title}
Company: {company}
Location: {location}
Description:
{description}

## Skills the Candidate Has That Match This Role
{matched_skills}

## Instructions
1. Rewrite the resume to prioritize experiences most relevant to this specific role
2. Naturally incorporate keywords from the job description
3. Adjust the professional summary to directly address this role and company
4. Keep ALL factual content accurate — do NOT invent new experiences or skills
5. Format in clean Markdown with clear sections
6. Sections to include: Contact Info (placeholder), Professional Summary, Work Experience, Skills, Education
7. Keep it to one page equivalent (roughly 400-600 words of content)

Return ONLY the resume in Markdown format — no introduction, no commentary."""


async def resume_node(state: AgentState) -> dict[str, Any]:
    """LangGraph node: generate tailored resumes for approved jobs."""
    approved_job_ids = state.get("approved_job_ids", [])
    user_id = state.get("user_id")
    resume_version_ids = []
    errors = list(state.get("errors", []))

    if not approved_job_ids:
        return {"resume_version_ids": [], "resumes_generated": 0, "current_step": "resume_gen_complete"}

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select

        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id))
        )
        profile = result.scalar_one_or_none()
        base_resume = profile.base_resume_text if profile else ""
        provider = (profile.preferred_llm_provider if profile else None) or state.get("llm_provider")

        if not base_resume:
            errors.append("resume_node: No base resume set in profile. Please add your base resume in Settings.")
            return {
                "resume_version_ids": [],
                "resumes_generated": 0,
                "errors": errors,
                "current_step": "resume_gen_complete",
            }

        for job_id in approved_job_ids:
            try:
                result = await db.execute(
                    select(ScoredJob).where(ScoredJob.id == uuid.UUID(job_id))
                )
                scored_job = result.scalar_one_or_none()
                if not scored_job:
                    continue

                result = await db.execute(
                    select(RawJob).where(RawJob.id == scored_job.raw_job_id)
                )
                raw_job = result.scalar_one_or_none()
                if not raw_job:
                    continue

                # Check if a resume already exists for this job (avoid duplicates)
                from sqlalchemy import select as sa_select
                existing = await db.execute(
                    sa_select(ResumeVersion).where(
                        ResumeVersion.user_id == uuid.UUID(user_id),
                        ResumeVersion.scored_job_id == scored_job.id,
                    )
                )
                existing_version = existing.scalar_one_or_none()
                version_number = (existing_version.version_number + 1) if existing_version else 1

                generation_prompt = RESUME_PROMPT.format(
                    base_resume=base_resume,
                    title=raw_job.title,
                    company=raw_job.company,
                    location=raw_job.location or "Not specified",
                    description=(raw_job.description or "")[:3000],
                    matched_skills=", ".join(scored_job.matched_skills or []) or "None identified",
                )

                resume_content = await get_llm_response(
                    prompt=generation_prompt,
                    provider=provider,
                    system_prompt=RESUME_SYSTEM_PROMPT,
                    max_tokens=2048,
                )

                resume_version = ResumeVersion(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(user_id),
                    scored_job_id=scored_job.id,
                    content=resume_content,
                    generation_prompt=generation_prompt,
                    version_number=version_number,
                )
                db.add(resume_version)
                resume_version_ids.append(str(resume_version.id))

            except LLMError as e:
                errors.append(f"resume LLM error for job {job_id}: {e}")
            except Exception as e:
                errors.append(f"resume_node job {job_id}: {e}")

        await db.commit()

    return {
        "resume_version_ids": resume_version_ids,
        "resumes_generated": len(resume_version_ids),
        "errors": errors,
        "current_step": "resume_gen_complete",
    }
