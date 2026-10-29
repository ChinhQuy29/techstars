"""Saved progress: POST /api/profile (create with consent), POST /api/profile/attach, DELETE /api/profile/{id}.

Spec: docs/06-privacy-and-safety.md. Nothing is stored until a grown-up opts in.
"""
import logging

from fastapi import APIRouter, HTTPException, Path

from ..schemas import ProfileAttachRequest, ProfileCreateRequest, ProfileResponse
from ..services import profile, store
from ..services.session import get_session

router = APIRouter()
log = logging.getLogger("lumi.profile")
_ID = Path(min_length=32, max_length=32, pattern=r"^[0-9a-f]{32}$")


@router.post("/profile", response_model=ProfileResponse)
async def create_profile(req: ProfileCreateRequest) -> ProfileResponse:
    if not req.consent:
        raise HTTPException(400, detail={"code": "consent_required", "message": "A grown-up must agree before Lumi saves progress."})
    if req.consent_version != store.CONSENT_VERSION:
        raise HTTPException(409, detail={"code": "consent_outdated", "message": "Please reload: the consent text has changed."})
    store.purge()
    session = get_session(req.session_id)
    pid = store.create(req.consent_version)
    profile.attach(session, pid)  # keeps what this session already earned
    log.info("profile created session=%s", session.id)
    return ProfileResponse(profile_id=pid, summary=profile.summary(session))


@router.post("/profile/attach", response_model=ProfileResponse)
async def attach_profile(req: ProfileAttachRequest) -> ProfileResponse:
    store.purge()
    session = get_session(req.session_id)
    if not profile.attach(session, req.profile_id):
        raise HTTPException(404, detail={"code": "profile_not_found", "message": "No saved progress found on this device."})
    return ProfileResponse(profile_id=req.profile_id, summary=profile.summary(session))


@router.delete("/profile/{profile_id}")
async def delete_profile(profile_id: str = _ID) -> dict:
    deleted = profile.forget(profile_id)
    log.info("profile deleted=%s", deleted)
    return {"deleted": deleted}
