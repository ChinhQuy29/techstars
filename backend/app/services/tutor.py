"""Socratic hint logic. The backend owns hint_level and is the only thing that can unlock a reveal."""
from __future__ import annotations

import random
import re
from typing import Optional

from ..schemas import GradedProblem, TutorLLMOut, TutorRequest, TutorResponse
from . import llm
from .math_check import similar_problem
from .session import MAX_HINT_LEVEL, Session

ROBOT_NAME = "Lumi"
LANGUAGE_NAMES = {"en": "English", "es": "Spanish", "vi": "Vietnamese"}

T = {
    "en": {
        "all_correct": "Nice work! You got all {n} right. I like how carefully you wrote your numbers.",
        "some_correct": "I checked your page. Let's look at problem {id} together.",
        "fixed": "You fixed it! {problem} is {answer}. You kept trying, and that's how you learn!",
        "confirm": "Hmm, I'm not sure I read your answer to problem {id}. Is that {answer}? Can you write it a bit bigger?",
        "blank": "Problem {id} is still empty. Want to give it a try?",
        "chat": "I'm listening! Let's keep working on {problem}.",
        1: "Let's look at problem {id} again. Can you read the question out loud and check your answer?",
        2: "Here's a trick for {problem}: work one column at a time, starting with the ones.",
        3: "Let's do one step together. {step} What do you get when you keep going?",
        4: "The answer to {problem} is {answer}. {explain} Want to try a new one? What is {practice}?",
        "explain": "We go column by column, starting with the ones.",
        "step_add": "First add the ones: {a1} plus {b1} is {s1}.",
        "step_sub": "Look at the ones: {a1} take away {b1}. Do we need to borrow from the tens?",
        "step_mul": "Think of {a} groups of {b}. Count by {b}s.",
        "step_div": "How many groups of {b} fit into {a}? Try counting by {b}s.",
        "no_page": "Show me your worksheet and I'll take a look!",
    },
    "es": {
        "all_correct": "¡Buen trabajo! Tienes las {n} bien. Me gusta lo cuidadoso que escribiste los números.",
        "some_correct": "Revisé tu página. Veamos juntos el problema {id}.",
        "fixed": "¡Lo arreglaste! {problem} es {answer}. ¡Seguiste intentándolo y así se aprende!",
        "confirm": "Mmm, no estoy seguro de leer tu respuesta del problema {id}. ¿Es {answer}? ¿Puedes escribirlo más grande?",
        "blank": "El problema {id} está vacío. ¿Quieres intentarlo?",
        "chat": "¡Te escucho! Sigamos con {problem}.",
        1: "Miremos otra vez el problema {id}. ¿Puedes leer la pregunta en voz alta y revisar tu respuesta?",
        2: "Un truco para {problem}: trabaja una columna a la vez, empezando por las unidades.",
        3: "Hagamos un paso juntos. {step} ¿Qué obtienes si sigues?",
        4: "La respuesta de {problem} es {answer}. {explain} ¿Probamos otro? ¿Cuánto es {practice}?",
        "explain": "Vamos columna por columna, empezando por las unidades.",
        "step_add": "Primero suma las unidades: {a1} más {b1} es {s1}.",
        "step_sub": "Mira las unidades: {a1} menos {b1}. ¿Necesitamos pedir prestado a las decenas?",
        "step_mul": "Piensa en {a} grupos de {b}. Cuenta de {b} en {b}.",
        "step_div": "¿Cuántos grupos de {b} caben en {a}? Cuenta de {b} en {b}.",
        "no_page": "¡Muéstrame tu hoja y la reviso!",
    },
    "vi": {
        "all_correct": "Làm tốt lắm! Con làm đúng cả {n} bài. Mình thích cách con viết số rất cẩn thận.",
        "some_correct": "Mình đã xem bài của con. Cùng xem bài {id} nhé.",
        "fixed": "Con sửa được rồi! {problem} bằng {answer}. Con đã cố gắng, và đó là cách học!",
        "confirm": "Ừm, mình chưa chắc đọc đúng đáp án bài {id}. Có phải là {answer} không? Con viết to hơn một chút nhé?",
        "blank": "Bài {id} còn trống. Con thử làm nhé?",
        "chat": "Mình đang nghe đây! Cùng làm tiếp bài {problem} nhé.",
        1: "Cùng xem lại bài {id} nhé. Con đọc to đề bài và kiểm tra lại đáp án được không?",
        2: "Mẹo cho bài {problem}: làm từng cột một, bắt đầu từ hàng đơn vị.",
        3: "Cùng làm một bước nhé. {step} Làm tiếp thì con được bao nhiêu?",
        4: "Đáp án của {problem} là {answer}. {explain} Con thử bài mới nhé? {practice} bằng bao nhiêu?",
        "explain": "Mình làm từng cột, bắt đầu từ hàng đơn vị.",
        "step_add": "Đầu tiên cộng hàng đơn vị: {a1} cộng {b1} bằng {s1}.",
        "step_sub": "Nhìn hàng đơn vị: {a1} trừ {b1}. Mình có cần mượn ở hàng chục không?",
        "step_mul": "Nghĩ về {a} nhóm, mỗi nhóm {b}. Đếm thêm {b} mỗi lần.",
        "step_div": "Có bao nhiêu nhóm {b} trong {a}? Thử đếm thêm {b} mỗi lần.",
        "no_page": "Cho mình xem bài làm của con nhé!",
    },
}

CONFIDENCE_THRESHOLD = 0.6


def _pretty(problem: str) -> str:
    return problem.replace("*", "×").replace("/", "÷")


def _worked_step(p: GradedProblem, lang: str) -> str:
    nums = [int(n) for n in re.findall(r"\d+", p.problem)]
    t = T[lang]
    if len(nums) != 2:
        return ""
    a, b = nums
    if "+" in p.problem:
        return t["step_add"].format(a1=a % 10, b1=b % 10, s1=a % 10 + b % 10)
    if "*" in p.problem or "×" in p.problem:
        return t["step_mul"].format(a=a, b=b)
    if "/" in p.problem or "÷" in p.problem:
        return t["step_div"].format(a=a, b=b)
    return t["step_sub"].format(a1=a % 10, b1=b % 10)


def _leaks_answer(text: str, answer: Optional[str], child_answer: Optional[str]) -> bool:
    """Guard: below level 4 the robot must never say the correct answer."""
    if not answer:
        return False
    core = answer.split(" ")[0]
    if child_answer and core == child_answer.strip():
        return False
    return re.search(rf"(?<!\d){re.escape(core)}(?!\d)", text) is not None


def _template(lang: str, key, **kw) -> str:
    return T[lang][key].format(**kw)


async def _llm_say(
    req: TutorRequest, p: Optional[GradedProblem], situation: str, hint_level: int,
    revealed: bool, practice: Optional[str], attempts: int = 0,
) -> Optional[TutorLLMOut]:
    if not llm.enabled():
        return None
    lang_name = LANGUAGE_NAMES[req.language]
    reveal_rule = (
        "You MAY now reveal the correct answer with a short explanation, then offer the practice problem."
        if revealed else "You must NOT say or hint the final correct answer or any number that equals it."
    )
    system = llm.prompt(
        "tutor_system", robot_name=ROBOT_NAME, language_name=lang_name,
        hint_level=hint_level, reveal_rule=reveal_rule,
    )
    history = "\n".join(f"{h.role}: {h.text}" for h in req.history[-6:]) or "(none)"
    user = llm.prompt(
        "tutor_user",
        situation=situation,
        problem=_pretty(p.problem) if p else "(none)",
        child_answer=(p.child_answer if p else None) or "(blank)",
        verdict=("correct" if p and p.is_correct else "not correct yet") if p else "n/a",
        correct_answer_visible=(p.correct_answer if (p and (revealed or p.is_correct)) else "(hidden)"),
        error_step=(p.error_step if p else None) or "(unknown)",
        attempts=attempts,
        practice_problem=practice or "(none)",
        child_said=req.child_said or "(nothing)",
        history=history,
    )
    out = await llm.generate(TutorLLMOut, user, system=system, temperature=0.6, label="tutor")
    if out is None:
        return None
    if p and not revealed and not p.is_correct and _leaks_answer(out.say, p.correct_answer, p.child_answer):
        return None  # fall back to the safe template
    if out.emotion in ("sleeping", "idle"):
        out.emotion = "encouraging"
    return out


async def respond(session: Session, req: TutorRequest) -> TutorResponse:
    lang = req.language
    graded = session.last_grade
    if not graded:
        return TutorResponse(emotion="curious", say=_template(lang, "no_page"))

    # Celebration: a previously-wrong problem is now correct.
    if req.action == "react" and session.last_fixed:
        p = next(x for x in graded if x.id == session.last_fixed[0])
        situation = "The child just FIXED a problem they had wrong before. Celebrate the effort."
        out = await _llm_say(req, p, situation, 0, True, None)
        say = out.say if out else _template(lang, "fixed", problem=_pretty(p.problem), answer=p.correct_answer)
        others = session.find_last(None)
        if others is not None:
            say += " " + _template(lang, "some_correct", id=others.id)
        return TutorResponse(emotion="celebrating", say=say, focus_problem_id=p.id)

    p = session.find_last(req.problem_id)

    if p is None:  # everything answered is correct
        blank = next((x for x in graded if not x.answered), None)
        n = sum(1 for x in graded if x.is_correct)
        if blank:
            return TutorResponse(emotion="encouraging", say=_template(lang, "blank", id=blank.id),
                                 focus_problem_id=blank.id)
        situation = f"All {n} problems on the page are correct. Give warm, specific, not over-the-top praise."
        out = await _llm_say(req, None, situation, 0, False, None)
        return TutorResponse(emotion="happy" if n < 3 else "celebrating",
                             say=out.say if out else _template(lang, "all_correct", n=n))

    st = session.state_for(p.problem)

    # Low confidence → ask, don't guess.
    if p.needs_confirmation:
        situation = "You could not read the child's answer clearly. Ask what they wrote; do not grade it."
        out = await _llm_say(req, p, situation, 0, False, None)
        return TutorResponse(
            emotion="curious", focus_problem_id=p.id, attempts=st.attempts, hint_level=st.hint_level,
            say=out.say if out else _template(lang, "confirm", id=p.id, answer=p.child_answer or "?"),
        )

    if p.is_correct:
        return TutorResponse(emotion="happy", say=_template(lang, "all_correct", n=1), focus_problem_id=p.id)

    # Advance the hint ladder (server-side, monotonic, capped).
    if req.action == "hint":
        st.hint_level = min(MAX_HINT_LEVEL, st.hint_level + 1)
    elif req.action == "react":
        st.hint_level = min(MAX_HINT_LEVEL, max(st.hint_level, st.attempts, 1))
    else:
        st.hint_level = max(st.hint_level, 1)
    level = st.hint_level
    revealed = level >= MAX_HINT_LEVEL
    practice = similar_problem(p.problem, random.Random(hash(p.problem) + st.attempts))[0] if revealed else None
    session.log("hint", problem=p.problem, level=level, action=req.action)

    if req.action == "chat":
        situation = "The child said something. Respond to it, staying on this problem and the hint rules."
    else:
        situation = f"The child's answer is not correct yet. Give a level-{level} hint."
    out = await _llm_say(req, p, situation, level, revealed, practice, st.attempts)
    if out is not None:
        say, emotion = out.say, out.emotion
    else:
        emotion = "curious" if level <= 1 else "encouraging"
        say = _template(
            lang, level, id=p.id, problem=_pretty(p.problem), answer=p.correct_answer,
            step=_worked_step(p, lang), explain=T[lang]["explain"], practice=practice,
        )
    return TutorResponse(
        emotion=emotion, say=say, focus_problem_id=p.id, hint_level=level, attempts=st.attempts,
        revealed=revealed, practice_problem=practice,
    )
