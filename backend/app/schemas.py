"""Pydantic models. The *LLM* models double as Gemini structured-output schemas."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# Gemini bbox format: [ymin, xmin, ymax, xmax] scaled 0-1000.
BBox = list[int]

Emotion = Literal[
    "sleeping", "idle", "listening", "thinking", "happy",
    "celebrating", "encouraging", "curious", "confused",
]
Language = Literal["en", "es", "vi"]


# ---------- LLM structured outputs (extraction only, never math) ----------

class VisionProblem(BaseModel):
    id: int
    problem: str = Field(description="Normalized expression using digits and + - * / only, e.g. '47 + 38'")
    child_answer: Optional[str] = Field(None, description="Exactly what the child wrote as the answer, or null if blank")
    bbox: BBox = Field(description="[ymin, xmin, ymax, xmax] 0-1000 around the whole problem incl. answer")
    answer_bbox: Optional[BBox] = Field(None, description="[ymin, xmin, ymax, xmax] 0-1000 around the child's answer")
    confidence: float = Field(description="0-1 confidence in reading the child's answer")
    has_work: bool = Field(False, description="True if scratch work / carried digits are visible")


class VisionExtraction(BaseModel):
    hand_blocking: bool = False
    unreadable: bool = False
    problems: list[VisionProblem] = []


class ErrorAnalysis(BaseModel):
    error_step: Optional[str] = None
    error_bbox: Optional[BBox] = None


class TutorLLMOut(BaseModel):
    emotion: Emotion
    say: str


# ---------- API: /grade ----------

class GradedProblem(BaseModel):
    id: int
    problem: str
    child_answer: Optional[str]
    correct_answer: Optional[str]
    is_correct: bool
    answered: bool = True
    bbox: BBox
    answer_bbox: Optional[BBox] = None
    error_step: Optional[str] = None
    error_bbox: Optional[BBox] = None
    confidence: float
    needs_confirmation: bool = False


class GradeResponse(BaseModel):
    session_id: str
    hand_blocking: bool = False
    unreadable: bool = False
    problems: list[GradedProblem] = []
    fixed_ids: list[int] = []
    mock: bool = False
    llm_error: Optional[Literal["timeout", "quota", "error"]] = None


# ---------- API: /tutor ----------

class ChatTurn(BaseModel):
    role: Literal["child", "robot"]
    text: str


class TutorRequest(BaseModel):
    session_id: str
    language: Language = "en"
    action: Literal["react", "hint", "chat"] = "react"
    problem_id: Optional[int] = None
    child_said: Optional[str] = None
    history: list[ChatTurn] = []


class TutorResponse(BaseModel):
    emotion: Emotion
    say: str
    focus_problem_id: Optional[int] = None
    hint_level: int = 0
    attempts: int = 0
    revealed: bool = False
    practice_problem: Optional[str] = None


# ---------- API: /report ----------

class ReportRequest(BaseModel):
    session_id: str
    language: Language = "en"


class PracticeProblem(BaseModel):
    problem: str
    answer: str


class ReportResponse(BaseModel):
    session_id: str
    score: int
    total: int
    correct: int
    fixed: int
    hints_used: int
    concepts: list[str]
    practice_problems: list[PracticeProblem]
    summary: str
    events: list[dict]
    teach: Optional["TeachReport"] = None


# ---------- API: /teach (Teach Lumi mode, see docs/05-architecture-and-api.md) ----------

TeachStep = Literal["practice_first", "mark", "fix", "help", "find", "explain", "demo", "sure", "next", "done"]
TeachOutcome = Literal["caught_fixed", "caught_unfixed", "missed", "false_alarm", "confirmed_ok"]
ExplainQuality = Literal["concept", "procedure", "vague", "incorrect"]


AnswerKind = Literal["number", "time", "compare"]


class LumiProblemOut(BaseModel):
    """Client-safe view of one of Lumi's problems: no truth fields."""
    id: int
    problem: str  # newer concepts mark the answer's place with "?"; the original four are "a op b"
    lumi_answer: str
    kind: AnswerKind = "number"  # which keypad the child gets
    visual: Optional[dict] = None  # ruler / shape / fraction bars / bar chart for the frontend to draw


class TeachChip(BaseModel):
    id: str
    text: str


class TeachDemo(BaseModel):
    problem: str
    steps: list[str]
    answer: str
    visual: Optional[dict] = None


class TeachUnlock(BaseModel):
    """Something the child's teaching just opened (a Town place now; story scenes later)."""
    kind: Literal["place", "story"]
    key: str
    title: str
    emoji: str


class TeachOutcomeOut(BaseModel):
    id: int
    outcome: TeachOutcome


class TeachStats(BaseModel):
    caught: int
    planted: int
    false_alarms: int


class TeachTurn(BaseModel):
    emotion: Emotion
    say: str
    step: TeachStep
    focus_problem_id: Optional[int] = None
    highlight_ids: list[int] = []
    chips: list[TeachChip] = []
    demo: Optional[TeachDemo] = None
    outcomes: list[TeachOutcomeOut] = []
    mastery: dict[str, float] = {}
    mastery_up: Optional[str] = None
    help_level: int = 0
    stats: Optional[TeachStats] = None
    unlocks: list[TeachUnlock] = []


class TeachWorksheetRequest(BaseModel):
    session_id: str
    language: Language = "en"
    force: bool = False  # adult-only: skip the readiness gate with {carry, off_by_one}
    demo: bool = False   # adult-only: the fixed canonical demo worksheet (47 + 38 = 75 ...)
    concept: Optional[str] = None  # the concept the child chose to teach (None: Lumi picks)
    dream: Optional[str] = None  # what Lumi wants to be (services/dreams.py); unknown values are ignored


class TeachWorksheetResponse(BaseModel):
    ready: bool
    needs: Optional[Literal["help", "warmup"]] = None  # when not ready: how the child gets ready
    demo: bool = False
    worksheet_id: Optional[str] = None
    problems: list[LumiProblemOut] = []
    concepts: list[str] = []
    turn: TeachTurn


class TeachMarkIn(BaseModel):
    id: int
    mark: Literal["circle", "check", "none"]
    correction: Optional[str] = None


class TeachTurnRequest(BaseModel):
    session_id: str
    language: Language = "en"
    worksheet_id: str
    action: Literal["check", "fix", "find", "explain", "confirm", "next"]
    marks: list[TeachMarkIn] = []
    problem_id: Optional[int] = None
    answer: Optional[str] = None
    child_said: Optional[str] = None
    chip_id: Optional[str] = None
    agree: Optional[bool] = None


class TeachConceptsRequest(BaseModel):
    session_id: str
    language: Language = "en"


class TeachConceptOut(BaseModel):
    concept: str
    label: str
    stars: float
    ready: bool
    gate: Literal["help", "warmup"]  # how a not-ready concept unlocks


class TeachConceptsResponse(BaseModel):
    concepts: list[TeachConceptOut]


class WarmupRequest(BaseModel):
    session_id: str
    language: Language = "en"
    concept: str


class WarmupProblemOut(BaseModel):
    id: int
    problem: str
    kind: AnswerKind = "number"
    visual: Optional[dict] = None


class WarmupResponse(BaseModel):
    warmup_id: str
    concept: str
    say: str
    problems: list[WarmupProblemOut]


class WarmupCheckRequest(BaseModel):
    session_id: str
    language: Language = "en"
    warmup_id: str
    answers: list[str] = Field(default_factory=list, max_length=2)


class WarmupCheckResponse(BaseModel):
    passed: bool
    results: list[bool]
    say: str
    emotion: Emotion


class StoryRequest(BaseModel):
    session_id: str
    language: Language = "en"


class StoryVersion(BaseModel):
    key: str
    # chosen: this act's version · available: can be picked now · what_if: another act version, both concepts taught
    # partial: one of its two concepts taught · locked: none yet · later: a future act
    state: Literal["chosen", "available", "what_if", "partial", "locked", "later"]
    emoji: str
    title: str
    concepts: list[str]  # only the concepts already taught (a clue), all of them once open
    concept_labels: list[str]
    seen: bool


class StoryAct(BaseModel):
    act: int
    title: str
    chosen: Optional[str] = None
    versions: list[StoryVersion]


class StoryEnding(BaseModel):
    key: str
    title: str
    emoji: str
    seen: bool


class StoryResponse(BaseModel):
    started: bool
    say: str
    current_act: int
    acts: list[StoryAct]
    ending: Optional[StoryEnding] = None


class StorySceneRequest(BaseModel):
    session_id: str
    language: Language = "en"
    key: str


class StoryLine(BaseModel):
    emotion: Emotion
    text: str


class StorySceneResponse(BaseModel):
    key: str
    act: int
    title: str
    emoji: str
    lines: list[StoryLine]
    what_if: bool
    what_if_label: Optional[str] = None


class TeachExplainLLM(BaseModel):
    """LLM structured output: rate the child's explanation + one spoken reaction sentence."""
    quality: ExplainQuality
    reaction: str
    quote: Optional[str] = Field(None, description="The child's key words, max 12 words, or null")


class TeachReportConcept(BaseModel):
    concept: str
    label: str
    stars: float


class TeachReportQuote(BaseModel):
    concept: str
    label: str
    text: str


class TeachReport(BaseModel):
    taught: list[TeachReportConcept]
    quotes: list[TeachReportQuote]
    caught: int
    planted: int
    missed: int
    false_alarms: int
    explanations: dict[str, int]
    note: str
    demo: bool = False  # True if any counted worksheet was the scripted demo sheet


ReportResponse.model_rebuild()


# ---------- API: /teach/town, /teach/scene (Lumi's Town, see docs/03-lumis-town.md) ----------

Concept = Literal["carry", "borrow", "off_by_one", "mul"]


class TownRequest(BaseModel):
    session_id: str
    language: Language = "en"


class TownPlace(BaseModel):
    concept: Concept
    name: str
    emoji: str
    stars: float
    unlocked: bool
    need: Optional[str] = None
    teaser: Optional[str] = None


class ScrapbookEntry(BaseModel):
    concept: Concept
    label: str
    quote: str
    stars: float


class TownResponse(BaseModel):
    dream: str
    unlock_stars: float
    places: list[TownPlace]
    scrapbook: list[ScrapbookEntry]


class SceneRequest(BaseModel):
    session_id: str
    language: Language = "en"
    concept: Concept


class SceneResponse(BaseModel):
    concept: Concept
    unlocked: bool
    title: str
    problem: Optional[str] = None
    lines: list[str]
    answer: Optional[str] = None
    say: str
    parts: Optional["SceneParts"] = None  # digits for the illustrated scene (docs/03-lumis-town.md)


class SceneParts(BaseModel):
    op: Literal["+", "-", "*"]
    a: int
    b: int
    answer: int
    a_digits: Optional[list[int]] = None  # [tens, ones]
    b_digits: Optional[list[int]] = None
    regroup: Optional[bool] = None  # carried (+) or borrowed (-) a ten
    ones: Optional[int] = None
    tens: Optional[int] = None
    seq: Optional[list[int]] = None  # × : b, 2b, … a·b
    borrow_tens: Optional[int] = None  # − with borrowing: the tens digit after lending a ten
    borrow_ones: Optional[int] = None  # − with borrowing: the ones digit after receiving it


SceneResponse.model_rebuild()


# ---------- API: /profile (saved progress, docs/06-privacy-and-safety.md) ----------

class ProfileCreateRequest(BaseModel):
    session_id: str
    consent: bool  # a grown-up opted in; must be true
    consent_version: str


class ProfileAttachRequest(BaseModel):
    session_id: str
    profile_id: str = Field(min_length=32, max_length=32, pattern=r"^[0-9a-f]{32}$")


class ProgressSummary(BaseModel):
    stars: dict[str, float]
    skills_taught: int


class ProfileResponse(BaseModel):
    profile_id: str
    summary: ProgressSummary
