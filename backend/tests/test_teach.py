"""Teach Lumi mode in MOCK mode (teach-lumi-spec.md): gate, generation, outcomes, explain, demo, repairs, report."""
import os
import random
from pathlib import Path

os.environ["GEMINI_API_KEY"] = ""  # force mock mode

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import api  # noqa: E402
from app.services import math_check, teach  # noqa: E402
from app.services.session import get_session  # noqa: E402

SAMPLES = Path(__file__).resolve().parents[2] / "test-worksheets"
client = TestClient(api)

GOOD_EXPLANATION = {  # rule-based "concept" quality per concept
    "carry": "7 plus 8 is 15, more than 9, so the 1 goes to the tens",
    "borrow": "the top number is too small so you borrow a ten",
    "off_by_one": "you counted wrong, check it again carefully",
    "mul": "you counted one group too many",
}


def worksheet(sid, force=True, language="en"):
    r = client.post("/api/teach/worksheet", json={"session_id": sid, "language": language, "force": force})
    assert r.status_code == 200
    return r.json()


def turn(sid, wid, action, **kw):
    r = client.post("/api/teach/turn", json={"session_id": sid, "worksheet_id": wid, "action": action, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def truth(sid):
    return {p.id: p for p in get_session(sid).teach.problems}


def perfect_marks(sid):
    return [{"id": p.id, "mark": "circle", "correction": p.correct_answer} if p.planted else {"id": p.id, "mark": "check"}
            for p in truth(sid).values()]


# ---------- generation ----------

@pytest.mark.parametrize("concept", math_check.TEACHABLE)
def test_planted_problems_match_diagnose(concept):
    rng = random.Random(7)
    for i in range(200):
        p = teach._problem(1, concept, True, rng, set())
        assert not math_check.check(p.problem, p.lumi_answer).is_correct
        assert math_check.diagnose(p.problem, p.lumi_answer)[1] == concept
        ok = teach._problem(1, concept, False, rng, set())
        assert math_check.check(ok.problem, ok.lumi_answer).is_correct


def test_gate_blocks_fresh_session_then_force_works():
    w = worksheet("teach-gate", force=False)
    assert w["ready"] is False and w["turn"]["step"] == "practice_first"
    w = worksheet("teach-gate", force=True)
    assert w["ready"] and len(w["problems"]) == 5
    assert set(w["problems"][0]) == {"id", "problem", "lumi_answer"}  # no truth fields leak to the client
    planted = [p for p in truth("teach-gate").values() if p.planted]
    assert 2 <= len(planted) <= 3
    assert {p.concept for p in truth("teach-gate").values()} <= {"carry", "off_by_one"}


def test_gate_opens_after_help_mode():
    sid = "teach-gate-help"
    for name in ("worksheet-1.png", "worksheet-2.png"):
        with open(SAMPLES / name, "rb") as f:
            client.post("/api/grade", files={"image": (name, f, "image/png")}, data={"session_id": sid})
    assert "carry" in teach.ready_concepts(get_session(sid))
    w = worksheet(sid, force=False)
    assert w["ready"] and "carry" in w["concepts"]


# ---------- happy path ----------

def test_perfect_teacher_flow_raises_stars_and_reports():
    sid = "teach-happy"
    w = worksheet(sid)
    wid = w["worksheet_id"]
    t = turn(sid, wid, "check", marks=perfect_marks(sid))
    assert t["say"].startswith("You checked my whole page!")
    assert {o["outcome"] for o in t["outcomes"]} <= {"caught_fixed", "confirmed_ok"}
    taught = 0
    while t["step"] != "done":
        assert t["step"] == "explain"
        p = truth(sid)[t["focus_problem_id"]]
        assert p.lumi_answer in t["say"]
        t = turn(sid, wid, "explain", child_said=GOOD_EXPLANATION[p.concept])
        assert t["step"] == "demo" and t["demo"]["answer"]
        assert math_check.check(t["demo"]["problem"], t["demo"]["answer"]).is_correct  # SymPy-correct demo
        assert p.concept in math_check.concepts_of(t["demo"]["problem"])  # same concept, same shape
        assert t["demo"]["problem"] != p.problem
        t = turn(sid, wid, "confirm", agree=True)
        assert t["step"] == "next" and t["mastery_up"] == p.concept and t["emotion"] == "celebrating"
        taught += 1
        t = turn(sid, wid, "next")
    assert t["stats"]["caught"] == t["stats"]["planted"] == taught
    assert sum(t["mastery"].values()) == taught  # +1 star per "concept" explanation

    rep = client.post("/api/report", json={"session_id": sid, "language": "en"}).json()["teach"]
    assert rep["caught"] == taught and rep["planted"] == taught and rep["missed"] == 0
    assert rep["taught"] and rep["quotes"] and rep["explanations"]["concept"] == taught


def test_procedure_gets_one_why_followup():
    sid = "teach-why"
    wid = worksheet(sid)["worksheet_id"]
    t = turn(sid, wid, "check", marks=perfect_marks(sid))
    p = truth(sid)[t["focus_problem_id"]]
    t = turn(sid, wid, "explain", child_said="you have to carry it" if p.concept == "carry" else "you counted wrong")
    assert t["step"] == "explain" and t["emotion"] == "curious"  # the why-question
    t = turn(sid, wid, "explain", child_said="hmm")  # anything not incorrect → demo, keeps ½ star
    assert t["step"] == "demo"
    t = turn(sid, wid, "confirm", agree=False)
    assert "checked it twice" in t["say"]
    assert get_session(sid).lumi_mastery[p.concept] == 0.5


def test_chips_correct_and_distractor():
    sid = "teach-chips"
    wid = worksheet(sid)["worksheet_id"]
    t = turn(sid, wid, "check", marks=perfect_marks(sid))
    assert {c["id"] for c in t["chips"]} == {"c0", "c1", "c2"}
    t = turn(sid, wid, "explain", chip_id="c1")
    assert t["step"] == "explain" and t["emotion"] == "confused"
    assert not teach._affirms(t["say"], "en")
    t = turn(sid, wid, "explain", chip_id="c0")
    assert t["step"] == "demo"


def test_two_incorrect_explanations_role_switch_no_stars():
    sid = "teach-incorrect"
    wid = worksheet(sid)["worksheet_id"]
    t = turn(sid, wid, "check", marks=perfect_marks(sid))
    p = truth(sid)[t["focus_problem_id"]]
    turn(sid, wid, "explain", chip_id="c2")
    t = turn(sid, wid, "explain", chip_id="c1")
    assert t["step"] == "demo" and teach.TT["en"]["concepts"][p.concept]["rule"] in t["say"]
    turn(sid, wid, "confirm", agree=True)
    assert get_session(sid).lumi_mastery.get(p.concept, 0) == 0


# ---------- repair paths ----------

def test_wrong_fix_then_role_switch_hint_ladder():
    sid = "teach-fix"
    wid = worksheet(sid)["worksheet_id"]
    tr = truth(sid)
    target = next(p for p in tr.values() if p.planted)
    marks = [{"id": p.id, "mark": "circle", "correction": None} if p.id == target.id
             else ({"id": p.id, "mark": "circle", "correction": p.correct_answer} if p.planted else {"id": p.id, "mark": "check"})
             for p in tr.values()]
    t = turn(sid, wid, "check", marks=marks)
    while t["focus_problem_id"] != target.id:  # skip earlier problems quickly
        turn(sid, wid, "explain", chip_id="c0")
        turn(sid, wid, "confirm", agree=True)
        t = turn(sid, wid, "next")
    assert t["step"] == "fix"
    wrong = str(int(target.correct_answer) + 3)
    t = turn(sid, wid, "fix", answer=wrong)
    assert t["step"] == "fix" and wrong in t["say"] and target.correct_answer not in t["say"]
    t = turn(sid, wid, "fix", answer=wrong)
    assert t["step"] == "help" and t["help_level"] == 1 and "help you" in t["say"]
    for level in (2, 3):
        t = turn(sid, wid, "fix", answer=wrong)
        assert t["help_level"] == level and target.correct_answer not in t["say"]
    t = turn(sid, wid, "fix", answer=wrong)
    assert t["help_level"] == 4 and target.correct_answer in t["say"]  # reveal only at level 4
    t = turn(sid, wid, "fix", answer=target.correct_answer)
    assert t["step"] == "explain"
    turn(sid, wid, "explain", child_said=GOOD_EXPLANATION[target.concept])
    before = get_session(sid).lumi_mastery.get(target.concept, 0)
    turn(sid, wid, "confirm", agree=True)
    assert get_session(sid).lumi_mastery.get(target.concept, 0) == before  # helped → no star


def test_missed_mistake_find_nudges():
    sid = "teach-missed"
    wid = worksheet(sid)["worksheet_id"]
    tr = truth(sid)
    marks = [{"id": p.id, "mark": "check"} for p in tr.values()]  # the child misses everything
    t = turn(sid, wid, "check", marks=marks)
    assert t["step"] == "find" and "one more" in t["say"]
    st = get_session(sid).teach
    target = st.get(st.current)
    wrong_tap = next(p.id for p in tr.values() if not p.planted)
    t = turn(sid, wid, "find", problem_id=wrong_tap)
    assert target.id in t["highlight_ids"] and len(t["highlight_ids"]) == 2
    t = turn(sid, wid, "find", problem_id=wrong_tap)
    assert t["highlight_ids"] == [target.id]
    t = turn(sid, wid, "find", problem_id=target.id)
    assert t["step"] == "fix"
    t = turn(sid, wid, "fix", answer=target.correct_answer)
    assert t["step"] == "explain"


def test_false_alarm_asks_for_proof():
    sid = "teach-fa"
    wid = worksheet(sid)["worksheet_id"]
    tr = truth(sid)
    ok = next(p for p in tr.values() if not p.planted)
    marks = perfect_marks(sid)
    for m in marks:
        if m["id"] == ok.id:
            m.update(mark="circle", correction="1")
    t = turn(sid, wid, "check", marks=marks)
    assert not t["say"].startswith("You checked my whole page")
    while t["focus_problem_id"] != ok.id:
        turn(sid, wid, "explain", chip_id="c0")
        turn(sid, wid, "confirm", agree=True)
        t = turn(sid, wid, "next")
    assert t["step"] == "sure" and ok.correct_answer in t["say"]
    t = turn(sid, wid, "confirm", agree=True)
    assert t["step"] == "next" and t["emotion"] == "happy"


# ---------- robustness + guards ----------

def test_stale_worksheet_and_out_of_order_actions():
    sid = "teach-stale"
    wid = worksheet(sid)["worksheet_id"]
    r = client.post("/api/teach/turn", json={"session_id": sid, "worksheet_id": "nope", "action": "next"})
    assert r.status_code == 409
    first = turn(sid, wid, "explain", child_said="hi")  # before "check": repeats the intro turn
    assert first["step"] == "mark"
    t = turn(sid, wid, "check", marks=perfect_marks(sid))
    assert turn(sid, wid, "confirm", agree=True) == t  # wrong action for the step → same turn


def test_llm_affirmation_is_replaced(monkeypatch):
    from app.schemas import TeachExplainLLM

    sid = "teach-guard"
    wid = worksheet(sid)["worksheet_id"]
    t = turn(sid, wid, "check", marks=perfect_marks(sid))

    async def fake_generate(schema, text, **kw):
        return TeachExplainLLM(quality="incorrect", reaction="Yes, that's right, great job!", quote=None)

    monkeypatch.setattr(teach.llm, "enabled", lambda: True)
    monkeypatch.setattr(teach.llm, "generate", fake_generate)
    t = turn(sid, wid, "explain", child_said="you add the tens first")
    assert t["step"] == "explain" and not teach._affirms(t["say"], "en")
    assert "another way" in t["say"]


@pytest.mark.parametrize("concept,text,quality", [
    ("carry", "you forgot to carry the one", "procedure"),
    ("carry", "8 and 7 is 15 so one goes to the tens", "concept"),
    ("carry", "you need to borrow", "incorrect"),
    ("carry", "it's wrong", "vague"),
    ("carry", "se te olvidó llevar uno", "procedure"),
    ("carry", "quên nhớ sang hàng chục", "concept"),
    ("borrow", "you have to borrow", "procedure"),
    ("borrow", "2 is too small so you borrow a ten", "concept"),
    ("mul", "you counted one group too many", "concept"),
    ("off_by_one", "you counted one too many", "procedure"),
])
def test_rule_classifier(concept, text, quality):
    assert teach.classify_rules(concept, text) == quality


def test_demo_steps_spanish_and_vietnamese():
    assert teach.demo_steps("26 + 59", "es")[0] == "Primero las unidades: 6 más 9 es 15."
    assert teach.demo_steps("52 - 17", "vi")[0].startswith("Đầu tiên hàng đơn vị: 2 nhỏ hơn 7")
    assert "6, 12, 18" in teach.demo_steps("3 × 6", "en")[0]
