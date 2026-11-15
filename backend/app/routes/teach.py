"""Teach Lumi mode: POST /api/teach/worksheet, /teach/turn (docs/02-learning-design.md), /teach/town, /teach/scene (docs/03-lumis-town.md)."""
import logging

from fastapi import APIRouter, HTTPException

from ..schemas import (
    SceneRequest, SceneResponse, StoryRequest, StoryResponse, StorySceneRequest, StorySceneResponse, TeachConceptsRequest, TeachConceptsResponse, TeachTurn, TeachTurnRequest,
    TeachUnlock, TeachWorksheetRequest, TeachWorksheetResponse, TownRequest, TownResponse, WarmupCheckRequest,
    WarmupCheckResponse, WarmupRequest, WarmupResponse,
)
from ..services import dreams, profile, story, teach, town
from ..services.concepts import ALL_CONCEPTS, NEW_CONCEPTS
from ..services.math_check import TEACHABLE
from ..services.session import get_session

router = APIRouter()
log = logging.getLogger("lumi.teach")


@router.post("/teach/worksheet", response_model=TeachWorksheetResponse)
async def teach_worksheet(req: TeachWorksheetRequest) -> TeachWorksheetResponse:
    session = get_session(req.session_id)
    try:
        if req.concept is not None and req.concept not in ALL_CONCEPTS:
            raise HTTPException(400, detail={"code": "unknown_concept", "message": "Unknown concept."})
        session.dream = dreams.valid_dream(req.dream)
        resp = teach.new_worksheet(session, req.language, req.force, demo=req.demo, concept=req.concept)
        profile.autosave(session)  # remembers Teach readiness for another day (only with consent)
        return resp
    except teach.TeachGenerationError:
        log.exception("teach worksheet generation failed session=%s", session.id)
        raise HTTPException(status_code=503, detail={
            "code": "generation_failed", "message": "Lumi could not make a worksheet. Please try again."})


@router.post("/teach/concepts", response_model=TeachConceptsResponse)
async def teach_concepts(req: TeachConceptsRequest) -> TeachConceptsResponse:
    """The concept picker: every concept, Lumi's stars, and whether the child can teach it yet."""
    session = get_session(req.session_id)
    return TeachConceptsResponse(concepts=teach.concept_menu(session, req.language))


@router.post("/teach/warmup", response_model=WarmupResponse)
async def teach_warmup(req: WarmupRequest) -> WarmupResponse:
    if req.concept not in NEW_CONCEPTS:
        raise HTTPException(400, detail={"code": "no_warmup", "message": "This concept unlocks through Help mode."})
    session = get_session(req.session_id)
    return teach.start_warmup(session, req.language, req.concept)


@router.post("/teach/warmup/check", response_model=WarmupCheckResponse)
async def teach_warmup_check(req: WarmupCheckRequest) -> WarmupCheckResponse:
    session = get_session(req.session_id)
    out = teach.check_warmup(session, req.language, req.warmup_id, req.answers)
    if out is None:
        raise HTTPException(409, detail={"code": "stale_warmup", "message": "That warm-up is no longer active."})
    profile.autosave(session)
    return out


def _labels(language: str) -> dict[str, str]:
    return {c: teach.TT[language]["concepts"][c]["label"] for c in ALL_CONCEPTS}


def _open_places(session, language: str) -> dict[str, TeachUnlock]:
    """What Lumi's stars have opened: Town places, and story scenes the child hasn't seen yet."""
    places = {
        c: TeachUnlock(kind="place", key=c, title=town.PLACES[language][c]["name"], emoji=town.PLACES[language][c]["emoji"])
        for c in TEACHABLE if session.lumi_mastery.get(c, 0.0) >= town.UNLOCK_STARS
    }
    scenes = {
        f"story:{k}": TeachUnlock(kind="story", key=k, title=story.title_of(language, k), emoji=story.emoji_of(k))
        for k in story.available(session)
    }
    return places | scenes


@router.post("/teach/turn", response_model=TeachTurn)
async def teach_turn(req: TeachTurnRequest) -> TeachTurn:
    session = get_session(req.session_id)
    if session.teach is None or session.teach.worksheet_id != req.worksheet_id:
        log.info("teach stale worksheet session=%s got=%s current=%s", session.id, req.worksheet_id,
                 session.teach.worksheet_id if session.teach else None)
        raise HTTPException(status_code=409, detail={
            "code": "stale_worksheet", "message": "This worksheet is finished or out of date. Start a new one."})
    before = _open_places(session, req.language)
    turn = await teach.respond(session, req)
    after = _open_places(session, req.language)
    # Notify the child about anything their teaching just opened (stars only move on demo confirmation).
    unlocks = [u for k, u in after.items() if k not in before]
    if unlocks:
        turn.unlocks = unlocks
        if session.teach is not None and session.teach.last_turn is not None:
            # a duplicate tap repeats this exact turn, notification included
            session.teach.last_turn["unlocks"] = [u.model_dump() for u in unlocks]
    profile.autosave(session)  # stars + best quote, only with consent
    return turn


@router.post("/teach/story", response_model=StoryResponse)
async def teach_story(req: StoryRequest) -> StoryResponse:
    """Lumi's Journey: acts, versions (open / mystery / chosen / what-if) and the ending. Read-only."""
    return StoryResponse.model_validate(story.journey(get_session(req.session_id), req.language, _labels(req.language)))


@router.post("/teach/story/scene", response_model=StorySceneResponse)
async def teach_story_scene(req: StorySceneRequest) -> StorySceneResponse:
    """Play a story scene; opening an available version of the current act chooses it."""
    session = get_session(req.session_id)
    out = story.scene(session, req.language, req.key, _labels(req.language))
    if out is None:
        raise HTTPException(409, detail={"code": "scene_locked", "message": "Teach Lumi more to open this scene."})
    profile.autosave(session)
    return StorySceneResponse.model_validate(out)


@router.post("/teach/town", response_model=TownResponse)
async def teach_town(req: TownRequest) -> TownResponse:
    """Lumi's Town: places unlocked by Lumi's stars + the child's scrapbook. Read-only."""
    return TownResponse.model_validate(town.town(get_session(req.session_id), req.language))


@router.post("/teach/scene", response_model=SceneResponse)
async def teach_scene(req: SceneRequest) -> SceneResponse:
    """Lumi uses a taught skill in its town. Locked places return a teaser and no math."""
    session = get_session(req.session_id)
    resp = SceneResponse.model_validate(town.scene(session, req.language, req.concept))
    profile.autosave(session)
    return resp
