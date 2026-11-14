"""Developer admin portal: off by default; presets, patches and previews when LUMI_ADMIN=1."""
import os

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402
from app.services import story  # noqa: E402
from app.services.session import get_session  # noqa: E402

client = TestClient(api)


@pytest.fixture
def admin(monkeypatch):
    monkeypatch.setenv("LUMI_ADMIN", "1")


def post(endpoint, **body):
    r = client.post(f"/api/admin/{endpoint}", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_admin_is_off_unless_enabled(monkeypatch):
    monkeypatch.delenv("LUMI_ADMIN", raising=False)
    assert client.get("/api/admin/status").status_code == 404
    assert client.post("/api/admin/preset", json={"session_id": "x", "preset": "all_taught"}).status_code == 404
    assert client.get("/api/health").json()["admin"] is False


def test_presets_build_the_states_testers_need(admin):
    st = post("preset", session_id="ad-pre", preset="town_open")
    stars = {c["concept"]: c["stars"] for c in st["concepts"]}
    assert all(stars[c] == 1.0 for c in ("carry", "borrow", "off_by_one", "mul")) and stars["time"] == 0
    assert st["story"]["started"]
    st = post("preset", session_id="ad-pre", preset="all_ready")
    assert all(c["ready"] for c in st["concepts"]) and all(c["stars"] == 0 for c in st["concepts"])
    st = post("preset", session_id="ad-pre", preset="ending", path="pilot")
    assert st["story"]["ending"] == "moon_pilot" and st["story"]["current_act"] == 4
    # the real story endpoint agrees, and the ending quotes the sample explanations
    end = client.post("/api/teach/story/scene", json={"session_id": "ad-pre", "key": "moon_pilot"}).json()
    assert any("You taught me" in ln["text"] for ln in end["lines"])
    assert post("preset", session_id="ad-pre", preset="fresh")["story"]["started"] is False


def test_patch_sets_stars_readiness_quotes_and_story(admin):
    sid = "ad-patch"
    st = post("patch", session_id=sid, concepts=[
        {"concept": "fractions", "stars": 2.5, "ready": True, "quote": "more pieces, smaller pieces"},
        {"concept": "carry", "ready": True}])
    row = {c["concept"]: c for c in st["concepts"]}
    assert row["fractions"]["stars"] == 2.5 and row["fractions"]["ready"] and row["carry"]["ready"]
    assert get_session(sid).teach_quotes["fractions"][1] == "more pieces, smaller pieces"
    st = post("patch", session_id=sid, story_chosen={"1": "bake_sale", "2": "musician"})
    assert st["story"]["chosen"] == {"1": "bake_sale", "2": "musician"} and st["story"]["current_act"] == 3
    st = post("patch", session_id=sid, concepts=[{"concept": "fractions", "ready": False, "quote": ""}])
    assert not {c["concept"]: c for c in st["concepts"]}["fractions"]["ready"]


@pytest.mark.parametrize("body,code", [
    ({"concepts": [{"concept": "magic", "stars": 1}]}, "unknown_concept"),
    ({"concepts": [{"concept": "carry", "stars": 1.3}]}, "half_steps"),
    ({"story_chosen": {"1": "engineer"}}, "wrong_act"),
    ({"story_chosen": {"2": "engineer"}}, "act_gap"),
])
def test_patch_rejects_bad_input(admin, body, code):
    r = client.post("/api/admin/patch", json={"session_id": "ad-bad", **body})
    assert r.status_code == 400 and r.json()["detail"]["code"] == code
    assert client.post("/api/admin/patch", json={"session_id": "ad-bad", "concepts": [{"concept": "carry", "stars": 4}]}).status_code == 422


def test_previews_show_truth_only_to_admins_and_leave_the_story_alone(admin):
    for c in ("carry", "time", "fractions", "big_numbers"):
        p = post("problem", concept=c, language="es", seed=7)
        assert p["answer"] != p["planted"] and p["steps"]
    assert post("problem", concept="graphs", seed=3) == post("problem", concept="graphs", seed=3)  # seeded
    sid = "ad-scene"
    sc = post("scene", session_id=sid, key="trouble", language="vi")
    assert sc["act"] == 3 and len(sc["lines"]) == 3 and "{" not in "".join(ln["text"] for ln in sc["lines"])
    assert get_session(sid).story_chosen == {} and get_session(sid).story_seen == set()
    assert client.post("/api/admin/scene", json={"session_id": sid, "key": "nope"}).status_code == 400
    assert set(story.ENDINGS.values()) <= {k for k in story.TEXT["en"]["scenes"]}
