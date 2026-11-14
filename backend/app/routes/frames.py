"""Camera frame push: any HTTP camera can POST JPEGs here; they're relayed to the screen over Socket.IO.

(The earlier ESP32 lamp LED / high-res pull endpoints were removed with the lamp concept;
the prototype firmware is parked in deferred/esp32-camera-prototype/.)
"""
import base64
import os

from fastapi import APIRouter, HTTPException, Request

from ..realtime import sio
from ..services.session import valid_session_id

router = APIRouter()


def enabled() -> bool:
    """The "phone as camera" relay is a laptop-demo feature: off unless LUMI_PHONE_CAMERA=1 (never on a public server)."""
    return os.getenv("LUMI_PHONE_CAMERA") == "1"


@router.post("/frame/{session_id}")
async def push_frame(session_id: str, request: Request, kind: str = "frame"):
    """Raw JPEG bytes in the body (avoids HTTPS mixed-content). kind=frame | capture."""
    if not enabled():
        raise HTTPException(404, "not found")
    if not valid_session_id(session_id):
        raise HTTPException(422, "invalid session id")
    body = await request.body()
    if not body:
        raise HTTPException(400, "empty body")
    data_url = "data:image/jpeg;base64," + base64.b64encode(body).decode()
    event = "capture" if kind == "capture" else "frame"
    await sio.emit(event, {"image": data_url}, room=f"viewer:{session_id}")
    return {"ok": True}
