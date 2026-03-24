"""Playwright-based scraper for custom job sites not covered by JobSpy."""
import asyncio
from typing import Any, Optional


async def scrape_custom_site(
    url: str,
    selectors: Optional[dict] = None,
    use_stealth: bool = True,
) -> dict[str, Any]:
    """Scrape a single job posting page using Playwright."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = await context.new_page()

        if use_stealth:
            try:
                from playwright_stealth import stealth_async
                await stealth_async(page)
            except ImportError:
                pass

        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(2)  # Let dynamic content load

            # Extract using provided selectors or auto-detect
            if selectors:
                title = await _safe_text(page, selectors.get("title", "h1"))
                company = await _safe_text(page, selectors.get("company", "[data-company]"))
                description = await _safe_text(page, selectors.get("description", "[data-description]"))
            else:
                # Auto-detect common patterns
                title = await _safe_text(page, "h1") or await _safe_text(page, ".job-title")
                company = (
                    await _safe_text(page, ".company-name")
                    or await _safe_text(page, "[data-company]")
                    or await _safe_text(page, ".employer-name")
                )
                description = (
                    await _safe_text(page, ".job-description")
                    or await _safe_text(page, "#job-description")
                    or await _safe_text(page, "[data-testid='job-description']")
                )

            return {
                "url": url,
                "title": title or "Unknown Title",
                "company": company or "Unknown Company",
                "description": description,
                "source": "custom",
            }

        finally:
            await browser.close()


async def _safe_text(page, selector: str) -> Optional[str]:
    """Safely extract text from a selector, returning None if not found."""
    try:
        element = await page.query_selector(selector)
        if element:
            return (await element.inner_text()).strip()
    except Exception:
        pass
    return None


async def check_application_form(url: str) -> dict[str, Any]:
    """Detect what kind of application form a job URL has."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(url, timeout=30000)

            form_info = {
                "url": url,
                "has_easy_apply": False,
                "has_quick_apply": False,
                "has_custom_form": False,
                "apply_url": None,
            }

            # LinkedIn Easy Apply
            if "linkedin.com" in url:
                btn = await page.query_selector(".jobs-apply-button")
                form_info["has_easy_apply"] = btn is not None

            # Indeed Quick Apply
            elif "indeed.com" in url:
                btn = await page.query_selector("#indeedApplyButton")
                form_info["has_quick_apply"] = btn is not None

            # Generic apply link
            else:
                apply_link = await page.query_selector("a[href*='apply']")
                if apply_link:
                    form_info["apply_url"] = await apply_link.get_attribute("href")
                    form_info["has_custom_form"] = True

            return form_info

        finally:
            await browser.close()
