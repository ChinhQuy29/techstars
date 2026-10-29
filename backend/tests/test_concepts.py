"""The newer Teach concepts (docs/02-learning-design.md): generation contract, checking, warm-up gate,
the concept picker, chosen-concept worksheets, full teaching flows and unlock notifications."""
import os
import random
import re

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402
from app.services import concepts as cx  # noqa: E402
from app.services import teach  # noqa: E402
from app.services.session import get_session  # noqa: E402

client = TestClient(api)
LANGS = ("en", "es", "vi")

GOOD_EXPLANATION = {  # rule-based "concept" quality (English)
    "share": "each group has to get the same equal amount",
    "patterns": "the numbers jump by the same amount each time",
    "big_numbers": "the digit is in the thousands place so it is worth more",
    "time": "an hour only has 60 minutes",
    "measure": "the pencil does not start at zero",
    "shapes": "you forgot the faces hiding at the back",
    "fractions": "more pieces means each piece is smaller",
    "graphs": "you have to compare both bars and find the difference",
}
WRONG_EXPLANATION = {
    "share": "you should add them", "patterns": "you forgot to carry", "big_numbers": "you forgot to borrow",
    "time": "clocks go to 100 minutes", "measure": "you have to times them", "shapes": "you counted the corners",
    "fractions": "you forgot to carry the one", "graphs": "add the two bars together",
}


def post(path, **body):
    r = client.post(f"/api/{path}", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def warm_up(sid, concept, lang="en", right=True):
    w = post("teach/warmup", session_id=sid, language=lang, concept=concept)
    answers = get_session(sid).warmup["answers"]
    if not right:
        answers = [answers[0], "999" if concept != "fractions" else "="]
    return post("teach/warmup/check", session_id=sid, language=lang, warmup_id=w["warmup_id"], answers=answers)


# ---------- the generation contract ----------

@pytest.mark.parametrize("concept", cx.NEW_CONCEPTS)
@pytest.mark.parametrize("lang", LANGS)
def test_every_problem_has_one_right_answer_and_a_diagnosable_mistake(concept, lang):
    rng = random.Random(f"{concept}-{lang}")
    for _ in range(80):
        item = cx.make(concept, rng, lang)  # make() itself asserts the contract
        assert "?" in item.problem and "{" not in item.problem
        assert cx.is_correct(item.kind, item.answer, item.answer)
        assert not cx.is_correct(item.kind, item.answer, item.wrong)
        assert cx.diagnose(item, item.wrong) == concept
        assert cx.diagnose(item, item.answer) is None
        for line in cx.steps(item, lang) + [cx.hint(item, lang, n) for n in (1, 2, 3)]:
            assert "{" not in line and line.strip()


def test_answers_are_computed_not_guessed():
    rng = random.Random(1)
    for _ in range(100):
        s = cx.make("share", rng, "en")
        assert int(s.answer) * s.data["b"] == s.data["a"]
        t = cx.make("time", rng, "en")
        h, m = map(int, t.answer.split(":"))
        assert (h * 60 + m) - (t.data["h"] * 60 + t.data["mm"]) == t.data["m"] and m < 60
        f = cx.make("fractions", rng, "en")
        a, b = f.data["a"], f.data["b"]
        assert f.answer == ("<" if 1 / a < 1 / b else ">")
        g = cx.make("graphs", rng, "en")
        bars = {x["label"]: x["value"] for x in g.visual["bars"]}
        assert int(g.answer) == bars[g.data["e1"]] - bars[g.data["e2"]]
        r = cx.make("measure", rng, "en")
        assert int(r.answer) == r.visual["end"] - r.visual["start"] and r.visual["start"] > 0
        n = cx.make("big_numbers", rng, "en")
        digits = str(n.data["n"])
        assert digits[len(digits) - 1 - n.data["k"]] == str(n.data["d"])
        assert int(n.answer) == n.data["d"] * 10 ** n.data["k"]


def test_answer_formats_the_keypad_can_send():
    assert cx.is_correct("time", "7:15", "7:15") and cx.is_correct("time", "7:15", "715")
    assert not cx.is_correct("time", "7:15", "6:75")
    assert cx.is_correct("number", "80000", "80,000") and cx.is_correct("number", "80000", "80.000")
    assert cx.is_correct("compare", "<", "<") and not cx.is_correct("compare", "<", ">")
    assert not cx.is_correct("number", "6", "") and not cx.is_correct("number", "6", "six")


def test_texts_and_keywords_cover_every_language():
    for c in cx.NEW_CONCEPTS:
        en = set(cx.TEXT["en"][c])
        for lang in LANGS:
            assert set(cx.TEXT[lang][c]) == en, (lang, c)
            assert len(cx.TEXT[lang][c]["chips"]) == 3
            assert set(teach.TT[lang]["concepts"][c]) == set(teach.TT["en"]["concepts"]["carry"])
        assert set(cx.RULES[c]) == {"wrong", "why", "action"}
        assert teach.classify_rules(c, GOOD_EXPLANATION[c]) == "concept", c
        assert teach.classify_rules(c, WRONG_EXPLANATION[c]) == "incorrect", c
        assert teach.classify_rules(c, "") == "vague"


# ---------- the concept picker and the warm-up gate ----------

def test_menu_lists_every_concept_with_its_gate():
    menu = post("teach/concepts", session_id="cx-menu", language="es")["concepts"]
    assert [m["concept"] for m in menu] == list(cx.ALL_CONCEPTS)
    assert all(not m["ready"] for m in menu)
    assert {m["gate"] for m in menu if m["concept"] in cx.NEW_CONCEPTS} == {"warmup"}
    assert {m["gate"] for m in menu if m["concept"] not in cx.NEW_CONCEPTS} == {"help"}
    assert next(m for m in menu if m["concept"] == "fractions")["label"] == "fracciones"


def test_new_concept_needs_a_warmup_then_teaches():
    sid = "cx-warm"
    w = post("teach/worksheet", session_id=sid, language="en", concept="time")
    assert w["ready"] is False and w["needs"] == "warmup"
    assert warm_up(sid, "time", right=False)["passed"] is False
    assert not next(m for m in post("teach/concepts", session_id=sid)["concepts"] if m["concept"] == "time")["ready"]
    passed = warm_up(sid, "time")
    assert passed["passed"] and passed["results"] == [True, True]
    w = post("teach/worksheet", session_id=sid, language="en", concept="time")
    assert w["ready"] and all(p["kind"] in ("number", "time", "compare") for p in w["problems"])
    planted = [p for p in get_session(sid).teach.problems if p.planted]
    assert 2 <= len(planted) <= 3 and {p.concept for p in planted} == {"time"}


def test_warmup_answers_never_reach_the_client_and_stale_ids_are_rejected():
    sid = "cx-warm-safe"
    w = post("teach/warmup", session_id=sid, concept="fractions")
    assert all(set(p) == {"id", "problem", "kind", "visual"} for p in w["problems"])
    r = client.post("/api/teach/warmup/check", json={"session_id": sid, "warmup_id": "nope", "answers": ["<", "<"]})
    assert r.status_code == 409
    assert client.post("/api/teach/warmup", json={"session_id": sid, "concept": "carry"}).status_code == 400
    assert client.post("/api/teach/worksheet", json={"session_id": sid, "concept": "magic"}).status_code == 400


def test_original_concepts_still_need_help_mode():
    w = post("teach/worksheet", session_id="cx-old", language="en", concept="carry")
    assert w["ready"] is False and w["needs"] == "help"


# ---------- teaching a new concept end to end ----------

def _teach_one(sid, concept, lang="en"):
    warm_up(sid, concept, lang)
    w = post("teach/worksheet", session_id=sid, language=lang, concept=concept)
    wid = w["worksheet_id"]
    probs = {p.id: p for p in get_session(sid).teach.problems}
    marks = [{"id": p.id, "mark": "circle", "correction": p.correct_answer} if p.planted else {"id": p.id, "mark": "check"}
             for p in probs.values()]
    t = post("teach/turn", session_id=sid, language=lang, worksheet_id=wid, action="check", marks=marks)
    for _ in range(40):
        if t["step"] == "done":
            return t
        if t["step"] == "explain":
            text = GOOD_EXPLANATION[concept] if lang == "en" else ""
            t = post("teach/turn", session_id=sid, language=lang, worksheet_id=wid, action="explain",
                     **({"child_said": text} if text else {"chip_id": "c0"}))
        elif t["step"] == "demo":
            assert t["demo"]["answer"] and t["demo"]["steps"] and "?" in t["demo"]["problem"]
            t = post("teach/turn", session_id=sid, language=lang, worksheet_id=wid, action="confirm", agree=True)
        else:
            assert t["step"] == "next", t
            t = post("teach/turn", session_id=sid, language=lang, worksheet_id=wid, action="next")
    raise AssertionError("flow did not finish")


@pytest.mark.parametrize("concept", cx.NEW_CONCEPTS)
def test_teaching_a_new_concept_raises_its_stars(concept):
    sid = f"cx-flow-{concept}"
    t = _teach_one(sid, concept)
    assert t["mastery"][concept] >= 2.0  # 2-3 planted mistakes, a full star each for a "concept" explanation
    assert len(t["mastery"]) == len(cx.ALL_CONCEPTS)


@pytest.mark.parametrize("lang", ["es", "vi"])
def test_new_concepts_in_spanish_and_vietnamese(lang):
    t = _teach_one(f"cx-flow-{lang}", "fractions", lang)
    assert t["mastery"]["fractions"] >= 1.0  # chips: ½ star each


def test_wrong_fixes_switch_to_concept_hints_and_never_leak_the_answer():
    sid = "cx-hints"
    warm_up(sid, "measure")
    w = post("teach/worksheet", session_id=sid, concept="measure")
    probs = {p.id: p for p in get_session(sid).teach.problems}
    first = next(p for p in probs.values() if p.planted)
    marks = [{"id": p.id, "mark": "circle"} if p.planted else {"id": p.id, "mark": "check"} for p in probs.values()]
    t = post("teach/turn", session_id=sid, worksheet_id=w["worksheet_id"], action="check", marks=marks)
    assert t["focus_problem_id"] == first.id and t["step"] == "fix"
    for _ in range(4):  # wrong, wrong (role switch → hint 1), hint 2, hint 3: never the answer
        t = post("teach/turn", session_id=sid, worksheet_id=w["worksheet_id"], action="fix", answer="99")
        assert re.search(rf"\b{first.correct_answer} cm\b", t["say"]) is None
    assert t["step"] == "help" and t["help_level"] == 3


# ---------- unlock notifications ----------

def test_a_new_town_place_is_announced_once():
    sid = "cx-unlock"
    s = get_session(sid)
    w = post("teach/worksheet", session_id=sid, force=True)
    wid = w["worksheet_id"]
    probs = {p.id: p for p in s.teach.problems}
    marks = [{"id": p.id, "mark": "circle", "correction": p.correct_answer} if p.planted else {"id": p.id, "mark": "check"}
             for p in probs.values()]
    t = post("teach/turn", session_id=sid, worksheet_id=wid, action="check", marks=marks)
    seen = []
    while t["step"] != "done":
        if t["step"] == "explain":
            c = probs[t["focus_problem_id"]].concept
            said = {"carry": "15 is more than 9 so the 1 goes to the tens", "off_by_one": "check it again carefully"}[c]
            t = post("teach/turn", session_id=sid, worksheet_id=wid, action="explain", child_said=said)
        elif t["step"] == "demo":
            t = post("teach/turn", session_id=sid, worksheet_id=wid, action="confirm", agree=True)
            seen += t["unlocks"]
            if t["unlocks"]:  # a duplicate tap repeats the same turn, notification included
                again = post("teach/turn", session_id=sid, worksheet_id=wid, action="confirm", agree=True)
                assert again["unlocks"] == t["unlocks"]
        else:
            t = post("teach/turn", session_id=sid, worksheet_id=wid, action="next")
            assert t["unlocks"] == []
    assert seen and all(u["kind"] == "place" for u in seen)
    assert len({u["key"] for u in seen}) == len(seen)  # each place announced once


def test_saved_progress_keeps_new_concepts():
    from app.services import profile
    s = get_session("cx-save")
    s.lumi_mastery["graphs"] = 1.5
    s.warm_ready.add("graphs")
    snap = profile.snapshot(s)
    assert snap["mastery"]["graphs"] == 1.5 and "graphs" in snap["ready"]
