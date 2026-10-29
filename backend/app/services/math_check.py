"""SymPy grading. This module — never the LLM — decides what is correct."""
from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Optional

import sympy
from sympy.parsing.sympy_parser import parse_expr, standard_transformations

_ALLOWED = re.compile(r"^[0-9+\-*/(). ]+$")
_REMAINDER = re.compile(r"^\s*(-?\d+)\s*(?:r|R|rem|remainder)\s*(\d+)\s*$")


def normalize_expression(text: str) -> str:
    """Map child/worksheet notation to a plain arithmetic expression."""
    s = text.strip()
    s = s.split("=")[0]
    for src, dst in (("×", "*"), ("x", "*"), ("X", "*"), ("·", "*"), ("÷", "/"), (":", "/"),
                     ("−", "-"), ("–", "-"), ("—", "-")):
        s = s.replace(src, dst)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def evaluate(expression: str) -> sympy.Expr:
    expr = normalize_expression(expression)
    if not expr or not _ALLOWED.match(expr):
        raise ValueError(f"unsupported expression: {expression!r}")
    # evaluate=True on a whitelisted, digits-and-operators-only string.
    return parse_expr(expr, transformations=standard_transformations, evaluate=True)


def operator_of(expression: str) -> Optional[str]:
    expr = normalize_expression(expression)
    for op in "*/+":
        if op in expr:
            return op
    if "-" in expr.lstrip("-"):
        return "-"
    return None


def operands(expression: str) -> Optional[tuple[int, int]]:
    nums = re.findall(r"\d+", normalize_expression(expression))
    if len(nums) != 2:
        return None
    return int(nums[0]), int(nums[1])


def format_answer(expression: str, value: sympy.Expr) -> str:
    if value.is_integer:
        return str(int(value))
    op, ab = operator_of(expression), operands(expression)
    if op == "/" and ab and ab[1] != 0:
        q, r = divmod(ab[0], ab[1])
        return f"{q} R{r}"
    return str(sympy.nsimplify(value))


def parse_child_answer(answer: str) -> Optional[tuple[sympy.Expr, Optional[int]]]:
    """Returns (value, remainder) or None if unparseable."""
    a = answer.strip().replace(",", "").replace(" ", "") if answer else ""
    if not a:
        return None
    m = _REMAINDER.match(answer.strip())
    if m:
        return sympy.Integer(int(m.group(1))), int(m.group(2))
    a = a.replace("−", "-")
    if re.fullmatch(r"-?\d+(\.\d+)?", a):
        return sympy.nsimplify(a), None
    if re.fullmatch(r"-?\d+/\d+", a):
        n, d = a.split("/")
        return sympy.Rational(int(n), int(d)), None
    return None


@dataclass
class CheckResult:
    correct_answer: Optional[str]
    is_correct: bool
    answered: bool


def check(problem: str, child_answer: Optional[str]) -> CheckResult:
    try:
        value = evaluate(problem)
    except Exception:
        return CheckResult(None, False, bool(child_answer))
    correct = format_answer(problem, value)
    if not child_answer or not child_answer.strip():
        return CheckResult(correct, False, False)
    parsed = parse_child_answer(child_answer)
    if parsed is None:
        return CheckResult(correct, False, True)
    child_value, remainder = parsed
    if remainder is not None:
        ab = operands(problem)
        ok = bool(ab and ab[1] and divmod(ab[0], ab[1]) == (int(child_value), remainder))
        return CheckResult(correct, ok, True)
    return CheckResult(correct, sympy.simplify(child_value - value) == 0, True)


# ---------- rule-based diagnosis of classic mistakes (no LLM) ----------

def _add_no_carry(a: int, b: int) -> int:
    da, db = str(a)[::-1], str(b)[::-1]
    out = []
    for i in range(max(len(da), len(db))):
        x = int(da[i]) if i < len(da) else 0
        y = int(db[i]) if i < len(db) else 0
        out.append(str((x + y) % 10))
    return int("".join(reversed(out)))


def _sub_smaller_from_larger(a: int, b: int) -> int:
    da, db = str(a)[::-1], str(b)[::-1]
    out = []
    for i in range(len(da)):
        x = int(da[i])
        y = int(db[i]) if i < len(db) else 0
        out.append(str(abs(x - y)))
    return int("".join(reversed(out)))


CONCEPTS = {
    "carry": "carrying in addition",
    "borrow": "borrowing in subtraction",
    "add": "addition facts",
    "sub": "subtraction facts",
    "mul": "multiplication facts",
    "div": "division facts",
    "off_by_one": "careful counting (off by one)",
    "share": "sharing into equal groups (division)",
    "patterns": "number patterns and skip counting",
    "big_numbers": "place value in big numbers",
    "time": "adding time (60 minutes in an hour)",
    "measure": "measuring length with a ruler",
    "shapes": "faces of 3D shapes",
    "fractions": "comparing unit fractions",
    "graphs": "reading bar graphs",
}


def diagnose(problem: str, child_answer: Optional[str]) -> tuple[Optional[str], str]:
    """Returns (human-readable error step or None, concept tag)."""
    op, ab = operator_of(problem), operands(problem)
    tag = {"+": "add", "-": "sub", "*": "mul", "/": "div"}.get(op or "", "add")
    parsed = parse_child_answer(child_answer or "")
    if not ab or parsed is None or parsed[1] is not None:
        return None, tag
    a, b = ab
    child = int(parsed[0]) if parsed[0].is_integer else None
    if child is None:
        return None, tag
    try:
        correct = int(evaluate(problem))
    except Exception:
        return None, tag
    if op == "+" and child == _add_no_carry(a, b) and child != correct:
        return "forgot to carry the 1 from the ones column", "carry"
    if op == "-" and a >= b and child == _sub_smaller_from_larger(a, b) and child != correct:
        return "subtracted the smaller digit from the bigger one instead of borrowing", "borrow"
    if abs(child - correct) == 1:
        return "counted one too many or one too few", "off_by_one"
    if op == "*" and ab and child in (a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b):
        return "skip-counted one group too many or too few", "mul"
    return None, tag


def similar_problem(problem: str, rng: Optional[random.Random] = None) -> tuple[str, str]:
    """A fresh practice problem of the same shape. Answer computed by SymPy."""
    rng = rng or random.Random()
    op, ab = operator_of(problem) or "+", operands(problem) or (10, 10)
    digits = max(len(str(ab[0])), 1)
    lo, hi = 10 ** (digits - 1), 10 ** digits - 1
    if op == "+":
        a, b = rng.randint(lo, hi), rng.randint(max(lo, 2), hi)
        expr = f"{a} + {b}"
    elif op == "-":
        a, b = sorted((rng.randint(lo, hi), rng.randint(max(lo, 1), hi)), reverse=True)
        expr = f"{a} - {b}"
    elif op == "*":
        expr = f"{rng.randint(2, 9)} × {rng.randint(2, 9)}"
    else:
        b, q = rng.randint(2, 9), rng.randint(2, 9)
        expr = f"{b * q} ÷ {b}"
    return expr, format_answer(expr, evaluate(expr))


def practice_for_concept(tag: str, rng: random.Random) -> tuple[str, str]:
    seeds = {
        "carry": "47 + 38", "borrow": "52 - 17", "add": "23 + 14", "sub": "48 - 25",
        "mul": "6 × 7", "div": "36 ÷ 4", "off_by_one": "29 + 13",
    }
    seed = seeds.get(tag, "23 + 14")
    for _ in range(50):
        expr, ans = similar_problem(seed, rng)
        a, b = operands(expr) or (0, 0)
        if tag == "carry" and (a % 10 + b % 10) < 10:
            continue
        if tag == "borrow" and (a % 10) >= (b % 10):
            continue
        return expr, ans
    return expr, ans


# ---------- Teach mode helpers ----------

TEACHABLE = ("carry", "borrow", "off_by_one", "mul")


def concepts_of(problem: str) -> set[str]:
    """Concept tags a problem exercises (used by the Teach-mode readiness gate)."""
    op, ab = operator_of(problem), operands(problem)
    if not ab:
        return set()
    a, b = ab
    if op == "+":
        return {"carry" if (a % 10 + b % 10) >= 10 else "add", "off_by_one"}
    if op == "-":
        return {"borrow" if (a % 10) < (b % 10) else "sub", "off_by_one"}
    if op == "*":
        return {"mul"}
    if op == "/":
        return {"div"}
    return set()
