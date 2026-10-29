"""Thin wrapper around the google-genai SDK. No key → MOCK mode (callers fall back)."""
from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Optional, TypeVar

from pydantic import BaseModel

log = logging.getLogger("lumi.llm")
PROMPTS = Path(__file__).resolve().parent.parent / "prompts"
T = TypeVar("T", bound=BaseModel)

_client = None


def prompt(name: str, **kwargs) -> str:
    text = (PROMPTS / f"{name}.txt").read_text(encoding="utf-8")
    return text.format(**kwargs) if kwargs else text


def enabled() -> bool:
    """Gemini is used only with a key AND MOCK_MODE unset. MOCK_MODE=1 forces the deterministic
    mock (sample worksheets + templates + keyword rules) for offline demos and rehearsals."""
    if os.getenv("MOCK_MODE", "").strip().lower() in ("1", "true", "yes", "on"):
        return False
    return bool(os.getenv("GEMINI_API_KEY"))


def model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def _get_client():
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def default_timeout() -> float:
    return float(os.getenv("GEMINI_TIMEOUT", "25"))


async def generate_ex(
    schema: type[T],
    text: str,
    image: Optional[bytes] = None,
    mime_type: str = "image/jpeg",
    system: Optional[str] = None,
    temperature: float = 0.2,
    thinking: Optional[str] = "low",
    timeout: Optional[float] = None,
    label: str = "call",
) -> tuple[Optional[T], Optional[str]]:
    """Structured JSON generation. Returns (result, error) where error is
    None | "timeout" | "quota" | "error", so callers can fall back without hanging."""
    if not enabled():
        return None, "disabled"
    from google.genai import types

    contents: list = []
    if image is not None:
        contents.append(types.Part.from_bytes(data=image, mime_type=mime_type))
    contents.append(text)
    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
    )
    if thinking:  # "minimal" | "low" | "medium" | "high"; None = model default
        config.thinking_config = types.ThinkingConfig(thinking_level=thinking.upper())
    limit = timeout or default_timeout()
    start = time.perf_counter()
    try:
        resp = await asyncio.wait_for(
            _get_client().aio.models.generate_content(model=model_name(), contents=contents, config=config),
            timeout=limit,
        )
        usage = resp.usage_metadata
        log.info(
            "gemini %-10s %5.1fs  thinking=%s  in=%s out=%s thoughts=%s",
            label, time.perf_counter() - start, thinking,
            getattr(usage, "prompt_token_count", "?"), getattr(usage, "candidates_token_count", "?"),
            getattr(usage, "thoughts_token_count", "?"),
        )
        if isinstance(resp.parsed, schema):
            return resp.parsed, None
        return schema.model_validate_json(resp.text), None
    except asyncio.TimeoutError:
        log.warning("gemini %s timed out after %.0fs", label, limit)
        return None, "timeout"
    except Exception as exc:  # network, quota, schema...
        quota = "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc)
        log.warning("gemini %s failed after %.1fs: %s", label, time.perf_counter() - start, exc)
        return None, "quota" if quota else "error"


async def generate(schema: type[T], text: str, **kwargs) -> Optional[T]:
    """Like generate_ex, but returns None on any failure."""
    return (await generate_ex(schema, text, **kwargs))[0]
