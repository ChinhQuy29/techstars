"""POST /api/tutor — Socratic robot reply. Backend owns hint_level / reveal gating."""
from fastapi import APIRouter

from ..schemas import TutorRequest, TutorResponse
from ..services import tutor
from ..services.session import get_session

router = APIRouter()


@router.post("/tutor", response_model=TutorResponse)
async def tutor_reply(req: TutorRequest) -> TutorResponse:
    session = get_session(req.session_id)
    if req.child_said:
        session.log("child_said", text=req.child_said)
    return await tutor.respond(session, req)
