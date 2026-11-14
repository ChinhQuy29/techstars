"""Developer admin portal (docs/07-testing-and-demo.md): set Lumi's stars, readiness and story choices
directly, and preview any concept problem or story scene, so features can be tested without teaching.

OFF unless the backend runs with LUMI_ADMIN=1 (every endpoint 404s otherwise). Local development only:
never enable it on a deployed server. It changes in-memory test sessions; it can't read saved profiles,
and it saves to one only if that session was already attached to it with consent.
"""
from __future__ import annotations

import os
import random
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..schemas import Language
from ..services import concepts as cx
from ..services import profile, story, teach
from ..services.concepts import ALL_CONCEPTS, NEW_CONCEPTS
from ..services.session import Session, get_session, reset_session

router = APIRouter()

TOWN = ("carry", "borrow", "off_by_one", "mul")
SAMPLE_QUOTE = {
    "carry": "7 plus 8 is 15, so the 1 goes to the tens", "borrow": "the top ones are too small, so borrow a ten",
    "off_by_one": "check it again carefully", "mul": "count exactly the right number of groups",
    "share": "each group gets the same amount", "patterns": "it jumps by the same amount each time",
    "big_numbers": "the digit is in the thousands place", "time": "an hour only has 60 minutes",
    "measure": "it doesn't start at zero", "shapes": "some faces hide at the back",
    "fractions": "more pieces means smaller pieces", "graphs": "you have to compare both bars",
}


def enabled() -> bool:
    return os.getenv("LUMI_ADMIN", "").strip().lower() in ("1", "true", "yes", "on")


def _guard() -> None:
    if not enabled():
        raise HTTPException(404, detail="Not Found")


def _state(s: Session) -> dict:
    ready = teach.ready_concepts(s)
    return {
        "session_id": s.id,
        "profile_attached": s.profile_id is not None,
        "concepts": [{"concept": c, "label": teach.TT["en"]["concepts"][c]["label"], "stars": s.lumi_mastery.get(c, 0.0),
                      "ready": c in ready, "quote": s.teach_quotes.get(c, (None, None))[1],
                      "gate": "warmup" if c in NEW_CONCEPTS else "help"} for c in ALL_CONCEPTS],
        "story": {"started": story.started(s), "current_act": story.current_act(s),
                  "chosen": {str(a): k for a, k in s.story_chosen.items()}, "seen": sorted(s.story_seen),
                  "ending": story.ending_key(s)},
        "acts": {str(a): list(vs) for a, vs in story.ACTS.items()},
    }


def _save(s: Session) -> dict:
    profile.autosave(s)
    return _state(s)


class SessionReq(BaseModel):
    session_id: str


class ConceptPatch(BaseModel):
    concept: str
    stars: Optional[float] = Field(None, ge=0, le=3)
    ready: Optional[bool] = None
    quote: Optional[str] = Field(None, max_length=120)


class PatchReq(BaseModel):
    session_id: str
    concepts: list[ConceptPatch] = []
    story_chosen: Optional[dict[str, Optional[str]]] = None  # {"1": "savings", "2": None, ...}
    clear_seen: bool = False


class PresetReq(BaseModel):
    session_id: str
    preset: Literal["fresh", "town_open", "all_ready", "all_taught", "act2", "act3", "ending"]
    path: Literal["engineer", "musician", "scientist", "pilot"] = "engineer"


class ProblemReq(BaseModel):
    concept: str
    language: Language = "en"
    seed: Optional[int] = None


class SceneReq(BaseModel):
    session_id: str
    language: Language = "en"
    key: str


@router.get("/admin/status")
def status() -> dict:
    _guard()
    return {"enabled": True}


@router.post("/admin/state")
def get_state(req: SessionReq) -> dict:
    _guard()
    return _state(get_session(req.session_id))


@router.post("/admin/patch")
def patch(req: PatchReq) -> dict:
    """Set stars (½ steps), readiness and sample quotes per concept; set or clear story choices."""
    _guard()
    s = get_session(req.session_id)
    for p in req.concepts:
        if p.concept not in ALL_CONCEPTS:
            raise HTTPException(400, detail={"code": "unknown_concept", "message": p.concept})
        if p.stars is not None:
            if p.stars * 2 != int(p.stars * 2):
                raise HTTPException(400, detail={"code": "half_steps", "message": "Stars go in steps of 0.5."})
            s.lumi_mastery[p.concept] = p.stars
        if p.ready is not None:
            target = s.warm_ready if p.concept in NEW_CONCEPTS else s.saved_ready
            (target.add if p.ready else target.discard)(p.concept)
        if p.quote is not None:
            if p.quote.strip():
                s.teach_quotes[p.concept] = ("concept", p.quote.strip())
            else:
                s.teach_quotes.pop(p.concept, None)
    if req.story_chosen is not None:
        chosen: dict[int, str] = {}
        for a, k in req.story_chosen.items():
            act = int(a)
            if act not in story.ACTS:
                raise HTTPException(400, detail={"code": "unknown_act", "message": a})
            if k is not None:
                if k not in story.ACTS[act]:
                    raise HTTPException(400, detail={"code": "wrong_act", "message": f"{k} is not in act {act}"})
                chosen[act] = k
        if any(a > 1 and a - 1 not in chosen for a in chosen):
            raise HTTPException(400, detail={"code": "act_gap", "message": "Choose the earlier acts first."})
        s.story_chosen = chosen
    if req.clear_seen:
        s.story_seen.clear()
    return _save(s)


@router.post("/admin/preset")
def preset(req: PresetReq) -> dict:
    """One-click test states. Every preset starts from a clean slate (and adds sample quotes when it teaches)."""
    _guard()
    s = reset_session(req.session_id)
    if req.preset == "fresh":
        return _save(s)
    if req.preset == "town_open":
        for c in TOWN:
            s.lumi_mastery[c] = 1.0
            s.saved_ready.add(c)
            s.teach_quotes[c] = ("concept", SAMPLE_QUOTE[c])
        return _save(s)
    s.saved_ready |= set(TOWN)
    s.warm_ready |= set(NEW_CONCEPTS)
    if req.preset == "all_ready":
        return _save(s)
    for c in ALL_CONCEPTS:
        s.lumi_mastery[c] = 1.0
        s.teach_quotes[c] = ("concept", SAMPLE_QUOTE[c])
    # Acts already "chosen" by the preset, on the requested path (act 1 and 3 versions fixed for repeatability).
    plan = {"act2": {1: "savings"}, "act3": {1: "savings", 2: req.path},
            "ending": {1: "savings", 2: req.path, 3: "trouble"}}.get(req.preset, {})
    s.story_chosen = dict(plan)
    s.story_seen = set(plan.values())
    return _save(s)


@router.post("/admin/problem")
def problem(req: ProblemReq) -> dict:
    """A sample problem of any concept with its answer and Lumi's planted mistake (truth fields: admin only)."""
    _guard()
    if req.concept not in ALL_CONCEPTS:
        raise HTTPException(400, detail={"code": "unknown_concept", "message": req.concept})
    rng = random.Random(req.seed)
    if req.concept in NEW_CONCEPTS:
        it = cx.make(req.concept, rng, req.language)
        return {"concept": it.concept, "problem": it.problem, "answer": cx.display(it, it.answer, req.language),
                "planted": cx.display(it, it.wrong, req.language), "kind": it.kind, "visual": it.visual,
                "steps": cx.steps(it, req.language)}
    expr, wrong = teach._make(req.concept, True, rng)
    correct = teach.format_answer(expr, teach.evaluate(expr))
    return {"concept": req.concept, "problem": expr, "answer": correct, "planted": wrong, "kind": "number",
            "visual": None, "steps": teach.demo_steps(expr, req.language)}


@router.post("/admin/scene")
def scene_preview(req: SceneReq) -> dict:
    """Read any story scene in any language, open or not, without changing the session's story."""
    _guard()
    keys = {k for vs in story.ACTS.values() for k in vs} | set(story.ENDINGS.values())
    if req.key not in keys:
        raise HTTPException(400, detail={"code": "unknown_scene", "message": req.key})
    title, lines = story.TEXT[req.language]["scenes"][req.key]
    nums = story._numbers(req.language).get(req.key, {})
    return {"key": req.key, "title": title, "emoji": story.emoji_of(req.key),
            "act": story._act_of(req.key) or 4, "lines": [{"emotion": e, "text": t.format(**nums)} for e, t in lines]}
