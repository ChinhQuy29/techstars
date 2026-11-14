"""In-memory session state: per-problem attempts / hint level, plus an event log for the report."""
from __future__ import annotations

import time
import os
import re
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
    # Teach mode (see docs/02-learning-design.md): current worksheet + Lumi's per-concept stars (0..3).
    teach: Optional["TeachState"] = None
    lumi_mastery: dict[str, float] = field(default_factory=dict)
    teach_quotes: dict[str, tuple[str, str]] = field(default_factory=dict)  # concept -> (quality, text)
    town_visits: dict[str, int] = field(default_factory=dict)  # Lumi's Town: scene visits per concept (fresh problem each visit)
    # Saved progress (docs/06-privacy-and-safety.md): set only after a grown-up opts in.
    profile_id: Optional[str] = None
    saved_ready: set[str] = field(default_factory=set)  # Teach-ready concepts from earlier days
    warm_ready: set[str] = field(default_factory=set)  # newer concepts unlocked by passing a quick warm-up
    warmup: Optional[dict] = None  # the warm-up in progress: {id, concept, items}
    # Lumi's Journey (story.py): the version chosen for each act, and the scenes already seen.
    story_chosen: dict[int, str] = field(default_factory=dict)
    story_seen: set[str] = field(default_factory=set)

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
    kind: str = "number"  # how the child types an answer: number | time | compare
    visual: Optional[dict] = None  # ruler / shape / fraction bars / bar chart, drawn by the frontend
    data: dict = field(default_factory=dict)  # the numbers behind the problem (newer concepts)
    # filled in after the child checks the page
    outcome: Optional[str] = None
    child_fix: Optional[str] = None
    quote: Optional[str] = None
    found: bool = False  # a missed mistake the child has since found (or Lumi pointed to)
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
    demo: bool = False  # fixed scripted worksheet (adult demo action), isolated in the report
    started: float = field(default_factory=time.time)

    def get(self, problem_id: Optional[int]) -> Optional[TeachProblem]:
        return next((p for p in self.problems if p.id == problem_id), None)


_sessions: dict[str, Session] = {}

# Session ids are the only key to a child's in-memory session (marks, explanations, report), so they must be
# unguessable: 128 random bits as 32 hex characters, made on the device (docs/06-privacy-and-safety.md).
_SESSION_ID = re.compile(r"^[0-9a-f]{32}$")


class InvalidSessionId(ValueError):
    """A session id that isn't 32 hex characters (main.py answers 422)."""


def valid_session_id(session_id: Optional[str]) -> bool:
    if os.getenv("LUMI_LOOSE_SESSION_IDS") == "1":  # tests only (tests/conftest.py): readable ids like "p-day2"
        return bool(session_id)
    return bool(session_id and _SESSION_ID.match(session_id))


def get_session(session_id: Optional[str]) -> Session:
    sid = session_id or uuid.uuid4().hex
    if not valid_session_id(sid):
        raise InvalidSessionId("session id must be 32 hex characters")
    if sid not in _sessions:
        _sessions[sid] = Session(id=sid)
    return _sessions[sid]


def reset_session(session_id: str) -> Session:
    _sessions.pop(session_id, None)
    return get_session(session_id)
