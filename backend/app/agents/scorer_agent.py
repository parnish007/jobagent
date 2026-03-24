"""Scorer agent — LLM scores each raw job against user profile."""
import uuid
from typing import Any

from app.agents.state import AgentState
from app.core.llm import get_llm_json, LLMError
from app.core.database import AsyncSessionLocal
from app.models.job import RawJob, ScoredJob, JobStatus
from app.models.user import UserProfile


SCORING_SYSTEM_PROMPT = """You are an expert job matching analyst. Evaluate how well a job listing matches a candidate profile."""

SCORING_PROMPT = """Score this job listing against the candidate profile.

## Candidate Profile
{profile}

## Job Listing
Title: {title}
Company: {company}
Location: {location}
Employment Type: {employment_type}
Description:
{description}

## Instructions
Return a JSON object with exactly these fields:
- "score": integer 0-100 (overall match quality)
- "reasoning": string, 1-2 sentences explaining the score
- "matched_skills": array of strings — skills from profile that this job requires
- "missing_skills": array of strings — skills the job requires that the candidate lacks
- "highlights": array of 2-3 strings — top reasons to apply (or empty if score < 40)

Scoring guide:
- 90-100: Nearly perfect match — all required skills present, ideal role/level
- 75-89: Strong match — most skills present, minor gaps
- 55-74: Moderate match — some gaps but could grow into the role
- 40-54: Weak match — significant skill gaps or wrong level/location
- 0-39: Poor match — fundamentally misaligned

Only return valid JSON, no markdown."""


async def scorer_node(state: AgentState) -> dict[str, Any]:
    """LangGraph node: score raw jobs against user profile using the configured LLM provider."""
    raw_job_ids = state.get("raw_job_ids", [])
    user_id = state.get("user_id")
    scored_ids = []
    errors = list(state.get("errors", []))

    if not raw_job_ids:
        return {"scored_job_ids": [], "jobs_scored": 0, "current_step": "scoring_complete"}

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select

        # Load user profile to get their preferred LLM provider
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id))
        )
        profile = result.scalar_one_or_none()
        profile_text = _format_profile(profile) if profile else "No profile set"
        provider = (profile.preferred_llm_provider if profile else None) or state.get("llm_provider")

        # Score each job
        for raw_job_id in raw_job_ids:
            try:
                result = await db.execute(
                    select(RawJob).where(RawJob.id == uuid.UUID(raw_job_id))
                )
                raw_job = result.scalar_one_or_none()
                if not raw_job:
                    continue

                prompt = SCORING_PROMPT.format(
                    profile=profile_text,
                    title=raw_job.title,
                    company=raw_job.company,
                    location=raw_job.location or "Not specified",
                    employment_type=raw_job.employment_type or "Not specified",
                    description=(raw_job.description or "")[:3000],
                )

                score_data = await get_llm_json(
                    prompt=prompt,
                    provider=provider,
                    system_prompt=SCORING_SYSTEM_PROMPT,
                    max_tokens=512,
                )

                scored_job = ScoredJob(
                    id=uuid.uuid4(),
                    raw_job_id=raw_job.id,
                    user_id=uuid.UUID(user_id),
                    score=float(score_data.get("score", 0)),
                    score_reasoning=score_data.get("reasoning"),
                    matched_skills=score_data.get("matched_skills", []),
                    missing_skills=score_data.get("missing_skills", []),
                    status=JobStatus.pending_review,
                )
                db.add(scored_job)
                scored_ids.append(str(scored_job.id))

            except LLMError as e:
                errors.append(f"scorer LLM error for job {raw_job_id}: {e}")
            except Exception as e:
                errors.append(f"scorer_node job {raw_job_id}: {e}")

        await db.commit()

    return {
        "scored_job_ids": scored_ids,
        "jobs_scored": len(scored_ids),
        "errors": errors,
        "current_step": "scoring_complete",
    }


def _format_profile(profile: UserProfile) -> str:
    parts = []
    if profile.skills:
        parts.append(f"Skills: {', '.join(profile.skills)}")
    if profile.years_experience:
        parts.append(f"Years of experience: {profile.years_experience}")
    if profile.target_titles:
        parts.append(f"Target titles: {', '.join(profile.target_titles)}")
    if profile.target_locations:
        parts.append(f"Target locations: {', '.join(profile.target_locations)}")
    parts.append(f"Remote preferred: {profile.remote_only}")
    if profile.salary_min or profile.salary_max:
        parts.append(f"Salary range: ${profile.salary_min or 0:,} – ${profile.salary_max or 'open'}")
    if profile.blacklisted_companies:
        parts.append(f"Do NOT match these companies: {', '.join(profile.blacklisted_companies)}")
    if profile.blacklisted_keywords:
        parts.append(f"Avoid jobs containing: {', '.join(profile.blacklisted_keywords)}")
    return "\n".join(parts) if parts else "No profile configured. Score based on general software engineering criteria."
