"""Lumi's dream: problems are asked as short stories; the math never changes (docs/12-dreams.md)."""
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


def lumi_answer_not_in_story(p) -> bool:
    """The answer only appears where "?" is: never written into the sentence itself."""
    return p.correct_answer not in NUM.findall(p.story) or p.correct_answer in NUM.findall(p.problem)


def _ready_session(name: str):
    s = get_session(name)
    s.saved_ready = set(ALL_CONCEPTS)
    return s


@pytest.mark.parametrize("dream", dreams.DREAMS)
@pytest.mark.parametrize("lang", LANGS)
@pytest.mark.parametrize("concept", ALL_CONCEPTS)
def test_every_problem_gets_a_story_with_no_new_numbers(concept, lang, dream):
    for seed in range(40):
        rng = random.Random(seed)
        planted = seed % 2 == 0
        p = teach._problem(1, concept, planted, rng, set(), lang, dream)
        assert p.story, (concept, lang)
        # Every number in the story comes from the math problem, so the story can't add or reveal anything.
        assert set(NUM.findall(p.story)) <= set(NUM.findall(p.problem)), (p.story, p.problem)
        assert "{" not in p.story and "}" not in p.story
        assert p.story.count("?") == 1, p.story  # the one place Lumi's answer goes
        assert len(p.story) <= 90, (len(p.story), p.story)  # short enough for a phone card
        assert lumi_answer_not_in_story(p), (p.story, p.lumi_answer)


@pytest.mark.parametrize("dream", dreams.DREAMS)
@pytest.mark.parametrize("concept", ALL_CONCEPTS)
def test_the_dream_never_changes_the_math(concept, dream):
    for seed in range(30):
        plain = teach._problem(1, concept, seed % 2 == 0, random.Random(seed), set(), "en")
        dreamy = teach._problem(1, concept, seed % 2 == 0, random.Random(seed), set(), "en", dream)
        assert plain.story is None
        assert (dreamy.lumi_answer, dreamy.correct_answer, dreamy.planted, dreamy.kind) == \
            (plain.lumi_answer, plain.correct_answer, plain.planted, plain.kind)
        if concept != "graphs":
            assert dreamy.problem == plain.problem


@pytest.mark.parametrize("dream", dreams.DREAMS)
def test_graph_pictures_match_the_dream(dream):
    fruit = set(dreams.GRAPH_ICONS[dream])
    for seed in range(30):
        item = dreams.dress_item(cx.make("graphs", random.Random(seed), "en"), dream)
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
    assert w["ready"] and "astronaut" in w["turn"]["say"]
    assert "story" not in w["problems"][0]
    s = get_session(sid)
    for out, st in zip(w["problems"], s.teach.problems):
        assert out["problem"] == st.story and out["problem"].count("?") == 1  # only the story text is shown
    plain = client.post("/api/teach/worksheet", json={"session_id": sid, "language": "en"}).json()
    assert "astronaut" not in plain["turn"]["say"]
    assert all(p["problem"] == st.problem for p, st in zip(plain["problems"], get_session(sid).teach.problems))
    bad = client.post("/api/teach/worksheet", json={"session_id": sid, "language": "en", "dream": "<b>x</b>"})
    assert bad.status_code == 200 and all(st.story is None for st in get_session(sid).teach.problems)


def test_demo_sheet_and_lumis_try_keep_the_dream():
    sid = "dream-demo"
    _ready_session(sid)
    w = client.post("/api/teach/worksheet",
                    json={"session_id": sid, "language": "es", "demo": True, "dream": "astronaut"}).json()
    assert all("?" in p["problem"] for p in w["problems"]) and "astronauta" in w["turn"]["say"]
    s = get_session(sid)
    p = next(p for p in s.teach.problems if p.planted)
    turn = teach._start_demo(s, p, "es", "", 0.0)
    assert turn.demo and turn.demo.problem.count("?") == 1 and "+" not in turn.demo.problem


def _key(p) -> str:
    m = dreams._EXPR.match(p.problem)
    return {"+": "add", "-": "sub", "×": "mul"}[m.group(2)] if m else p.concept


@pytest.mark.parametrize("dream", dreams.DREAMS)
@pytest.mark.parametrize("lang", LANGS)
@pytest.mark.parametrize("concept", ALL_CONCEPTS)
def test_every_version_is_short_and_safe(concept, lang, dream):
    for seed in range(12):
        p = teach._problem(1, concept, seed % 2 == 0, random.Random(seed), set(), lang, dream)
        key = _key(p)
        versions = dreams.STORIES[dream][lang][key]
        data = p.data if concept in NEW_CONCEPTS else {}
        for i in range(len(versions)):
            taken = {f"story:{key}:{j}" for j in range(len(versions)) if j != i}
            text = dreams.story(dream, concept, p.problem, data, lang, taken)
            assert text.count("?") == 1 and len(text) <= 90, (len(text), text)
            assert set(NUM.findall(text)) <= set(NUM.findall(p.problem)), (text, p.problem)
            assert "{" not in text


def test_each_kind_has_several_versions_in_every_language():
    for d in dreams.DREAMS:
        counts = {k: len(v) for k, v in dreams.STORIES[d]["en"].items()}
        assert min(counts.values()) >= 3
        for lang in LANGS:
            assert {k: len(v) for k, v in dreams.STORIES[d][lang].items()} == counts, lang


@pytest.mark.parametrize("dream", dreams.DREAMS)
def test_a_worksheet_never_repeats_a_story_version(dream):
    for seed in range(20):
        s = _ready_session(f"dream-variety-{dream}-{seed}")
        s.dream = dream
        w = teach.new_worksheet(s, "en", False, rng=random.Random(seed))
        stories = [p.story for p in s.teach.problems]
        assert len(set(stories)) == len(stories), stories
        assert w.ready


def test_baker_worksheet_reads_like_a_bakery():
    sid = "dream-baker"
    _ready_session(sid)
    w = client.post("/api/teach/worksheet", json={"session_id": sid, "language": "en", "dream": "baker"}).json()
    assert w["ready"] and "baker" in w["turn"]["say"]
    assert all(p["problem"].count("?") == 1 for p in w["problems"])


def test_dreams_do_not_share_stories():
    a, b = dreams.STORIES["astronaut"], dreams.STORIES["baker"]
    for lang in LANGS:
        for key in a[lang]:
            assert not set(a[lang][key]) & set(b[lang][key]), (lang, key)


def test_doctor_is_offered_but_still_plain_math():
    # The app lets children pick "doctor"; until its stories are written and reviewed, its sheets are plain math.
    assert dreams.valid_dream("doctor") is None
    sid = "dream-doctor"
    _ready_session(sid)
    w = client.post("/api/teach/worksheet", json={"session_id": sid, "language": "en", "dream": "doctor"}).json()
    assert w["ready"] and all(st.story is None for st in get_session(sid).teach.problems)
