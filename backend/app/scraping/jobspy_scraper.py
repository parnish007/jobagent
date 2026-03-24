"""JobSpy-based scraper for LinkedIn, Indeed, Glassdoor, ZipRecruiter."""
import asyncio
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def scrape_jobs(
    search_query: str,
    location: str = "Remote",
    sites: list[str] | None = None,
    results_wanted: int = 20,
) -> list[dict[str, Any]]:
    """Scrape jobs using JobSpy across multiple boards."""
    if sites is None:
        sites = ["linkedin", "indeed", "glassdoor", "zip_recruiter"]

    # JobSpy is synchronous — run in thread pool
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(
        None,
        lambda: _sync_scrape(search_query, location, sites, results_wanted),
    )
    return results


def _sync_scrape(
    search_query: str,
    location: str,
    sites: list[str],
    results_wanted: int,
) -> list[dict[str, Any]]:
    try:
        from jobspy import scrape_jobs as jobspy_scrape
        import pandas as pd

        df = jobspy_scrape(
            site_name=sites,
            search_term=search_query,
            location=location,
            results_wanted=results_wanted,
            hours_old=72,  # Last 3 days only
            country_indeed="USA",
        )

        if df is None or df.empty:
            return []

        jobs = []
        for _, row in df.iterrows():
            job = {
                "source": str(row.get("site", "unknown")).lower(),
                "url": str(row.get("job_url", "")),
                "title": str(row.get("title", "")),
                "company": str(row.get("company", "")),
                "location": str(row.get("location", "")),
                "description": str(row.get("description", "")) if pd.notna(row.get("description")) else None,
                "salary_min": float(row["min_amount"]) if pd.notna(row.get("min_amount")) else None,
                "salary_max": float(row["max_amount"]) if pd.notna(row.get("max_amount")) else None,
                "salary_currency": str(row.get("currency", "USD")),
                "employment_type": str(row.get("job_type", "")) if pd.notna(row.get("job_type")) else None,
                "remote": bool(row.get("is_remote", False)),
                "posted_date": str(row.get("date_posted", "")) if pd.notna(row.get("date_posted")) else None,
            }
            # Skip jobs without URL or title
            if job["url"] and job["title"] and job["url"] != "nan":
                jobs.append(job)

        return jobs

    except Exception as e:
        raise RuntimeError(f"JobSpy scrape failed: {e}") from e
