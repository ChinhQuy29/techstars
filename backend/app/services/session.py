"""In-memory session state: per-problem attempts / hint level, plus an event log for the report."""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from ..schemas import GradedProblem
from .math_check import normalize_expression

MAX_HINT_LEVEL = 4


@dataclass
class ProblemState:
    key: str
    attempts: int = 0  # number of gradings where it was wrong
    hint_level: int = 0  # 0 = none yet, 1..4 = hint ladder
    ever_wrong: bool = False
    fixed: bool = False
    last: Optional[GradedProblem] = None
    concept: Optional[str] = None


@dataclass
class Session:
    id: str
    created: float = field(default_factory=time.time)
    problems: dict[str, ProblemState] = field(default_factory=dict)
    events: list[dict] = field(default_factory=list)
    last_grade: list[GradedProblem] = field(default_factory=list)
    last_fixed: list[int] = field(default_factory=list)
    grade_count: int = 0
    # Teach mode (see teach-lumi-spec.md): current worksheet + Lumi's per-concept stars (0..3).
    teach: Optional["TeachState"] = None
    lumi_mastery: dict[str, float] = field(default_factory=dict)
    teach_quotes: dict[str, tuple[str, str]] = field(default_factory=dict)  # concept -> (quality, text)

    def log(self, type_: str, **data) -> None:
        self.events.append({"type": type_, "t": round(time.time(), 2), **data})

    def state_for(self, problem: str) -> ProblemState:
        key = normalize_expression(problem).replace(" ", "")
        if key not in self.problems:
            self.problems[key] = ProblemState(key=key)
        return self.problems[key]

    def find_last(self, problem_id: Optional[int]) -> Optional[GradedProblem]:
        if problem_id is not None:
            return next((p for p in self.last_grade if p.id == problem_id), None)
        # Focus: low-confidence first (ask, don't guess), then first wrong answer.
        for p in self.last_grade:
            if p.needs_confirmation:
                return p
        for p in self.last_grade:
            if p.answered and not p.is_correct:
                return p
        return None


@dataclass
class TeachProblem:
    id: int
    problem: str
    lumi_answer: str
    correct_answer: str
    planted: bool
    concept: str
    error_step: Optional[str] = None
    # filled in after the child checks the page
    outcome: Optional[str] = None
    child_fix: Optional[str] = None
    quote: Optional[str] = None
    # per-problem conversation state (server-owned)
    stage: Optional[str] = None  # explain | fix | find | sure | demo | next
    fix_tries: int = 0
    help_level: int = 0  # 0 = not switched to tutoring yet
    followups: int = 0
    incorrect: int = 0
    nudge: int = 0
    gain: float = 0.0  # pending star gain, applied on demo confirm
    role_switched: bool = False
    demo: Optional[dict] = None


@dataclass
class TeachState:
    worksheet_id: str
    problems: list[TeachProblem]
    review: bool = False
    checked: bool = False
    queue: list[int] = field(default_factory=list)
    current: Optional[int] = None
    done: bool = False
    last_turn: Optional[dict] = None

    def get(self, problem_id: Optional[int]) -> Optional[TeachProblem]:
        return next((p for p in self.problems if p.id == problem_id), None)


_sessions: dict[str, Session] = {}


def get_session(session_id: Optional[str]) -> Session:
    sid = session_id or uuid.uuid4().hex[:8]
    if sid not in _sessions:
        _sessions[sid] = Session(id=sid)
    return _sessions[sid]


def reset_session(session_id: str) -> Session:
    _sessions.pop(session_id, None)
    return get_session(session_id)
