"""FastAPI + Socket.IO entrypoint.  Run: uvicorn app.main:app --reload --port 8000"""
import logging
import os

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()
logging.getLogger("lumi").setLevel(logging.INFO)
logging.basicConfig(format="%(levelname)s:     %(message)s")

from .realtime import sio  # noqa: E402
from .routes import admin, frames, grade, profile, report, teach, tutor  # noqa: E402
from .services import llm  # noqa: E402
from .services.session import InvalidSessionId, reset_session  # noqa: E402
from .services.vision import SAMPLES_DIR, _samples  # noqa: E402

# The Android app (Capacitor) loads from https://localhost; iOS from capacitor://localhost. Always allowed, so an
# app pointed at this server works with any CORS_ORIGINS setting (docs/09-android-app.md).
APP_ORIGINS = ["https://localhost", "capacitor://localhost"]
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

api = FastAPI(title="Lumi API")


@api.exception_handler(InvalidSessionId)
async def _bad_session(_: Request, exc: InvalidSessionId) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=422)

api.add_middleware(
    CORSMiddleware,
    allow_origins=_origins if "*" in _origins else _origins + APP_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (grade.router, tutor.router, report.router, frames.router, teach.router, profile.router, admin.router):
    api.include_router(r, prefix="/api")


@api.get("/api/health")
def health():
    return {"ok": True, "mode": "gemini" if llm.enabled() else "mock", "model": llm.model_name(), "admin": admin.enabled(), "phone_camera": frames.enabled()}


@api.get("/api/samples")
def samples():
    return [{"name": img.stem, "url": f"/api/samples/files/{img.name}"} for _, img, _ in _samples()]


@api.post("/api/session/{session_id}/reset")
def reset(session_id: str):
    reset_session(session_id)
    return {"ok": True}


if SAMPLES_DIR.exists():
    api.mount("/api/samples/files", StaticFiles(directory=SAMPLES_DIR), name="samples")

# Socket.IO wraps FastAPI; socket traffic lives at /socket.io
app = socketio.ASGIApp(sio, other_asgi_app=api)
