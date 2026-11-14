"""Children's data: session ids must be unguessable, and the phone-camera relay is off unless switched on."""
import os

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402
from app.services.session import get_session  # noqa: E402

client = TestClient(api)
GOOD = "0123456789abcdef0123456789abcdef"


@pytest.fixture
def strict(monkeypatch):
    """Production rules: no readable test ids."""
    monkeypatch.delenv("LUMI_LOOSE_SESSION_IDS", raising=False)


@pytest.mark.parametrize("sid", ["abc123", "x", "bn2ii0", GOOD.upper(), GOOD[:-1], GOOD + "0", "../" + GOOD[3:]])
def test_guessable_session_ids_are_refused(strict, sid):
    r = client.post("/api/report", json={"session_id": sid, "language": "en"})
    assert r.status_code == 422
    r = client.post("/api/teach/concepts", json={"session_id": sid, "language": "en"})
    assert r.status_code == 422


def test_strong_session_id_works(strict):
    assert client.post("/api/report", json={"session_id": GOOD, "language": "en"}).status_code == 200
    assert client.post("/api/teach/concepts", json={"session_id": GOOD, "language": "en"}).status_code == 200


def test_server_made_ids_are_strong(strict):
    s = get_session(None)
    assert len(s.id) == 32 and int(s.id, 16) >= 0


def test_explanations_never_reachable_with_a_short_id(strict, monkeypatch):
    # A child's session holds their words; a guessable id must not open it, even if one exists from before.
    monkeypatch.setenv("LUMI_LOOSE_SESSION_IDS", "1")
    get_session("abc123").teach_quotes["carry"] = (1.0, "the 1 goes to the tens")
    monkeypatch.delenv("LUMI_LOOSE_SESSION_IDS")
    r = client.post("/api/report", json={"session_id": "abc123", "language": "en"})
    assert r.status_code == 422
    assert "tens" not in r.text


def test_phone_camera_relay_is_off_by_default(monkeypatch):
    monkeypatch.delenv("LUMI_PHONE_CAMERA", raising=False)
    assert client.get("/api/health").json()["phone_camera"] is False
    r = client.post(f"/api/frame/{GOOD}", content=b"\xff\xd8fakejpeg")
    assert r.status_code == 404


def test_phone_camera_relay_when_switched_on(monkeypatch, strict):
    monkeypatch.setenv("LUMI_PHONE_CAMERA", "1")
    assert client.get("/api/health").json()["phone_camera"] is True
    assert client.post(f"/api/frame/{GOOD}", content=b"\xff\xd8fakejpeg").status_code == 200
    assert client.post("/api/frame/abc123", content=b"\xff\xd8fakejpeg").status_code == 422
