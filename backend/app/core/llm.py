"""
LLM provider abstraction — supports Claude (Anthropic) and Gemini (Google).

Usage:
    from app.core.llm import get_llm_response

    text = await get_llm_response(
        prompt="Your prompt here",
        provider="claude",          # or "gemini" — defaults to settings.DEFAULT_LLM_PROVIDER
        max_tokens=1024,
        json_mode=False,
    )
"""
from __future__ import annotations

import json
from typing import Optional

from app.core.config import settings


# ─── Provider constants ───────────────────────────────────────────────────────

PROVIDER_CLAUDE = "claude"
PROVIDER_GEMINI = "gemini"

SUPPORTED_PROVIDERS = [PROVIDER_CLAUDE, PROVIDER_GEMINI]


class LLMError(Exception):
    """Raised when an LLM call fails after retries."""


# ─── Core function ───────────────────────────────────────────────────────────

async def get_llm_response(
    prompt: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = 1024,
    system_prompt: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    """
    Call the specified LLM provider and return the response text.

    Args:
        prompt: The user message / prompt.
        provider: "claude" or "gemini". Defaults to settings.DEFAULT_LLM_PROVIDER.
        model: Specific model override. Defaults to provider's default model.
        max_tokens: Maximum tokens to generate.
        system_prompt: Optional system-level instructions.
        json_mode: If True, appends a JSON-only instruction and validates the output.

    Returns:
        str: The model's text response (or validated JSON string if json_mode=True).

    Raises:
        LLMError: If the call fails or the provider is unsupported.
    """
    provider = provider or settings.DEFAULT_LLM_PROVIDER

    if json_mode:
        prompt = prompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation."

    if provider == PROVIDER_CLAUDE:
        return await _call_claude(prompt, model, max_tokens, system_prompt)
    elif provider == PROVIDER_GEMINI:
        return await _call_gemini(prompt, model, max_tokens, system_prompt)
    else:
        raise LLMError(f"Unsupported LLM provider: '{provider}'. Use one of: {SUPPORTED_PROVIDERS}")


# ─── Claude ──────────────────────────────────────────────────────────────────

async def _call_claude(
    prompt: str,
    model: Optional[str],
    max_tokens: int,
    system_prompt: Optional[str],
) -> str:
    try:
        import anthropic
    except ImportError:
        raise LLMError("anthropic package not installed. Run: pip install anthropic")

    if not settings.ANTHROPIC_API_KEY:
        raise LLMError("ANTHROPIC_API_KEY is not set in environment.")

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    kwargs: dict = {
        "model": model or settings.DEFAULT_CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system_prompt:
        kwargs["system"] = system_prompt

    try:
        message = await client.messages.create(**kwargs)
        return message.content[0].text
    except Exception as e:
        raise LLMError(f"Claude API error: {e}") from e


# ─── Gemini ──────────────────────────────────────────────────────────────────

async def _call_gemini(
    prompt: str,
    model: Optional[str],
    max_tokens: int,
    system_prompt: Optional[str],
) -> str:
    try:
        import google.generativeai as genai  # type: ignore
    except ImportError:
        raise LLMError("google-generativeai package not installed. Run: pip install google-generativeai")

    if not settings.GEMINI_API_KEY:
        raise LLMError("GEMINI_API_KEY is not set in environment.")

    genai.configure(api_key=settings.GEMINI_API_KEY)

    generation_config = genai.GenerationConfig(max_output_tokens=max_tokens)

    model_name = model or settings.DEFAULT_GEMINI_MODEL
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

    try:
        gemini_model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=generation_config,
        )
        response = await gemini_model.generate_content_async(full_prompt)
        return response.text
    except Exception as e:
        raise LLMError(f"Gemini API error: {e}") from e


# ─── JSON helper ─────────────────────────────────────────────────────────────

async def get_llm_json(
    prompt: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = 1024,
    system_prompt: Optional[str] = None,
) -> dict:
    """
    Call the LLM and parse the response as JSON.

    Raises:
        LLMError: If JSON parsing fails.
    """
    text = await get_llm_response(
        prompt=prompt,
        provider=provider,
        model=model,
        max_tokens=max_tokens,
        system_prompt=system_prompt,
        json_mode=True,
    )
    # Strip markdown code fences if present
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise LLMError(f"LLM returned invalid JSON: {e}\nRaw response: {text[:500]}") from e
