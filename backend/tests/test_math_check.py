import random

import pytest

from app.services import math_check as mc


@pytest.mark.parametrize("problem,answer,ok", [
    ("47 + 38", "85", True),
    ("47 + 38", "75", False),
    ("9 × 6", "54", True),
    ("52 − 17", "35", True),
    ("36 ÷ 4", "9", True),
    ("17 ÷ 5", "3 R2", True),
    ("17 ÷ 5", "3r2", True),
    ("17 ÷ 5", "3", False),
    ("8 x 7", "56", True),
])
def test_check(problem, answer, ok):
    assert mc.check(problem, answer).is_correct is ok


def test_blank_answer_is_unanswered():
    r = mc.check("2 + 2", None)
    assert r.answered is False and r.is_correct is False and r.correct_answer == "4"


def test_rejects_non_arithmetic():
    assert mc.check("__import__('os')", "1").correct_answer is None


def test_diagnose_carry_and_borrow():
    assert mc.diagnose("47 + 38", "75")[1] == "carry"
    assert mc.diagnose("52 - 17", "45")[1] == "borrow"
    assert mc.diagnose("9 * 6", "55")[1] == "off_by_one"


def test_practice_problems_are_correct():
    rng = random.Random(1)
    for tag in ("carry", "borrow", "mul", "div"):
        expr, ans = mc.practice_for_concept(tag, rng)
        assert mc.check(expr, ans).is_correct
