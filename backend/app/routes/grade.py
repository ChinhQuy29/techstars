"""POST /api/grade — vision LLM reads the page, SymPy grades it."""
from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from ..schemas import GradedProblem, GradeResponse, VisionProblem
from ..services import math_check, vision
from ..services import profile
from ..services.session import get_session
from ..services.tutor import CONFIDENCE_THRESHOLD

router = APIRouter()


async def _grade_one(vp: VisionProblem, image: bytes, mime: str) -> tuple[GradedProblem, str]:
    result = math_check.check(vp.problem, vp.child_answer)
    error_step, tag = None, "add"
    error_bbox = None
    if result.answered and not result.is_correct:
        error_step, tag = math_check.diagnose(vp.problem, vp.child_answer)
        if error_step is None and vp.has_work and result.correct_answer:
            # 2nd LLM call (only when the rules can't explain it), given the SymPy answer.
            analysis = await vision.find_error_step(
                image, mime, vp.problem, vp.child_answer or "", result.correct_answer, vp.bbox
            )
            if analysis and analysis.error_step:
                error_step, error_bbox = analysis.error_step, analysis.error_bbox
        error_bbox = error_bbox or vp.answer_bbox
    graded = GradedProblem(
        id=vp.id,
        problem=math_check.normalize_expression(vp.problem),
        child_answer=vp.child_answer,
        correct_answer=result.correct_answer,
        is_correct=result.is_correct,
        answered=result.answered,
        bbox=vp.bbox,
        answer_bbox=vp.answer_bbox,
        error_step=error_step,
        error_bbox=error_bbox,
        confidence=vp.confidence,
        needs_confirmation=result.answered and vp.confidence < CONFIDENCE_THRESHOLD,
    )
    return graded, tag


@router.post("/grade", response_model=GradeResponse)
async def grade(image: UploadFile = File(...), session_id: Optional[str] = Form(None)) -> GradeResponse:
    session = get_session(session_id)
    data = await image.read()
    mime = image.content_type or "image/jpeg"
    extraction, mock, llm_error = await vision.extract(data, mime, session.grade_count)
    session.grade_count += 1

    if llm_error:  # timeout / quota / API error: keep the previous grade so hints still work
        session.log("llm_error", stage="extract", error=llm_error)
        return GradeResponse(session_id=session.id, llm_error=llm_error, mock=mock)

    if extraction.hand_blocking or extraction.unreadable:
        session.log("capture_rejected", hand_blocking=extraction.hand_blocking, unreadable=extraction.unreadable)
        session.last_grade, session.last_fixed = [], []
        return GradeResponse(session_id=session.id, hand_blocking=extraction.hand_blocking,
                             unreadable=extraction.unreadable, mock=mock)

    results = await asyncio.gather(*(_grade_one(vp, data, mime) for vp in extraction.problems))
    fixed_ids: list[int] = []
    for p, tag in results:
        if p.needs_confirmation or not p.answered or p.correct_answer is None:
            continue
        st = session.state_for(p.problem)
        st.last = p
        if p.is_correct:
            if st.ever_wrong and not st.fixed:
                st.fixed = True
                fixed_ids.append(p.id)
                session.log("fixed", problem=p.problem, attempts=st.attempts)
        else:
            st.attempts += 1
            st.ever_wrong = True
            st.concept = tag
        session.log("graded", problem=p.problem, child_answer=p.child_answer,
                    correct=p.is_correct, error_step=p.error_step)

    graded = [p for p, _ in results]
    session.last_grade, session.last_fixed = graded, fixed_ids
    profile.autosave(session)  # Teach readiness from Help mode (only with consent)
    return GradeResponse(session_id=session.id, problems=graded, fixed_ids=fixed_ids, mock=mock)
