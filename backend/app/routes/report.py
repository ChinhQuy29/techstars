"""POST /api/report — parent/teacher summary. Numbers + practice problems computed in Python."""
import random

from fastapi import APIRouter
from pydantic import BaseModel

from ..schemas import (
    PracticeProblem, ReportRequest, ReportResponse, TeachReport, TeachReportConcept, TeachReportQuote,
)
from ..services import llm
from ..services.math_check import CONCEPTS, TEACHABLE, practice_for_concept
from ..services.session import Session, get_session
from ..services.tutor import LANGUAGE_NAMES

router = APIRouter()

FALLBACK = {
    "en": "Your child worked through {total} problems and got {correct} right. They fixed {fixed} after hints, which shows real persistence.",
    "es": "Su hijo resolvió {total} problemas y acertó {correct}. Corrigió {fixed} después de pistas, lo que muestra mucha constancia.",
    "vi": "Con đã làm {total} bài và đúng {correct} bài. Con tự sửa được {fixed} bài sau khi được gợi ý, rất kiên trì.",
}


TEACH_NOTE = {
    "en": "Lumi's mistakes are on purpose. Finding and explaining them helps your child understand math more deeply.",
    "es": "Los errores de Lumi son a propósito. Encontrarlos y explicarlos ayuda a su hijo a entender las matemáticas más a fondo.",
    "vi": "Lumi cố ý làm sai. Tìm và giải thích lỗi sai giúp con hiểu toán sâu hơn.",
}


class _Summary(BaseModel):
    summary: str


def teach_report(s: Session, language: str) -> TeachReport | None:
    """Teach-mode section, built from the event log + Lumi's stars. None if Teach mode wasn't used."""
    checked = [e for e in s.events if e["type"] == "teach_checked"]
    if not checked:
        return None
    outcomes = [o for e in checked for o in e["outcomes"].values()]
    planted = sum(len(e["planted"]) for e in s.events if e["type"] == "teach_worksheet"
                  and any(c["worksheet_id"] == e["worksheet_id"] for c in checked))
    quality = {q: 0 for q in ("concept", "procedure", "vague", "incorrect")}
    for e in s.events:
        if e["type"] == "teach_explained":
            quality[e["quality"]] += 1
    return TeachReport(
        taught=[TeachReportConcept(concept=c, label=CONCEPTS[c], stars=s.lumi_mastery[c])
                for c in TEACHABLE if s.lumi_mastery.get(c, 0) > 0],
        quotes=[TeachReportQuote(concept=c, label=CONCEPTS[c], text=text)
                for c, (_, text) in s.teach_quotes.items()],
        caught=sum(1 for o in outcomes if o in ("caught_fixed", "caught_unfixed")),
        planted=planted,
        missed=sum(1 for o in outcomes if o == "missed"),
        false_alarms=sum(1 for o in outcomes if o == "false_alarm"),
        explanations=quality,
        note=TEACH_NOTE[language],
        demo=any(e.get("demo") for e in s.events if e["type"] == "teach_worksheet"
                 and any(c["worksheet_id"] == e["worksheet_id"] for c in checked)),
    )


@router.post("/report", response_model=ReportResponse)
async def report(req: ReportRequest) -> ReportResponse:
    s = get_session(req.session_id)
    states = [st for st in s.problems.values() if st.last is not None]
    total = len(states)
    correct = sum(1 for st in states if st.last.is_correct)
    fixed = sum(1 for st in states if st.fixed)
    hints = sum(1 for e in s.events if e["type"] == "hint")
    tags = [st.concept for st in states if st.ever_wrong and st.concept]
    concepts = list(dict.fromkeys(CONCEPTS.get(t, t) for t in tags))
    rng = random.Random(s.id)
    practice_tags = (tags or ["add", "sub", "mul"]) * 3
    practice = [PracticeProblem(problem=p, answer=a)
                for p, a in (practice_for_concept(t, rng) for t in practice_tags[:3])]

    summary = None
    if llm.enabled() and total:
        out = await llm.generate(_Summary, llm.prompt(
            "report", language_name=LANGUAGE_NAMES[req.language], correct=correct, total=total,
            fixed=fixed, hints_used=hints, concepts=", ".join(concepts) or "none",
        ), label="report")
        summary = out.summary if out else None
    if summary is None:
        summary = FALLBACK[req.language].format(total=total, correct=correct, fixed=fixed)

    return ReportResponse(
        session_id=s.id, score=round(100 * correct / total) if total else 0, total=total,
        correct=correct, fixed=fixed, hints_used=hints, concepts=concepts,
        practice_problems=practice, summary=summary,
        events=[e for e in s.events if not e["type"].startswith("teach_")][-50:],
        teach=teach_report(s, req.language),
    )
