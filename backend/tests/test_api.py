"""End-to-end demo script in MOCK mode: wrong answers → hints → fix → celebrate → report."""
import os
from pathlib import Path

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402

SAMPLES = Path(__file__).resolve().parents[2] / "test-worksheets"
client = TestClient(api)


def grade(name: str, sid: str):
    with open(SAMPLES / name, "rb") as f:
        r = client.post("/api/grade", files={"image": (name, f, "image/png")}, data={"session_id": sid})
    assert r.status_code == 200
    return r.json()


def tutor(sid: str, action="react"):
    r = client.post("/api/tutor", json={"session_id": sid, "action": action, "language": "en"})
    assert r.status_code == 200
    return r.json()


def test_demo_flow():
    sid = "pytest1"
    g = grade("worksheet-1.png", sid)
    assert g["mock"] is True
    wrong = {p["id"]: p for p in g["problems"] if not p["is_correct"]}
    assert set(wrong) == {2, 4}
    assert wrong[2]["correct_answer"] == "85"
    assert "carry" in wrong[2]["error_step"]

    t = tutor(sid)
    assert t["focus_problem_id"] == 2 and t["hint_level"] == 1 and not t["revealed"]
    assert "85" not in t["say"]
    levels = [tutor(sid, "hint")["hint_level"] for _ in range(4)]
    assert levels == [2, 3, 4, 4]
    final = tutor(sid, "hint")
    assert final["revealed"] and "85" in final["say"] and final["practice_problem"]

    g2 = grade("worksheet-2.png", sid)
    assert all(p["is_correct"] for p in g2["problems"])
    assert set(g2["fixed_ids"]) == {2, 4}
    assert tutor(sid)["emotion"] == "celebrating"

    rep = client.post("/api/report", json={"session_id": sid, "language": "en"}).json()
    assert rep["score"] == 100 and rep["fixed"] == 2 and rep["total"] == 6
    assert "carrying in addition" in rep["concepts"]
    assert len(rep["practice_problems"]) == 3


def test_samples_listed():
    names = [s["name"] for s in client.get("/api/samples").json()]
    assert "worksheet-1" in names


def test_assigned_worksheet_practice_stays_on_the_selected_problem():
    sid = "assigned-worksheet-practice"
    grade("worksheet-1.png", sid)
    for level in range(1, 5):
        response = client.post("/api/tutor", json={
            "session_id": sid, "action": "hint", "problem_id": 2, "worksheet_only": True,
        })
        assert response.status_code == 200
        turn = response.json()
        assert turn["focus_problem_id"] == 2
        assert turn["hint_level"] == level
        assert turn["practice_problem"] is None
        assert turn["revealed"] == (level == 4)
        assert ("85" in turn["say"]) == (level == 4)


def test_quota_error_keeps_previous_grade(monkeypatch):
    from app.services import llm, vision

    sid = "pytest-quota"
    grade("worksheet-1.png", sid)

    async def fail(*args, **kwargs):
        return None, "quota"

    monkeypatch.setattr(llm, "enabled", lambda: True)
    monkeypatch.setattr(vision.llm, "generate_ex", fail)
    g = grade("worksheet-2.png", sid)
    assert g["llm_error"] == "quota" and g["problems"] == []
    monkeypatch.setattr(llm, "enabled", lambda: False)
    assert tutor(sid, "hint")["focus_problem_id"] == 2  # hints still work on the last good grade
