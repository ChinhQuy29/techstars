"""Socket.IO frame relay: phone / ESP32 camera → backend → screen.

Rooms per session:
  camera:<sid>  — the phone camera page
  viewer:<sid>  — the main screen
Events:
  join {session_id, role: "camera"|"viewer"}
  frame {image}            camera → viewers (low-res preview, ~5 fps)
  capture_request {}       viewer → camera  (ask for a high-res still)
  capture {image}          camera → viewers (high-res still)
"""
import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", max_http_buffer_size=10_000_000)


@sio.event
async def join(sid, data):
    session_id = (data or {}).get("session_id")
    role = (data or {}).get("role", "viewer")
    if not session_id or role not in ("camera", "viewer"):
        return {"ok": False}
    await sio.save_session(sid, {"session_id": session_id, "role": role})
    await sio.enter_room(sid, f"{role}:{session_id}")
    if role == "camera":
        await sio.emit("camera_status", {"connected": True}, room=f"viewer:{session_id}")
    return {"ok": True}


async def _room(sid, role):
    s = await sio.get_session(sid)
    return f"{role}:{s['session_id']}" if s else None


@sio.event
async def frame(sid, data):
    room = await _room(sid, "viewer")
    if room:
        await sio.emit("frame", data, room=room)


@sio.event
async def capture(sid, data):
    room = await _room(sid, "viewer")
    if room:
        await sio.emit("capture", data, room=room)


@sio.event
async def capture_request(sid, data=None):
    room = await _room(sid, "camera")
    if room:
        await sio.emit("capture_request", {}, room=room)


@sio.event
async def disconnect(sid):
    s = await sio.get_session(sid)
    if s and s.get("role") == "camera":
        await sio.emit("camera_status", {"connected": False}, room=f"viewer:{s['session_id']}")
