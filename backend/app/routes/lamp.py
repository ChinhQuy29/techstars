"""ESP32 lamp helpers: LED status proxy, high-res pull, and HTTP frame push (ESP32 → backend → screen)."""
import base64
import os

import httpx
from fastapi import APIRouter, HTTPException, Request

from ..realtime import sio

router = APIRouter()
LED_STATES = {"off", "idle", "thinking", "correct", "hint", "error"}


def _lamp_url() -> str:
    base = os.getenv("LAMP_URL")
    if not base:
        raise HTTPException(404, "LAMP_URL not configured")
    return base.rstrip("/")


@router.post("/lamp/led")
async def set_led(state: str):
    if state not in LED_STATES:
        raise HTTPException(400, f"state must be one of {sorted(LED_STATES)}")
    if not os.getenv("LAMP_URL"):
        return {"ok": False, "reason": "LAMP_URL not configured"}
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            r = await client.get(f"{_lamp_url()}/led", params={"state": state})
        return {"ok": r.status_code == 200}
    except httpx.HTTPError as exc:
        return {"ok": False, "reason": str(exc)}


@router.get("/lamp/capture")
async def lamp_capture():
    """Pull a high-res still straight from the ESP32 /capture endpoint, as a data URL."""
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(f"{_lamp_url()}/capture")
    r.raise_for_status()
    return {"image": "data:image/jpeg;base64," + base64.b64encode(r.content).decode()}


@router.post("/frame/{session_id}")
async def push_frame(session_id: str, request: Request, kind: str = "frame"):
    """ESP32 POSTs raw JPEG bytes here (avoids HTTPS mixed-content). kind=frame | capture."""
    body = await request.body()
    if not body:
        raise HTTPException(400, "empty body")
    data_url = "data:image/jpeg;base64," + base64.b64encode(body).decode()
    event = "capture" if kind == "capture" else "frame"
    await sio.emit(event, {"image": data_url}, room=f"viewer:{session_id}")
    return {"ok": True}
