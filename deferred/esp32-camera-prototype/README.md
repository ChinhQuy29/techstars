# Deferred: ESP32 camera prototype (not part of the product)

An early hardware experiment from when the idea was an overhead "lamp" camera. **Lumi is a software-only robot learning companion now.** Nothing in the app uses this firmware, and no hardware is planned for this phase (see `docs/08-status-and-roadmap.md` §4).

Kept for reference only. The LED/lamp endpoints it once talked to (`/api/lamp/led`, `/api/lamp/capture`) were removed. The only backend hook left is the generic `POST /api/frame/{session_id}` JPEG push (`backend/app/routes/frames.py`), which any camera can use.
