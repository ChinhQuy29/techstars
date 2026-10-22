"""FastAPI + Socket.IO entrypoint.  Run: uvicorn app.main:app --reload --port 8000"""
import logging
import os

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()
logging.getLogger("homework-lamp").setLevel(logging.INFO)
logging.basicConfig(format="%(levelname)s:     %(message)s")

from .realtime import sio  # noqa: E402
from .routes import grade, lamp, report, teach, tutor  # noqa: E402
from .services import llm  # noqa: E402
from .services.session import reset_session  # noqa: E402
from .services.vision import SAMPLES_DIR, _samples  # noqa: E402

api = FastAPI(title="Homework Lamp API")
api.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (grade.router, tutor.router, report.router, lamp.router, teach.router):
    api.include_router(r, prefix="/api")


@api.get("/api/health")
def health():
    return {"ok": True, "mode": "gemini" if llm.enabled() else "mock", "model": llm.model_name()}


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
