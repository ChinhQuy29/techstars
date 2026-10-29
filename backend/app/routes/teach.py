"""Teach Lumi mode: POST /api/teach/worksheet, /teach/turn (docs/02-learning-design.md), /teach/town, /teach/scene (docs/03-lumis-town.md)."""
import logging

from fastapi import APIRouter, HTTPException

from ..schemas import (
    SceneRequest, SceneResponse, TeachTurn, TeachTurnRequest, TeachWorksheetRequest, TeachWorksheetResponse,
    TownRequest, TownResponse,
)
from ..services import profile, teach, town
from ..services.session import get_session

router = APIRouter()
log = logging.getLogger("lumi.teach")


@router.post("/teach/worksheet", response_model=TeachWorksheetResponse)
async def teach_worksheet(req: TeachWorksheetRequest) -> TeachWorksheetResponse:
    session = get_session(req.session_id)
    try:
        resp = teach.new_worksheet(session, req.language, req.force, demo=req.demo)
        profile.autosave(session)  # remembers Teach readiness for another day (only with consent)
        return resp
    except teach.TeachGenerationError:
        log.exception("teach worksheet generation failed session=%s", session.id)
        raise HTTPException(status_code=503, detail={
            "code": "generation_failed", "message": "Lumi could not make a worksheet. Please try again."})


@router.post("/teach/turn", response_model=TeachTurn)
async def teach_turn(req: TeachTurnRequest) -> TeachTurn:
    session = get_session(req.session_id)
    if session.teach is None or session.teach.worksheet_id != req.worksheet_id:
        log.info("teach stale worksheet session=%s got=%s current=%s", session.id, req.worksheet_id,
                 session.teach.worksheet_id if session.teach else None)
        raise HTTPException(status_code=409, detail={
            "code": "stale_worksheet", "message": "This worksheet is finished or out of date. Start a new one."})
    turn = await teach.respond(session, req)
    profile.autosave(session)  # stars + best quote, only with consent
    return turn


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
