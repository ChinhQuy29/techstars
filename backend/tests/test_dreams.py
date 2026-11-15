"""Lumi's dream: stories change the wording of a problem, never its math (docs/12-dreams.md)."""
import os
import random
import re

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402
from app.services import concepts as cx  # noqa: E402
from app.services import dreams, teach  # noqa: E402
from app.services.concepts import ALL_CONCEPTS, NEW_CONCEPTS  # noqa: E402
from app.services.session import get_session  # noqa: E402

client = TestClient(api)
LANGS = ("en", "es", "vi")
NUM = re.compile(r"\d+")


def _ready_session(name: str):
    s = get_session(name)
    s.saved_ready = set(ALL_CONCEPTS)
    return s


@pytest.mark.parametrize("lang", LANGS)
@pytest.mark.parametrize("concept", ALL_CONCEPTS)
def test_every_problem_gets_a_story_with_no_new_numbers(concept, lang):
    for seed in range(40):
        rng = random.Random(seed)
        planted = seed % 2 == 0
        p = teach._problem(1, concept, planted, rng, set(), lang, "astronaut")
        assert p.story, (concept, lang)
        # Every number in the story is already on the page, so the story can't add or reveal anything.
        assert set(NUM.findall(p.story)) <= set(NUM.findall(p.problem)), (p.story, p.problem)
        assert "{" not in p.story and "}" not in p.story


@pytest.mark.parametrize("concept", ALL_CONCEPTS)
def test_the_dream_never_changes_the_math(concept):
    for seed in range(30):
        plain = teach._problem(1, concept, seed % 2 == 0, random.Random(seed), set(), "en")
        dreamy = teach._problem(1, concept, seed % 2 == 0, random.Random(seed), set(), "en", "astronaut")
        assert plain.story is None
        assert (dreamy.lumi_answer, dreamy.correct_answer, dreamy.planted, dreamy.kind) == \
            (plain.lumi_answer, plain.correct_answer, plain.planted, plain.kind)
        if concept != "graphs":
            assert dreamy.problem == plain.problem


def test_graph_pictures_become_space_pictures():
    fruit = set(dreams.GRAPH_ICONS["astronaut"])
    for seed in range(30):
        item = dreams.dress_item(cx.make("graphs", random.Random(seed), "en"), "astronaut")
        labels = [b["label"] for b in item.visual["bars"]]
        assert not fruit & set(labels) and not any(f in item.problem for f in fruit)
        assert item.data["e1"] in labels and item.data["e2"] in labels
        assert cx.diagnose(item, item.wrong) == "graphs"  # still the same planted mistake
        assert all(f not in " ".join(cx.steps(item, "en")) for f in fruit)  # Lumi's spoken steps match the chart


def test_unknown_dream_is_ignored():
    assert dreams.valid_dream("pirate") is None and dreams.valid_dream(None) is None
    assert dreams.story("pirate", "carry", "38 + 27", {}, "en") is None
    assert dreams.intro("pirate", "en", "intro") is None


def test_every_dream_has_every_line_in_every_language():
    keys = {"add", "sub", "mul", *NEW_CONCEPTS}
    for d in dreams.DREAMS:
        for lang in LANGS:
            assert set(dreams.STORIES[d][lang]) == keys, (d, lang)
            assert set(dreams.INTROS[d][lang]) == {"intro", "review_intro"}


def test_worksheet_api_with_a_dream():
    sid = "dream-api"
    _ready_session(sid)
    w = client.post("/api/teach/worksheet", json={"session_id": sid, "language": "en", "dream": "astronaut"}).json()
    assert w["ready"] and all(p["story"] for p in w["problems"])
    assert "astronaut" in w["turn"]["say"]
    plain = client.post("/api/teach/worksheet", json={"session_id": sid, "language": "en"}).json()
    assert all(p["story"] is None for p in plain["problems"]) and "astronaut" not in plain["turn"]["say"]
    bad = client.post("/api/teach/worksheet", json={"session_id": sid, "language": "en", "dream": "<b>x</b>"})
    assert bad.status_code == 200 and all(p["story"] is None for p in bad.json()["problems"])


def test_demo_sheet_and_lumis_try_keep_the_dream():
    sid = "dream-demo"
    _ready_session(sid)
    w = client.post("/api/teach/worksheet",
                    json={"session_id": sid, "language": "es", "demo": True, "dream": "astronaut"}).json()
    assert all(p["story"] for p in w["problems"]) and "astronauta" in w["turn"]["say"]
    s = get_session(sid)
    p = next(p for p in s.teach.problems if p.planted)
    turn = teach._start_demo(s, p, "es", "", 0.0)
    assert turn.demo and turn.demo.story
