"""Saved progress (docs/06-privacy-and-safety.md): consent first, restore across sessions, merge, delete, retention."""
import json
import os
import sqlite3
import time

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402
from app.services import store  # noqa: E402
from app.services.session import get_session  # noqa: E402

client = TestClient(api)


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("LUMI_DB", str(tmp_path / "lumi.db"))
    yield tmp_path / "lumi.db"


def create(sid, consent=True, version=store.CONSENT_VERSION):
    return client.post("/api/profile", json={"session_id": sid, "consent": consent, "consent_version": version})


def attach(sid, pid):
    return client.post("/api/profile/attach", json={"session_id": sid, "profile_id": pid})


def teach_one_concept(sid):
    """Demo sheet → explain the carry mistake at concept level → confirm: +1 carry star."""
    w = client.post("/api/teach/worksheet", json={"session_id": sid, "language": "en", "demo": True}).json()
    wid = w["worksheet_id"]
    marks = [{"id": 1, "mark": "check"}, {"id": 2, "mark": "circle", "correction": "85"}, {"id": 3, "mark": "check"},
             {"id": 4, "mark": "circle", "correction": "35"}, {"id": 5, "mark": "check"}]
    turn = lambda action, **kw: client.post("/api/teach/turn", json={"session_id": sid, "worksheet_id": wid, "action": action, **kw}).json()  # noqa: E731
    turn("check", marks=marks)
    turn("explain", child_said="7 plus 8 is 15 so the 1 goes to the tens")
    turn("confirm", agree=True)


def test_nothing_is_saved_without_consent(temp_db):
    r = create("p-noconsent", consent=False)
    assert r.status_code == 400 and r.json()["detail"]["code"] == "consent_required"
    teach_one_concept("p-noconsent")
    assert not temp_db.exists() or sqlite3.connect(temp_db).execute(
        "SELECT name FROM sqlite_master WHERE name='profiles'").fetchone() is None or \
        sqlite3.connect(temp_db).execute("SELECT COUNT(*) FROM profiles").fetchone()[0] == 0


def test_outdated_consent_version_rejected():
    r = create("p-oldconsent", version="2000-01-01")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "consent_outdated"


def test_progress_survives_into_a_new_session_and_town():
    r = create("p-day1")
    assert r.status_code == 200
    pid = r.json()["profile_id"]
    teach_one_concept("p-day1")

    # "Next day": a brand-new session (server restarted / new tab) on the same device
    r2 = attach("p-day2", pid)
    assert r2.status_code == 200
    assert r2.json()["summary"]["stars"]["carry"] == 1.0 and r2.json()["summary"]["skills_taught"] == 1
    town = client.post("/api/teach/town", json={"session_id": "p-day2", "language": "en"}).json()
    assert next(p for p in town["places"] if p["concept"] == "carry")["unlocked"]
    assert town["scrapbook"][0]["quote"].startswith("7 plus 8")


def test_consenting_mid_session_keeps_what_was_earned():
    teach_one_concept("p-late")
    pid = create("p-late").json()["profile_id"]
    assert attach("p-late-next", pid).json()["summary"]["stars"]["carry"] == 1.0


def test_merge_keeps_the_best_of_both():
    pid = create("p-merge-a").json()["profile_id"]
    s = get_session("p-merge-b")
    s.lumi_mastery = {"carry": 0.5, "mul": 2.0}
    s.teach_quotes = {"carry": ("procedure", "carry it")}
    store.save(pid, {"mastery": {"carry": 1.5}, "quotes": {"carry": ["concept", "15 is more than 9"]}, "ready": ["carry"], "town_visits": {}})
    summary = attach("p-merge-b", pid).json()["summary"]["stars"]
    assert summary["carry"] == 1.5 and summary["mul"] == 2.0
    assert s.teach_quotes["carry"] == ("concept", "15 is more than 9")
    assert "carry" in s.saved_ready  # Teach mode opens on another day without redoing Help mode


def test_saved_teach_readiness_opens_the_gate():
    pid = create("p-gate-a").json()["profile_id"]
    store.save(pid, {"mastery": {}, "quotes": {}, "ready": ["carry"], "town_visits": {}})
    attach("p-gate-b", pid)
    w = client.post("/api/teach/worksheet", json={"session_id": "p-gate-b", "language": "en"}).json()
    assert w["ready"] and "carry" in w["concepts"]


def test_delete_removes_everything_and_stops_saving(temp_db):
    pid = create("p-del").json()["profile_id"]
    teach_one_concept("p-del")
    assert client.delete(f"/api/profile/{pid}").json() == {"deleted": True}
    assert attach("p-del-2", pid).status_code == 404
    assert get_session("p-del").profile_id is None
    teach_one_concept("p-del")  # keeps working, just in memory
    assert sqlite3.connect(temp_db).execute("SELECT COUNT(*) FROM profiles").fetchone()[0] == 0


def test_only_whitelisted_fields_are_stored(temp_db):
    pid = create("p-white").json()["profile_id"]
    teach_one_concept("p-white")
    row = json.loads(sqlite3.connect(temp_db).execute("SELECT data FROM profiles WHERE id=?", (pid,)).fetchone()[0])
    assert set(row) == {"mastery", "quotes", "ready", "town_visits", "story"}  # story = chosen acts + scenes seen
    assert "events" not in json.dumps(row) and "child_said" not in json.dumps(row)
    store.save(pid, {"mastery": {}, "name": "Alex", "photo": "x"})
    row = json.loads(sqlite3.connect(temp_db).execute("SELECT data FROM profiles WHERE id=?", (pid,)).fetchone()[0])
    assert "name" not in row and "photo" not in row


def test_retention_purges_unused_profiles(temp_db):
    old = store.create(store.CONSENT_VERSION)
    fresh = store.create(store.CONSENT_VERSION)
    con = sqlite3.connect(temp_db)
    con.execute("UPDATE profiles SET updated_at=? WHERE id=?", (time.time() - (store.RETENTION_DAYS + 1) * 86400, old))
    con.commit()
    assert store.purge() == 1
    assert store.load(old) is None and store.load(fresh) is not None


def test_bad_profile_ids_rejected():
    assert attach("p-bad", "not-a-real-id").status_code == 422
    assert client.delete("/api/profile/../../etc").status_code in (404, 422)
