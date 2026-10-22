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


# ---------- API: /teach (Teach Lumi mode, see teach-lumi-spec.md §7.2) ----------

TeachStep = Literal["practice_first", "mark", "fix", "help", "find", "explain", "demo", "sure", "next", "done"]
TeachOutcome = Literal["caught_fixed", "caught_unfixed", "missed", "false_alarm", "confirmed_ok"]
ExplainQuality = Literal["concept", "procedure", "vague", "incorrect"]


class LumiProblemOut(BaseModel):
    """Client-safe view of one of Lumi's problems: no truth fields."""
    id: int
    problem: str
    lumi_answer: str


class TeachChip(BaseModel):
    id: str
    text: str


class TeachDemo(BaseModel):
    problem: str
    steps: list[str]
    answer: str


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


class TeachWorksheetRequest(BaseModel):
    session_id: str
    language: Language = "en"
    force: bool = False


class TeachWorksheetResponse(BaseModel):
    ready: bool
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


ReportResponse.model_rebuild()
