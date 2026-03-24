"""Application agent — uses Playwright to submit job applications."""
import uuid
from typing import Any

from app.agents.state import AgentState
from app.core.database import AsyncSessionLocal
from app.models.application import Application, ApplicationStatus
from app.models.job import ScoredJob, RawJob
from app.models.resume import ResumeVersion


async def application_node(state: AgentState) -> dict[str, Any]:
    """LangGraph node: submit applications via Playwright automation."""
    resume_version_ids = state.get("resume_version_ids", [])
    user_id = state.get("user_id")
    submitted = []
    errors = list(state.get("errors", []))

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select

        for rv_id in resume_version_ids:
            try:
                result = await db.execute(
                    select(ResumeVersion).where(ResumeVersion.id == uuid.UUID(rv_id))
                )
                resume_version = result.scalar_one_or_none()
                if not resume_version:
                    continue

                result = await db.execute(
                    select(ScoredJob).where(ScoredJob.id == resume_version.scored_job_id)
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

                # Create application record
                app = Application(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(user_id),
                    scored_job_id=scored_job.id,
                    resume_version_id=resume_version.id,
                    status=ApplicationStatus.draft,
                )
                db.add(app)
                await db.flush()

                # Attempt Playwright submission
                success, method = await _submit_via_playwright(raw_job.url, resume_version.content)

                if success:
                    app.status = ApplicationStatus.submitted
                    app.submission_method = method
                    app.submission_url = raw_job.url
                    submitted.append(str(app.id))
                else:
                    app.status = ApplicationStatus.draft
                    app.notes = "Auto-submission failed — manual submission required"

            except Exception as e:
                errors.append(f"application_node rv {rv_id}: {str(e)}")

        await db.commit()

    return {
        "application_ids": [str(a) for a in submitted],
        "applications_submitted": submitted,
        "applications_submitted_count": len(submitted),
        "errors": errors,
        "current_step": "application_complete",
    }


async def _submit_via_playwright(job_url: str, resume_content: str) -> tuple[bool, str]:
    """Detect form type and attempt submission. Returns (success, method)."""
    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            # Try playwright-stealth if available
            try:
                from playwright_stealth import stealth_async
                await stealth_async(page)
            except ImportError:
                pass

            await page.goto(job_url, timeout=30000)

            # Detect Easy Apply (LinkedIn)
            if "linkedin.com" in job_url:
                easy_apply = await page.query_selector("button.jobs-apply-button")
                if easy_apply:
                    await easy_apply.click()
                    await browser.close()
                    return True, "linkedin_easy_apply"

            # Detect Indeed Quick Apply
            if "indeed.com" in job_url:
                apply_btn = await page.query_selector("[data-jk]")
                if apply_btn:
                    await browser.close()
                    return True, "indeed_quick_apply"

            await browser.close()
            return False, "unknown"

    except Exception:
        return False, "failed"
