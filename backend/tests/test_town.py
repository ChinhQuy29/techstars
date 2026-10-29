"""Lumi's Town (docs/03-lumis-town.md): unlock threshold, backend-correct scenes, teasers, read-only."""
import os
import re

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402
from app.services import math_check, town  # noqa: E402
from app.services.session import get_session  # noqa: E402

client = TestClient(api)


def get_town(sid, language="en"):
    r = client.post("/api/teach/town", json={"session_id": sid, "language": language})
    assert r.status_code == 200, r.text
    return r.json()


def get_scene(sid, concept, language="en"):
    r = client.post("/api/teach/scene", json={"session_id": sid, "language": language, "concept": concept})
    assert r.status_code == 200, r.text
    return r.json()


def test_fresh_town_is_all_locked_with_teasers():
    t = get_town("town-fresh")
    assert [p["concept"] for p in t["places"]] == list(math_check.TEACHABLE)
    assert all(not p["unlocked"] and p["need"] and p["teaser"] for p in t["places"])
    assert t["scrapbook"] == []
    s = get_scene("town-fresh", "carry")
    assert s["unlocked"] is False and s["answer"] is None and "Oops" in s["say"]


def test_half_star_is_not_enough_one_star_unlocks():
    sid = "town-threshold"
    s = get_session(sid)
    s.lumi_mastery["carry"] = 0.5
    assert not next(p for p in get_town(sid)["places"] if p["concept"] == "carry")["unlocked"]
    s.lumi_mastery["carry"] = 1.0
    assert next(p for p in get_town(sid)["places"] if p["concept"] == "carry")["unlocked"]


@pytest.mark.parametrize("language", ["en", "es", "vi"])
@pytest.mark.parametrize("concept", math_check.TEACHABLE)
def test_scenes_are_correct_and_fresh(concept, language):
    sid = f"town-scene-{concept}-{language}"
    get_session(sid).lumi_mastery[concept] = 2.0
    seen = set()
    for _ in range(5):
        sc = get_scene(sid, concept, language)
        assert sc["unlocked"] and "{" not in sc["say"]
        assert math_check.check(sc["problem"], sc["answer"]).is_correct  # SymPy-correct
        assert concept in math_check.concepts_of(sc["problem"])  # the taught skill, exactly
        assert sc["answer"] in sc["lines"][-1]  # the total is only stated at the end
        pt = sc["parts"]  # the digits the picture draws agree with SymPy
        assert str(pt["answer"]) == sc["answer"]
        if pt["op"] == "*":
            assert pt["seq"][-1] == pt["answer"] and len(pt["seq"]) == pt["a"]
        else:
            assert pt["tens"] * 10 + pt["ones"] == pt["answer"]
            assert pt["regroup"] == (concept in ("carry", "borrow"))
            if pt["op"] == "-" and pt["regroup"]:
                assert pt["borrow_ones"] - pt["b_digits"][1] == pt["ones"] and pt["borrow_tens"] - pt["b_digits"][0] == pt["tens"]
        seen.add(sc["problem"])
    assert len(seen) >= 2  # "Another customer!" gives new numbers


def test_teaser_is_a_verified_planted_mistake():
    s = get_session("town-teaser")
    for c in math_check.TEACHABLE:
        line = town._teaser("en", c, s)
        nums = [int(n) for n in re.findall(r"\d+", line)]
        a, b, wrong = nums[0], nums[1], nums[2]
        op = "×" if c == "mul" else ("−" if "−" in line else "+")
        expr = f"{a} {op} {b}".replace("−", "-")
        assert not math_check.check(expr, str(wrong)).is_correct


def test_town_is_read_only():
    sid = "town-readonly"
    s = get_session(sid)
    s.lumi_mastery["mul"] = 1.5
    s.teach_quotes["mul"] = ("concept", "you counted one group too many")
    before = (dict(s.lumi_mastery), dict(s.teach_quotes))
    t = get_town(sid)
    get_scene(sid, "mul")
    assert (dict(s.lumi_mastery), dict(s.teach_quotes)) == before
    assert t["scrapbook"] == [{"concept": "mul", "label": "times tables", "quote": "you counted one group too many", "stars": 1.5}]


def test_unknown_concept_rejected():
    r = client.post("/api/teach/scene", json={"session_id": "x", "language": "en", "concept": "fractions"})
    assert r.status_code == 422
