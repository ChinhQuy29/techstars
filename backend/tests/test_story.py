"""Lumi's Journey (docs/03-lumis-town.md): concept pairs in any order, choices, what-ifs, endings,
notifications, saved progress, and scene math that is computed, not typed."""
import os
import re

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402
from app.services import profile, story  # noqa: E402
from app.services.session import get_session  # noqa: E402

client = TestClient(api)


def post(path, **body):
    r = client.post(f"/api/{path}", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def teach(sid, *concepts):
    s = get_session(sid)
    for c in concepts:
        s.lumi_mastery[c] = max(s.lumi_mastery.get(c, 0.0), 1.0)


def versions(j, act):
    return {v["key"]: v for v in j["acts"][act - 1]["versions"]}


def test_journey_starts_after_two_town_shops():
    sid = "st-start"
    j = post("teach/story", session_id=sid)
    assert j["started"] is False and "two shops" in j["say"]
    teach(sid, "carry")
    assert post("teach/story", session_id=sid)["started"] is False
    teach(sid, "mul")
    j = post("teach/story", session_id=sid)
    assert j["started"] and j["current_act"] == 1


def test_a_version_needs_both_concepts_in_any_order_and_mystery_cards_give_clues():
    sid = "st-pairs"
    teach(sid, "carry", "off_by_one")
    v = versions(post("teach/story", session_id=sid), 1)
    assert v["savings"]["state"] == "partial" and v["savings"]["concepts"] == ["carry"]  # only the taught one shows
    assert v["savings"]["emoji"] == "❓" and v["bake_sale"]["state"] == "locked" and v["bake_sale"]["concepts"] == []
    teach(sid, "borrow")
    v = versions(post("teach/story", session_id=sid), 1)
    assert v["savings"]["state"] == "available" and v["savings"]["concepts"] == ["carry", "borrow"]
    assert versions(post("teach/story", session_id=sid), 2)["engineer"]["state"] == "later"


def test_choosing_moves_the_story_on_and_other_versions_become_what_ifs():
    sid = "st-choose"
    teach(sid, "carry", "borrow", "mul", "share")
    j = post("teach/story", session_id=sid)
    assert "more than one idea" in j["say"]  # two versions open: the child chooses
    sc = post("teach/story/scene", session_id=sid, key="bake_sale")
    assert sc["act"] == 1 and not sc["what_if"]
    j = post("teach/story", session_id=sid)
    assert j["acts"][0]["chosen"] == "bake_sale" and j["current_act"] == 2
    assert versions(j, 1)["savings"]["state"] == "what_if"
    again = post("teach/story/scene", session_id=sid, key="savings")
    assert again["what_if"] and post("teach/story", session_id=sid)["acts"][0]["chosen"] == "bake_sale"


def test_locked_scenes_cannot_be_opened():
    sid = "st-locked"
    teach(sid, "carry", "borrow")
    r = client.post("/api/teach/story/scene", json={"session_id": sid, "key": "engineer"})
    assert r.status_code == 409
    r = client.post("/api/teach/story/scene", json={"session_id": sid, "key": "moon_pilot"})
    assert r.status_code == 409
    assert client.post("/api/teach/story/scene", json={"session_id": sid, "key": "nonsense"}).status_code == 409


@pytest.mark.parametrize("path,act1,act3", [
    ("engineer", "savings", "trouble"), ("musician", "star_map", "packing"),
    ("scientist", "bake_sale", "navigation"), ("pilot", "town_vote", "launch_window"),
])
def test_every_path_reaches_its_own_moon_ending(path, act1, act3):
    sid = f"st-path-{path}"
    for key in (act1, path, act3):
        act = story._act_of(key)
        teach(sid, *story.ACTS[act][key][0])
        teach(sid, "carry", "mul")  # two shops open
        post("teach/story/scene", session_id=sid, key=key)
    j = post("teach/story", session_id=sid)
    assert j["current_act"] == 4 and j["ending"]["key"] == f"moon_{path}"
    get_session(sid).teach_quotes["carry"] = ("concept", "the 1 goes to the tens")
    end = post("teach/story/scene", session_id=sid, key=f"moon_{path}")
    assert end["act"] == 4 and end["emoji"] == "🌙"
    if "carry" in [c for k in (act1, path, act3) for c in story.ACTS[story._act_of(k)][k][0]]:
        assert any("the 1 goes to the tens" in ln["text"] for ln in end["lines"])  # the child's own words


def test_new_scenes_are_announced_by_teaching_turns():
    sid = "st-notify"
    s = get_session(sid)
    teach(sid, "carry", "mul")
    before = story.available(s)
    teach(sid, "borrow")  # carry + borrow → Counting the savings
    assert story.available(s) - before == {"savings"}
    post("teach/story/scene", session_id=sid, key="savings")
    assert "savings" not in story.available(s)  # seen: not announced again


@pytest.mark.parametrize("lang", ["en", "es", "vi"])
def test_every_scene_is_complete_and_its_numbers_add_up(lang):
    keys = [k for vs in story.ACTS.values() for k in vs] + list(story.ENDINGS.values())
    assert set(story.TEXT[lang]["scenes"]) == set(keys)
    assert set(story.TEXT[lang]) == set(story.TEXT["en"])
    nums = story._numbers(lang)
    for k in keys:
        title, lines = story.TEXT[lang]["scenes"][k]
        assert title and lines
        for emotion, text in lines:
            assert emotion in {"thinking", "happy", "celebrating", "curious", "confused", "encouraging"}
            assert "{" not in text.format(**nums.get(k, {}))
    n = story._numbers("en")
    assert n["savings"]["sum"] == 623 and n["savings"]["left"] == 438
    assert n["bake_sale"]["total"] == 48 and n["bake_sale"]["each"] * 4 == 48
    assert n["pilot"]["end"] == "10:15" and n["launch_window"]["wait"] == 18
    assert n["navigation"]["left"] == "134,400" and n["trouble"]["total"] == 85


def test_story_never_changes_stars_and_is_saved_with_progress():
    sid = "st-save"
    teach(sid, "carry", "borrow", "mul")
    s = get_session(sid)
    stars = dict(s.lumi_mastery)
    post("teach/story/scene", session_id=sid, key="savings")
    assert s.lumi_mastery == stars
    snap = profile.snapshot(s)
    assert snap["story"] == {"chosen": {"1": "savings"}, "seen": ["savings"]}
    fresh = get_session("st-save-2")
    profile.merge_into(fresh, snap)
    assert fresh.story_chosen == {1: "savings"} and "savings" in fresh.story_seen
    profile.merge_into(fresh, {"story": {"chosen": {"1": "town_vote", "9": "x", "2": "nope"}, "seen": ["evil"]}})
    assert fresh.story_chosen == {1: "savings"} and "evil" not in fresh.story_seen  # junk is ignored


def test_numbers_use_each_languages_separator():
    assert re.search(r"384\.400", story.TEXT["es"]["scenes"]["star_map"][1][1][1].format(**story._numbers("es")["star_map"]))


def test_a_teaching_turn_announces_the_story_scene_it_opens():
    sid = "st-turn"
    s = get_session(sid)
    # two shops open (the journey has started); careful counting mastered, so the sheet plants only carrying
    s.lumi_mastery.update({"mul": 1.0, "borrow": 1.0, "off_by_one": 3.0})
    w = post("teach/worksheet", session_id=sid, force=True)  # force teaches carry + careful counting
    wid = w["worksheet_id"]
    probs = {p.id: p for p in s.teach.problems}
    marks = [{"id": p.id, "mark": "circle", "correction": p.correct_answer} if p.planted else {"id": p.id, "mark": "check"}
             for p in probs.values()]
    t = post("teach/turn", session_id=sid, worksheet_id=wid, action="check", marks=marks)
    seen = []
    while t["step"] != "done":
        if t["step"] == "explain":
            said = {"carry": "15 is more than 9 so the 1 goes to the tens",
                    "off_by_one": "check it again carefully"}[probs[t["focus_problem_id"]].concept]
            t = post("teach/turn", session_id=sid, worksheet_id=wid, action="explain", child_said=said)
        elif t["step"] == "demo":
            t = post("teach/turn", session_id=sid, worksheet_id=wid, action="confirm", agree=True)
            seen += t["unlocks"]
        else:
            t = post("teach/turn", session_id=sid, worksheet_id=wid, action="next")
    assert s.lumi_mastery["carry"] >= 1
    assert {"kind": "story", "key": "savings"} in [{"kind": u["kind"], "key": u["key"]} for u in seen]
