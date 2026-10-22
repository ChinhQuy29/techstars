"""Teach Lumi mode: POST /api/teach/worksheet, POST /api/teach/turn. Spec: teach-lumi-spec.md §7."""
from fastapi import APIRouter, HTTPException

from ..schemas import TeachTurn, TeachTurnRequest, TeachWorksheetRequest, TeachWorksheetResponse
from ..services import teach
from ..services.session import get_session

router = APIRouter()


@router.post("/teach/worksheet", response_model=TeachWorksheetResponse)
async def teach_worksheet(req: TeachWorksheetRequest) -> TeachWorksheetResponse:
    return teach.new_worksheet(get_session(req.session_id), req.language, req.force)


@router.post("/teach/turn", response_model=TeachTurn)
async def teach_turn(req: TeachTurnRequest) -> TeachTurn:
    session = get_session(req.session_id)
    if session.teach is None or session.teach.worksheet_id != req.worksheet_id:
        raise HTTPException(status_code=409, detail="unknown or stale worksheet_id; request a new worksheet")
    return await teach.respond(session, req)
