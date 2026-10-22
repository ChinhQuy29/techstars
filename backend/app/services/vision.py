"""Vision LLM: extraction (problems, answers, bboxes, confidence) + error-step finding.

The LLM only READS. SymPy (math_check) decides correctness.
MOCK mode (no GEMINI_API_KEY): uploads that byte-match a file in test-worksheets/ return that
file's JSON sidecar; anything else cycles through the samples so the demo flow still works.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Optional

from ..schemas import ErrorAnalysis, VisionExtraction
from . import llm

SAMPLES_DIR = Path(os.getenv("SAMPLES_DIR") or Path(__file__).resolve().parents[3] / "test-worksheets")


def _samples() -> list[tuple[str, Path, Path]]:
    out = []
    for img in sorted(SAMPLES_DIR.glob("*.png")) + sorted(SAMPLES_DIR.glob("*.jpg")):
        sidecar = img.with_suffix(".json")
        if sidecar.exists():
            out.append((hashlib.sha256(img.read_bytes()).hexdigest(), img, sidecar))
    return out


def mock_extract(image: bytes, grade_count: int) -> VisionExtraction:
    samples = _samples()
    if not samples:
        return VisionExtraction(unreadable=True)
    digest = hashlib.sha256(image).hexdigest()
    match = next((s for s in samples if s[0] == digest), None)
    if match is None:  # live camera frame in mock mode: walk through the samples in order
        match = samples[min(grade_count, len(samples) - 1)]
    data = json.loads(match[2].read_text(encoding="utf-8"))
    return VisionExtraction.model_validate(data["extraction"])


async def extract(image: bytes, mime_type: str, grade_count: int) -> tuple[VisionExtraction, bool, Optional[str]]:
    """Returns (extraction, is_mock, llm_error). llm_error is "timeout" | "quota" | "error" | None."""
    if not llm.enabled():
        return mock_extract(image, grade_count), True, None
    result, err = await llm.generate_ex(
        VisionExtraction, llm.prompt("extract"), image=image, mime_type=mime_type,
        thinking=os.getenv("GEMINI_VISION_THINKING", "low") or None, label="extract",
    )
    if result is None:
        return VisionExtraction(), False, err or "error"
    return result, False, None


async def find_error_step(
    image: bytes, mime_type: str, problem: str, child_answer: str, correct_answer: str, bbox: list[int]
) -> Optional[ErrorAnalysis]:
    if not llm.enabled():
        return None
    text = llm.prompt(
        "error_step", problem=problem, child_answer=child_answer, correct_answer=correct_answer, bbox=bbox
    )
    return await llm.generate(ErrorAnalysis, text, image=image, mime_type=mime_type, label="error_step")
