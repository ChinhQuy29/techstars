"""Teach Lumi mode: Lumi brings its own homework with planted mistakes; the child finds, fixes and
explains them, and Lumi visibly learns. Spec: docs/02-learning-design.md (source of truth).

Rules (same spirit as Help mode):
- SymPy (math_check) is the only judge of Lumi's answers, the child's fixes and Lumi's demo answers.
- Planted mistakes come only from diagnose()-recognized error types, verified at generation time.
- The server owns every counter (stage, fix tries, hint level, follow-ups, stars).
- Lumi never affirms a wrong fix or a wrong explanation (_affirms guard on LLM text).
"""
from __future__ import annotations

import logging
import random
import re
import time
import uuid
from types import SimpleNamespace
from typing import Optional

from ..schemas import (
    LumiProblemOut, TeachChip, TeachConceptOut, TeachDemo, TeachExplainLLM, TeachOutcomeOut, TeachStats, TeachTurn,
    TeachTurnRequest, TeachWorksheetResponse, WarmupCheckResponse, WarmupProblemOut, WarmupResponse,
)
from . import concepts as cx
from . import dreams
from . import llm
from .concepts import ALL_CONCEPTS, NEW_CONCEPTS
from .math_check import (
    TEACHABLE, _add_no_carry, _sub_smaller_from_larger, check, concepts_of, diagnose, evaluate,
    format_answer, normalize_expression, operands, operator_of,
)
from .session import Session, TeachProblem, TeachState
from .tutor import LANGUAGE_NAMES, ROBOT_NAME, T as HELP_T, _pretty, _worked_step

N_PROBLEMS = 5
MAX_STARS = 3.0
MAX_REACTION_CHARS = 200
log = logging.getLogger("lumi.teach")

# Canonical 90-second demo sheet (docs/07-testing-and-demo.md). Adult-only, isolated in the report.
# (problem, Lumi's answer, planted, concept), verified by check()/diagnose() when built.
DEMO_SHEET = [
    ("23 + 14", "37", False, "off_by_one"),
    ("47 + 38", "75", True, "carry"),
    ("6 × 7", "42", False, "mul"),
    ("52 - 17", "45", True, "borrow"),
    ("34 + 25", "59", False, "off_by_one"),
]


class TeachGenerationError(RuntimeError):
    """A valid worksheet could not be generated (should never happen; reported as a recoverable 503)."""

# ---------- templates (spoken lines, en / es / vi) ----------

TT: dict[str, dict] = {
    "en": {
        "intro": "I did my homework! Can you be my teacher? Tap ✓ if I got it right, or ✗ if I made a mistake, and write the right answer.",
        "review_intro": "I think I forgot a little. Can you check my homework again, teacher?",
        "practice_first": "Let's practice together first, then you can teach me! Open Practice.",
        "checked_all": "You checked my whole page!",
        "explain_ask": "Oh no, you're right! Why is {lumi} wrong? What did I mess up?",
        "found_ask": "You found my mistake on number {id}! What should my answer be?",
        "fix_right": "Yes! That's the right answer. Now tell me, why was mine wrong?",
        "role_switch": "Let me help you this time, then you can teach me!",
        "help4": "The answer is {answer}. {explain} Can you type it in for me?",
        "help_fixed": "You got it! Now can you tell me why mine was wrong?",
        "praise_concept": "Wow, you explained that so clearly!",
        "praise_procedure": "Thanks, teacher!",
        "thanks_move_on": "Okay, thank you for helping me!",
        "incorrect_expl": "Hmm, if I do it that way, I still get {lumi}. Can you tell me another way?",
        "let_me_help": "Let me think. {rule} Now I get it!",
        "like_taught": "Let me try a new one, like you taught me!",
        "you_said": "You said: {quote}.",
        "so": "So it's {answer}!",
        "did_i": "Did I do it right?",
        "learned": "Yay! I learned {label}!",
        "thanks_help": "Thanks for helping me, teacher!",
        "demo_disagree": "Hmm, I checked it twice and I still get {answer}. I think I've got it now!",
        "find_intro": "My teacher says one more of mine has a mistake. Can you find it?",
        "find_two": "I think it's one of these two…",
        "find_one": "Can you check number {id} really carefully?",
        "find_found": "Yes, that one! What should my answer be?",
        "find_point": "I think it's number {id}! What should my answer be?",
        "find_ok": "Hmm, I think that one is okay.",
        "sure": "Are you sure? Let's check it together. {check} Was I right?",
        "fa_agree": "Phew! Checking my work was a great idea, teacher.",
        "fa_disagree": "Hmm, I counted twice and got {answer} both times. Let's ask a grown-up to check later!",
        "done": "Thank you, teacher! You found {caught} of my {planted} mistakes. I learned so much!",
        "steps": {
            "ones_add": "First the ones: {x} plus {y} is {s}.",
            "carry_write": "I write {w} and carry the 1.",
            "tens_add_carry": "Then the tens: {x} plus {y} plus 1 is {s}.",
            "tens_add": "Then the tens: {x} plus {y} is {s}.",
            "ones_sub_borrow": "First the ones: {x} is smaller than {y}, so I borrow a ten. {x10} minus {y} is {d}.",
            "tens_sub_borrow": "Then the tens: I have {x} left. {x} minus {y} is {d}.",
            "ones_sub": "First the ones: {x} minus {y} is {d}.",
            "tens_sub": "Then the tens: {x} minus {y} is {d}.",
            "mul": "I make {a} groups of {b}. I count by {b}s: {seq}.",
        },
        "concepts": {
            "carry": {
                "label": "addition",
                "ask_why": "Ooh! But why does the 1 move over to the tens?",
                "point": "Hmm, was my mistake in the ones column or the tens column?",
                "rule": "When the ones add up to 10 or more, we carry the 1 to the tens.",
                "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we look at the ones column together?",
                "chips": ["You forgot to carry the 1 to the tens", "You have to add the tens first", "The answer should be smaller"],
            },
            "borrow": {
                "label": "subtraction",
                "ask_why": "Ooh! But why do I need to borrow from the tens?",
                "point": "Hmm, was my mistake in the ones column or the tens column?",
                "rule": "When the top ones number is too small, we borrow one ten.",
                "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we look at the ones column together?",
                "chips": ["You needed to borrow a ten first", "Always take the small number from the big one", "You should add instead"],
            },
            "off_by_one": {
                "label": "counting",
                "ask_why": "Ooh! How can I check so I don't count wrong?",
                "point": "Hmm, did I count too many or too few?",
                "rule": "We have to count carefully and check our answer.",
                "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we count it slowly together?",
                "chips": ["You counted one too many or one too few", "You forgot to carry the 1", "You should take away instead"],
            },
            "mul": {
                "label": "multiplication",
                "ask_why": "Ooh! How many groups should I count?",
                "point": "Hmm, did I count too many groups or too few?",
                "rule": "We count exactly the right number of groups.",
                "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we count the groups together?",
                "chips": ["You counted one group too many or too few", "You should add the two numbers", "Times means take away"],
            },
        },
    },
    "es": {
        "intro": "¡Hice mi tarea! ¿Puedes ser mi profe? Toca ✓ si está bien, o ✗ si me equivoqué, y escribe la respuesta correcta.",
        "review_intro": "Creo que se me olvidó un poco. ¿Puedes revisar mi tarea otra vez, profe?",
        "practice_first": "¡Practiquemos juntos primero y luego me enseñas! Toca Practicar.",
        "checked_all": "¡Revisaste toda mi página!",
        "explain_ask": "¡Ay, tienes razón! ¿Por qué {lumi} está mal? ¿En qué me equivoqué?",
        "found_ask": "¡Encontraste mi error en el número {id}! ¿Cuál debería ser mi respuesta?",
        "fix_right": "¡Sí! Esa es la respuesta correcta. Ahora dime, ¿por qué la mía estaba mal?",
        "role_switch": "¡Esta vez te ayudo yo, y luego tú me enseñas!",
        "help4": "La respuesta es {answer}. {explain} ¿Puedes escribirla por mí?",
        "help_fixed": "¡Lo lograste! ¿Ahora me dices por qué la mía estaba mal?",
        "praise_concept": "¡Guau, lo explicaste muy claro!",
        "praise_procedure": "¡Gracias, profe!",
        "thanks_move_on": "¡Bueno, gracias por ayudarme!",
        "incorrect_expl": "Mmm, si lo hago así, me sigue dando {lumi}. ¿Me lo explicas de otra forma?",
        "let_me_help": "Déjame pensar. {rule} ¡Ahora entiendo!",
        "like_taught": "¡Voy a probar uno nuevo, como me enseñaste!",
        "you_said": "Dijiste: {quote}.",
        "so": "¡Entonces es {answer}!",
        "did_i": "¿Lo hice bien?",
        "learned": "¡Yupi! ¡Aprendí {label}!",
        "thanks_help": "¡Gracias por ayudarme, profe!",
        "demo_disagree": "Mmm, lo revisé dos veces y me sigue dando {answer}. ¡Creo que ya lo entendí!",
        "find_intro": "Mi maestra dice que otra de las mías tiene un error. ¿Puedes encontrarla?",
        "find_two": "Creo que es una de estas dos…",
        "find_one": "¿Puedes revisar el número {id} con mucho cuidado?",
        "find_found": "¡Sí, esa! ¿Cuál debería ser mi respuesta?",
        "find_point": "¡Creo que es el número {id}! ¿Cuál debería ser mi respuesta?",
        "find_ok": "Mmm, creo que esa está bien.",
        "sure": "¿Estás seguro? Revisémoslo juntos. {check} ¿Tenía razón?",
        "fa_agree": "¡Uf! Revisar mi trabajo fue una gran idea, profe.",
        "fa_disagree": "Mmm, conté dos veces y me dio {answer} las dos veces. ¡Le pedimos a un adulto que lo revise después!",
        "done": "¡Gracias, profe! Encontraste {caught} de mis {planted} errores. ¡Aprendí muchísimo!",
        "steps": {
            "ones_add": "Primero las unidades: {x} más {y} es {s}.",
            "carry_write": "Escribo {w} y llevo 1.",
            "tens_add_carry": "Luego las decenas: {x} más {y} más 1 es {s}.",
            "tens_add": "Luego las decenas: {x} más {y} es {s}.",
            "ones_sub_borrow": "Primero las unidades: {x} es menor que {y}, así que pido prestada una decena. {x10} menos {y} es {d}.",
            "tens_sub_borrow": "Luego las decenas: me quedan {x}. {x} menos {y} es {d}.",
            "ones_sub": "Primero las unidades: {x} menos {y} es {d}.",
            "tens_sub": "Luego las decenas: {x} menos {y} es {d}.",
            "mul": "Hago {a} grupos de {b}. Cuento de {b} en {b}: {seq}.",
        },
        "concepts": {
            "carry": {
                "label": "la suma",
                "ask_why": "¡Oh! ¿Pero por qué el 1 se pasa a las decenas?",
                "point": "Mmm, ¿mi error fue en las unidades o en las decenas?",
                "rule": "Cuando las unidades suman 10 o más, llevamos 1 a las decenas.",
                "wrong_fix": "Mmm, probé {answer} y todavía no se ve bien. ¿Miramos juntos las unidades?",
                "chips": ["Se te olvidó llevar el 1 a las decenas", "Hay que sumar las decenas primero", "La respuesta debe ser más pequeña"],
            },
            "borrow": {
                "label": "la resta",
                "ask_why": "¡Oh! ¿Pero por qué tengo que pedir prestado a las decenas?",
                "point": "Mmm, ¿mi error fue en las unidades o en las decenas?",
                "rule": "Cuando el número de arriba en las unidades es muy pequeño, pedimos prestada una decena.",
                "wrong_fix": "Mmm, probé {answer} y todavía no se ve bien. ¿Miramos juntos las unidades?",
                "chips": ["Tenías que pedir prestada una decena primero", "Siempre se resta el pequeño del grande", "Había que sumar"],
            },
            "off_by_one": {
                "label": "a contar",
                "ask_why": "¡Oh! ¿Cómo reviso para no contar mal?",
                "point": "Mmm, ¿conté de más o de menos?",
                "rule": "Tenemos que contar con cuidado y revisar la respuesta.",
                "wrong_fix": "Mmm, probé {answer} y todavía no se ve bien. ¿Lo contamos despacio juntos?",
                "chips": ["Contaste uno de más o uno de menos", "Se te olvidó llevar el 1", "Había que restar"],
            },
            "mul": {
                "label": "la multiplicación",
                "ask_why": "¡Oh! ¿Cuántos grupos tengo que contar?",
                "point": "Mmm, ¿conté grupos de más o de menos?",
                "rule": "Contamos exactamente el número correcto de grupos.",
                "wrong_fix": "Mmm, probé {answer} y todavía no se ve bien. ¿Contamos los grupos juntos?",
                "chips": ["Contaste un grupo de más o de menos", "Había que sumar los dos números", "Multiplicar es restar"],
            },
        },
    },
    "vi": {
        "intro": "Mình làm bài tập rồi! Bạn làm cô giáo của mình nhé? Chạm ✓ nếu mình làm đúng, hoặc ✗ nếu mình sai, rồi viết đáp án đúng.",
        "review_intro": "Hình như mình quên một chút rồi. Bạn kiểm tra bài của mình lần nữa nhé?",
        "practice_first": "Mình cùng luyện tập trước đã, rồi bạn dạy mình nhé! Mở mục Luyện tập.",
        "checked_all": "Bạn đã kiểm tra cả trang của mình!",
        "explain_ask": "Ôi, bạn nói đúng! Sao {lumi} lại sai? Mình sai ở đâu vậy?",
        "found_ask": "Bạn tìm ra lỗi của mình ở bài {id}! Đáp án của mình phải là bao nhiêu?",
        "fix_right": "Đúng rồi! Đó là đáp án đúng. Bây giờ bạn nói mình nghe, sao bài của mình lại sai?",
        "role_switch": "Lần này để mình giúp bạn, rồi bạn dạy lại mình nhé!",
        "help4": "Đáp án là {answer}. {explain} Bạn gõ vào giúp mình nhé?",
        "help_fixed": "Bạn làm được rồi! Bây giờ bạn nói mình nghe sao bài của mình sai nhé?",
        "praise_concept": "Oa, bạn giải thích rõ ràng quá!",
        "praise_procedure": "Cảm ơn bạn nhé!",
        "thanks_move_on": "Được rồi, cảm ơn bạn đã giúp mình!",
        "incorrect_expl": "Ừm, nếu làm như vậy thì mình vẫn ra {lumi}. Bạn giải thích cách khác được không?",
        "let_me_help": "Để mình nghĩ nào. {rule} Mình hiểu rồi!",
        "like_taught": "Để mình thử bài mới, như bạn đã dạy mình nhé!",
        "you_said": "Bạn đã nói: {quote}.",
        "so": "Vậy là {answer}!",
        "did_i": "Mình làm đúng chưa?",
        "learned": "Yay! Mình học được {label} rồi!",
        "thanks_help": "Cảm ơn bạn đã giúp mình!",
        "demo_disagree": "Ừm, mình kiểm tra hai lần rồi mà vẫn ra {answer}. Mình nghĩ mình hiểu rồi!",
        "find_intro": "Cô giáo của mình nói còn một bài nữa bị sai. Bạn tìm giúp mình nhé?",
        "find_two": "Mình nghĩ là một trong hai bài này…",
        "find_one": "Bạn kiểm tra thật kỹ bài số {id} nhé?",
        "find_found": "Đúng bài đó! Đáp án của mình phải là bao nhiêu?",
        "find_point": "Mình nghĩ là bài số {id}! Đáp án của mình phải là bao nhiêu?",
        "find_ok": "Ừm, mình nghĩ bài đó ổn mà.",
        "sure": "Bạn chắc không? Mình cùng kiểm tra nhé. {check} Mình làm đúng không?",
        "fa_agree": "Phù! Kiểm tra lại bài là ý hay đó bạn.",
        "fa_disagree": "Ừm, mình đếm hai lần đều ra {answer}. Lát nữa mình nhờ người lớn kiểm tra nhé!",
        "done": "Cảm ơn bạn! Bạn đã tìm ra {caught} trong {planted} lỗi của mình. Mình học được nhiều lắm!",
        "steps": {
            "ones_add": "Đầu tiên hàng đơn vị: {x} cộng {y} bằng {s}.",
            "carry_write": "Mình viết {w} và nhớ 1.",
            "tens_add_carry": "Rồi hàng chục: {x} cộng {y} cộng 1 bằng {s}.",
            "tens_add": "Rồi hàng chục: {x} cộng {y} bằng {s}.",
            "ones_sub_borrow": "Đầu tiên hàng đơn vị: {x} nhỏ hơn {y}, nên mình mượn một chục. {x10} trừ {y} bằng {d}.",
            "tens_sub_borrow": "Rồi hàng chục: còn lại {x}. {x} trừ {y} bằng {d}.",
            "ones_sub": "Đầu tiên hàng đơn vị: {x} trừ {y} bằng {d}.",
            "tens_sub": "Rồi hàng chục: {x} trừ {y} bằng {d}.",
            "mul": "Mình làm {a} nhóm, mỗi nhóm {b}. Mình đếm thêm {b}: {seq}.",
        },
        "concepts": {
            "carry": {
                "label": "phép cộng",
                "ask_why": "Ồ! Nhưng sao số 1 lại sang hàng chục?",
                "point": "Ừm, mình sai ở hàng đơn vị hay hàng chục?",
                "rule": "Khi hàng đơn vị cộng lại được 10 trở lên, mình nhớ 1 sang hàng chục.",
                "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng xem hàng đơn vị nhé?",
                "chips": ["Bạn quên nhớ 1 sang hàng chục", "Phải cộng hàng chục trước", "Đáp án phải nhỏ hơn"],
            },
            "borrow": {
                "label": "phép trừ",
                "ask_why": "Ồ! Nhưng sao mình phải mượn ở hàng chục?",
                "point": "Ừm, mình sai ở hàng đơn vị hay hàng chục?",
                "rule": "Khi số ở trên hàng đơn vị nhỏ quá, mình mượn một chục.",
                "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng xem hàng đơn vị nhé?",
                "chips": ["Bạn phải mượn một chục trước", "Luôn lấy số lớn trừ số nhỏ", "Phải cộng mới đúng"],
            },
            "off_by_one": {
                "label": "cách đếm",
                "ask_why": "Ồ! Làm sao để mình kiểm tra cho khỏi đếm sai?",
                "point": "Ừm, mình đếm thừa hay đếm thiếu?",
                "rule": "Mình phải đếm cẩn thận và kiểm tra lại đáp án.",
                "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng đếm chậm lại nhé?",
                "chips": ["Bạn đếm thừa một hoặc thiếu một", "Bạn quên nhớ 1", "Phải trừ mới đúng"],
            },
            "mul": {
                "label": "phép nhân",
                "ask_why": "Ồ! Mình phải đếm bao nhiêu nhóm?",
                "point": "Ừm, mình đếm thừa nhóm hay thiếu nhóm?",
                "rule": "Mình đếm đúng số nhóm cần có.",
                "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng đếm các nhóm nhé?",
                "chips": ["Bạn đếm thừa hoặc thiếu một nhóm", "Phải cộng hai số lại", "Nhân là trừ đi"],
            },
        },
    },
}

# ---------- explanation rating: keyword rules (mock mode / LLM fallback) ----------

_RULES: dict[str, dict[str, str]] = {
    "carry": {
        "wrong": r"\bborrow|take away|subtract|minus|prest|\bresta|mượn|trừ",
        "why": r"\bten(s)?\b|\b1[0-8]\b|more than (9|nine)|bigger than (9|nine)|over (9|nine)|teen\b|\bdiez\b|decena|m[aá]s de (9|nueve)|mười|chục|hơn (9|chín)",
        "action": r"\bcarr(y|ied|ying)\b|\bregroup|llev|acarre|nhớ",
    },
    "borrow": {
        "wrong": r"\bcarr(y|ied)\b|\badd\b|\bplus\b|llev|\bsum|nhớ|cộng",
        "why": r"\bten(s)?\b|\b10\b|too small|smaller|can'?t take|cannot take|not enough|\bdiez\b|decena|peque|no (se )?puede|no alcanza|mười|chục|nhỏ hơn|không đủ|không trừ được",
        "action": r"\bborrow|\bregroup|\btrade|prest|mượn",
    },
    "off_by_one": {
        "wrong": r"\bcarr(y|ied)\b|\bborrow|llev|prest|nhớ|mượn",
        "why": r"\bcheck|again|careful|slow|revis|otra vez|cuidado|despacio|kiểm tra|lại|cẩn thận|chậm",
        "action": r"count|one (more|less|too)|by one|plus one|minus one|off by|cont|uno (m[aá]s|menos)|de m[aá]s|de menos|đếm|thừa|thiếu",
    },
    "mul": {
        "wrong": r"\badd\b|\bplus\b|take away|minus|\bsum|\bresta|cộng|trừ",
        "why": r"one (more|less|extra)|extra|too many|too few|exactly|right number|de m[aá]s|de menos|uno m[aá]s|uno menos|exact|thừa|thiếu|đúng số|chính xác",
        "action": r"group|times|skip|count by|grupo|veces|cont|nhóm|lần|đếm",
    },
}

_RULES.update(cx.RULES)
for _lang in TT:
    for _c in NEW_CONCEPTS:
        TT[_lang]["concepts"][_c] = cx.concept_text(_lang, _c)

_AFFIRM = {
    "en": r"\b(yes|yeah|yep|right|correct|good|great|exactly|perfect|well done)\b",
    "es": r"\b(s[ií]|correcto|bien|exacto|perfecto|muy bien)\b",
    "vi": r"(đúng|giỏi|chính xác|tuyệt)",
}


def classify_rules(concept: str, text: str) -> str:
    t = (text or "").lower().strip()
    if not t:
        return "vague"
    r = _RULES[concept]
    if re.search(r["wrong"], t):
        return "incorrect"
    if re.search(r["why"], t):
        return "concept"
    if re.search(r["action"], t):
        return "procedure"
    return "vague"


def _affirms(text: str, lang: str) -> bool:
    return re.search(_AFFIRM[lang], text.lower()) is not None


# ---------- worksheet generation ----------

def _digits(n: int) -> tuple[int, int]:
    return n // 10, n % 10


def _make(concept: str, planted: bool, rng: random.Random) -> tuple[str, str]:
    """One problem of the given concept. Lumi's answer is wrong (planted) or SymPy-correct."""
    if concept == "carry":
        a1 = rng.randint(2, 9)
        b1 = rng.randint(10 - a1, 9)
        a10 = rng.randint(1, 7)
        b10 = rng.randint(1, 8 - a10)
        a, b = 10 * a10 + a1, 10 * b10 + b1
        expr, wrong = f"{a} + {b}", _add_no_carry(a, b)
    elif concept == "borrow":
        a1 = rng.randint(0, 8)
        b1 = rng.randint(a1 + 1, 9)
        a10 = rng.randint(2, 9)
        b10 = rng.randint(1, a10 - 1)
        a, b = 10 * a10 + a1, 10 * b10 + b1
        expr, wrong = f"{a} - {b}", _sub_smaller_from_larger(a, b)
    elif concept == "off_by_one":
        if rng.random() < 0.5:
            a1 = rng.randint(1, 8)
            b1 = rng.randint(0, 9 - a1)
            a10 = rng.randint(1, 8)
            b10 = rng.randint(1, 9 - a10)
            expr = f"{10 * a10 + a1} + {10 * b10 + b1}"
        else:
            a1 = rng.randint(1, 9)
            b1 = rng.randint(0, a1)
            a10 = rng.randint(2, 9)
            b10 = rng.randint(1, a10 - 1)
            expr = f"{10 * a10 + a1} - {10 * b10 + b1}"
        wrong = int(evaluate(expr)) + rng.choice([1, -1])
    elif concept == "mul":
        a, b = rng.randint(2, 9), rng.randint(3, 9)
        expr, wrong = f"{a} × {b}", a * (b + rng.choice([1, -1]))
    else:
        raise ValueError(concept)
    correct = format_answer(expr, evaluate(expr))
    return expr, (str(wrong) if planted else correct)


def _problem(pid: int, concept: str, planted: bool, rng: random.Random, used: set[str],
             lang: str = "en", dream: Optional[str] = None) -> TeachProblem:
    if concept in NEW_CONCEPTS:
        for _ in range(50):
            # verified: right answer, planted mistake = this concept; the dream only swaps graph pictures
            item = dreams.dress_item(cx.make(concept, rng, lang), dream)
            if item.problem in used:
                continue
            used.add(item.problem)
            lumi = cx.display(item, item.wrong if planted else item.answer, lang)
            return TeachProblem(id=pid, problem=item.problem, lumi_answer=lumi, correct_answer=item.answer,
                                planted=planted, concept=concept, kind=item.kind, visual=item.visual, data=item.data,
                                story=dreams.story(dream, concept, item.problem, item.data, lang, used))
        raise TeachGenerationError(f"could not generate a {concept} problem")
    for _ in range(50):
        expr, lumi = _make(concept, planted, rng)
        if expr in used:
            continue
        result = check(expr, lumi)
        if result.is_correct == planted:
            continue
        error_step = None
        if planted:
            error_step, tag = diagnose(expr, lumi)
            if tag != concept:
                continue
        used.add(expr)
        return TeachProblem(id=pid, problem=expr, lumi_answer=lumi, correct_answer=result.correct_answer,
                            planted=planted, concept=concept, error_step=error_step,
                            story=dreams.story(dream, concept, expr, {}, lang, used))
    raise TeachGenerationError(f"could not generate a {concept} problem")


def ready_concepts(session: Session) -> set[str]:
    """Concepts the child has shown: in Help mode (solved correctly, or fixed after hints) for the original
    four, in a quick warm-up for the newer eight, plus anything shown on earlier days (saved progress)."""
    ready: set[str] = set(session.saved_ready) | session.warm_ready
    for st in session.problems.values():
        if (st.last is not None and st.last.is_correct) or st.fixed:
            ready |= concepts_of(st.key) & set(TEACHABLE)
    return ready & set(ALL_CONCEPTS)


def _demo_problems(dream: Optional[str] = None, lang: str = "en",
                   used: Optional[set[str]] = None) -> list[TeachProblem]:
    problems = []
    for i, (expr, lumi, planted, concept) in enumerate(DEMO_SHEET, start=1):
        result = check(expr, lumi)
        error_step, tag = diagnose(expr, lumi) if planted else (None, concept)
        if result.is_correct == planted or tag != concept:
            raise TeachGenerationError(f"demo sheet row {i} failed verification")
        problems.append(TeachProblem(id=i, problem=expr, lumi_answer=lumi, correct_answer=result.correct_answer,
                                     planted=planted, concept=concept, error_step=error_step,
                                     story=dreams.story(dream, concept, expr, {}, lang, used)))
    return problems


def _problem_out(p: TeachProblem) -> LumiProblemOut:
    # With a dream, the child sees only the short story question (same numbers, "?" = the answer's place).
    return LumiProblemOut(id=p.id, problem=p.story or p.problem, lumi_answer=p.lumi_answer, kind=p.kind,
                          visual=p.visual)


def new_worksheet(session: Session, lang: str, force: bool, rng: Optional[random.Random] = None,
                  demo: bool = False, concept: Optional[str] = None) -> TeachWorksheetResponse:
    if demo:  # explicit adult demo action: fixed sheet, bypasses the gate on purpose
        stories: set[str] = set()
        st = TeachState(worksheet_id=uuid.uuid4().hex[:8], problems=_demo_problems(session.dream, lang, stories),
                        demo=True, used_stories=stories)
        session.teach = st
        session.log("teach_worksheet", worksheet_id=st.worksheet_id, concepts=["borrow", "carry"],
                    planted=[p.id for p in st.problems if p.planted], demo=True)
        turn = _turn(session, "happy", dreams.intro(session.dream, lang, "intro") or TT[lang]["intro"], "mark")
        return TeachWorksheetResponse(
            ready=True, demo=True, worksheet_id=st.worksheet_id, concepts=["carry", "borrow"],
            problems=[_problem_out(p) for p in st.problems], turn=turn,
        )
    rng = rng or random.Random()
    ready = ready_concepts(session)
    if concept is not None and force:
        ready = ready | {concept}
    if concept is not None and concept not in ready:
        # The child picked something they haven't shown yet: practice first (Help mode or a warm-up).
        session.teach = None
        needs = "warmup" if concept in NEW_CONCEPTS else "help"
        say = TT[lang]["practice_first"] if needs == "help" else cx.WARMUP_TEXT[lang]["intro"].format(
            label=TT[lang]["concepts"][concept]["label"])
        turn = TeachTurn(emotion="encouraging", say=say, step="practice_first", mastery=_mastery(session))
        return TeachWorksheetResponse(ready=False, needs=needs, turn=turn)
    if not ready and force:
        ready = {"carry", "off_by_one"}
    if not ready:
        session.teach = None
        turn = TeachTurn(emotion="encouraging", say=TT[lang]["practice_first"], step="practice_first",
                         mastery=_mastery(session))
        return TeachWorksheetResponse(ready=False, turn=turn)

    stars = lambda c: session.lumi_mastery.get(c, 0.0)  # noqa: E731
    ordered = [c for c in ALL_CONCEPTS if c in ready]
    n_planted = rng.choice([2, 3])
    if concept is not None:
        # The child chose what to teach: every planted mistake is that concept; the correct rows mix in
        # other concepts they know (the chosen one twice as often), so the whole page still needs checking.
        review = stars(concept) >= MAX_STARS
        pool = [concept] + [c for c in ordered if c != concept]
        planted = [concept] * n_planted
        correct = rng.choices(pool, weights=[2] + [1] * (len(pool) - 1), k=N_PROBLEMS - n_planted)
    else:
        pool = [c for c in ordered if stars(c) < MAX_STARS]
        review = not pool
        pool = pool or ordered
        primary = min(pool, key=lambda c: (stars(c), rng.random()))
        weights = [2 if c == primary else 1 for c in pool]
        planted = [primary] + rng.choices(pool, weights=weights, k=n_planted - 1)
        correct = rng.choices(pool, k=N_PROBLEMS - n_planted)
    plan = [(c, True) for c in planted] + [(c, False) for c in correct]
    rng.shuffle(plan)
    used: set[str] = set()
    problems = [_problem(i + 1, c, p, rng, used, lang, session.dream) for i, (c, p) in enumerate(plan)]

    st = TeachState(worksheet_id=uuid.uuid4().hex[:8], problems=problems, review=review,
                    used_stories={u for u in used if u.startswith("story:")})
    session.teach = st
    session.log("teach_worksheet", worksheet_id=st.worksheet_id, concepts=sorted(set(pool)),
                planted=[p.id for p in problems if p.planted], demo=False)
    key = "review_intro" if review else "intro"
    turn = _turn(session, "happy", dreams.intro(session.dream, lang, key) or TT[lang][key], "mark")
    return TeachWorksheetResponse(
        ready=True, worksheet_id=st.worksheet_id, concepts=sorted(set(pool), key=ALL_CONCEPTS.index),
        problems=[_problem_out(p) for p in problems], turn=turn,
    )


# ---------- the concept menu and the warm-up (gate for the newer concepts) ----------

def concept_menu(session: Session, lang: str) -> list[TeachConceptOut]:
    """Every concept the child can choose to teach, with Lumi's stars and what unlocks it."""
    ready = ready_concepts(session)
    return [
        TeachConceptOut(concept=c, label=TT[lang]["concepts"][c]["label"], stars=session.lumi_mastery.get(c, 0.0),
                        ready=c in ready, gate="warmup" if c in NEW_CONCEPTS else "help")
        for c in ALL_CONCEPTS
    ]


def start_warmup(session: Session, lang: str, concept: str, rng: Optional[random.Random] = None) -> WarmupResponse:
    if concept not in NEW_CONCEPTS:
        raise ValueError(concept)
    rng = rng or random.Random()
    items, seen = [], set()
    while len(items) < 2:
        it = cx.make(concept, rng, lang)
        if it.problem not in seen:
            seen.add(it.problem)
            items.append(it)
    wid = uuid.uuid4().hex[:8]
    session.warmup = {"id": wid, "concept": concept, "answers": [it.answer for it in items],
                      "kinds": [it.kind for it in items]}
    session.log("warmup_started", concept=concept)
    say = cx.WARMUP_TEXT[lang]["intro"].format(label=TT[lang]["concepts"][concept]["label"])
    return WarmupResponse(warmup_id=wid, concept=concept, say=say, problems=[
        WarmupProblemOut(id=i + 1, problem=it.problem, kind=it.kind, visual=it.visual) for i, it in enumerate(items)])


def check_warmup(session: Session, lang: str, warmup_id: str, answers: list[str]) -> Optional[WarmupCheckResponse]:
    w = session.warmup
    if not w or w["id"] != warmup_id:
        return None
    results = [cx.is_correct(k, a, (answers[i] if i < len(answers) else ""))
               for i, (k, a) in enumerate(zip(w["kinds"], w["answers"]))]
    passed = all(results)
    session.warmup = None
    session.log("warmup_checked", concept=w["concept"], passed=passed)
    label = TT[lang]["concepts"][w["concept"]]["label"]
    if passed:
        session.warm_ready.add(w["concept"])
    say = cx.WARMUP_TEXT[lang]["pass" if passed else "fail"].format(label=label)
    return WarmupCheckResponse(passed=passed, results=results, say=say,
                               emotion="celebrating" if passed else "encouraging")


# ---------- demo / check narration (numbers from Python, answer from SymPy) ----------

def demo_steps(expr: str, lang: str) -> list[str]:
    s = TT[lang]["steps"]
    op, ab = operator_of(expr), operands(expr)
    if not ab:
        return []
    a, b = ab
    if op == "*":
        seq = ", ".join(str(b * i) for i in range(1, a + 1))
        return [s["mul"].format(a=a, b=b, seq=seq)]
    a10, a1 = _digits(a)
    b10, b1 = _digits(b)
    if op == "+":
        ones = a1 + b1
        if ones >= 10:
            return [s["ones_add"].format(x=a1, y=b1, s=ones), s["carry_write"].format(w=ones % 10),
                    s["tens_add_carry"].format(x=a10, y=b10, s=a10 + b10 + 1)]
        return [s["ones_add"].format(x=a1, y=b1, s=ones), s["tens_add"].format(x=a10, y=b10, s=a10 + b10)]
    if op == "-":
        if a1 < b1:
            return [s["ones_sub_borrow"].format(x=a1, y=b1, x10=a1 + 10, d=a1 + 10 - b1),
                    s["tens_sub_borrow"].format(x=a10 - 1, y=b10, d=a10 - 1 - b10)]
        return [s["ones_sub"].format(x=a1, y=b1, d=a1 - b1), s["tens_sub"].format(x=a10, y=b10, d=a10 - b10)]
    return []


def _item(p: TeachProblem) -> "cx.Item":
    return cx.item_from(p.concept, p.problem, p.correct_answer, p.kind, p.visual, p.data)


def _steps(p: TeachProblem, lang: str) -> list[str]:
    return cx.steps(_item(p), lang) if p.concept in NEW_CONCEPTS else demo_steps(p.problem, lang)


def _show(p: TeachProblem, answer: str, lang: str) -> str:
    """An answer the way the child sees it (e.g. 80,000 / 80.000)."""
    return cx.display(_item(p), answer, lang) if p.concept in NEW_CONCEPTS else answer


def _answer_ok(p: TeachProblem, answer: Optional[str]) -> bool:
    if p.concept in NEW_CONCEPTS:
        return cx.is_correct(p.kind, p.correct_answer, answer)
    return bool(answer) and check(p.problem, answer).is_correct


def _cline(p: TeachProblem, lang: str, key: str, **kw) -> str:
    """A concept's line, with this problem's numbers filled in (some newer lines name the digit or object)."""
    line = TT[lang]["concepts"][p.concept][key]
    fields = cx._fields(_item(p), lang) if p.concept in NEW_CONCEPTS else {}
    return line.format(**{**fields, **kw}) if ("{" in line) else line


def _chips(lang: str, concept: str, rng: random.Random) -> list[TeachChip]:
    texts = TT[lang]["concepts"][concept]["chips"]
    chips = [TeachChip(id=f"c{i}", text=t) for i, t in enumerate(texts)]  # c0 is the correct one
    rng.shuffle(chips)
    return chips


# ---------- turn engine ----------

def _mastery(session: Session) -> dict[str, float]:
    return {c: session.lumi_mastery.get(c, 0.0) for c in ALL_CONCEPTS}


def _stats(st: TeachState) -> TeachStats:
    planted = [p for p in st.problems if p.planted]
    return TeachStats(
        caught=sum(1 for p in planted if p.outcome in ("caught_fixed", "caught_unfixed")),
        planted=len(planted),
        false_alarms=sum(1 for p in st.problems if p.outcome == "false_alarm"),
    )


def _turn(session: Session, emotion: str, say: str, step: str, p: Optional[TeachProblem] = None, **kw) -> TeachTurn:
    st = session.teach
    # Never reveal which rows are still-unfound mistakes (or which were right) before the end:
    # the child's own marks (caught / false alarm) are shown; misses only once found.
    outcomes = [
        TeachOutcomeOut(id=x.id, outcome=x.outcome) for x in st.problems
        if x.outcome and (st.done or x.outcome in ("caught_fixed", "caught_unfixed", "false_alarm")
                          or (x.outcome == "missed" and x.found))
    ] if st else []
    turn = TeachTurn(emotion=emotion, say=say.strip(), step=step, focus_problem_id=p.id if p else None,
                     outcomes=outcomes, mastery=_mastery(session), help_level=p.help_level if p else 0, **kw)
    if st:
        st.last_turn = turn.model_dump()
    return turn


def _rng(st: TeachState, p: TeachProblem, salt: int = 0) -> random.Random:
    # The demo sheet uses a fixed seed so rehearsals show the same chip order and demo problem.
    return random.Random(f"{'demo' if st.demo else st.worksheet_id}-{p.id}-{salt}")


def _sanitize(text: Optional[str]) -> Optional[str]:
    """LLM text -> one short plain sentence (no markup), or None."""
    if not text:
        return None
    text = re.sub(r"[*_#`<>\[\]{}|]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > MAX_REACTION_CHARS:
        text = text[:MAX_REACTION_CHARS].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return text or None


def _open(session: Session, p: TeachProblem, lang: str, prefix: str = "") -> TeachTurn:
    """First turn for a queued problem."""
    st, t = session.teach, TT[lang]
    st.current = p.id
    if p.outcome == "caught_fixed":
        p.stage = "explain"
        return _turn(session, "curious", f"{prefix} {t['explain_ask'].format(lumi=p.lumi_answer)}", "explain", p,
                     chips=_chips(lang, p.concept, _rng(st, p)))
    if p.outcome == "caught_unfixed":
        p.stage = "fix"
        if p.child_fix:
            p.fix_tries = 1
            line = _cline(p, lang, "wrong_fix", answer=p.child_fix)
            return _turn(session, "confused", f"{prefix} {line}", "fix", p)
        return _turn(session, "happy", f"{prefix} {t['found_ask'].format(id=p.id)}", "fix", p)
    if p.outcome == "false_alarm":
        p.stage = "sure"
        steps = " ".join(_steps(p, lang))
        if p.concept not in NEW_CONCEPTS:  # the newer concepts' steps already end with the answer
            steps += " " + t["so"].format(answer=_show(p, p.correct_answer, lang))
        return _turn(session, "curious", f"{prefix} {t['sure'].format(check=steps)}", "sure", p)
    # missed
    p.stage, p.nudge = "find", 1
    return _turn(session, "curious", f"{prefix} {t['find_intro']}", "find", None)


def _help_line(p: TeachProblem, lang: str) -> str:
    if p.concept in NEW_CONCEPTS:
        if p.help_level >= 4:
            return TT[lang]["help4"].format(answer=_show(p, p.correct_answer, lang), explain=_cline(p, lang, "rule"))
        return cx.hint(_item(p), lang, p.help_level)
    if p.help_level >= 4:
        return TT[lang]["help4"].format(answer=p.correct_answer, explain=HELP_T[lang]["explain"])
    stub = SimpleNamespace(problem=normalize_expression(p.problem))
    line = HELP_T[lang][p.help_level].format(
        id=p.id, problem=_pretty(p.problem), answer=p.correct_answer, step=_worked_step(stub, lang),
        explain=HELP_T[lang]["explain"], practice="",
    )
    return line


def _start_demo(session: Session, p: TeachProblem, lang: str, reaction: str, gain: float) -> TeachTurn:
    st, t = session.teach, TT[lang]
    rng = _rng(st, p, 1)
    visual = None
    if p.concept in NEW_CONCEPTS:  # a fresh problem of the same concept, never the one just discussed
        item = next(i for i in iter(lambda: dreams.dress_item(cx.make(p.concept, rng, lang), session.dream), None)
                    if i.problem != p.problem)
        expr, answer, steps, visual = item.problem, cx.display(item, item.answer, lang), cx.steps(item, lang), item.visual
    else:
        expr = next(e for e, _ in iter(lambda: _make(p.concept, False, rng), None) if e != p.problem)
        answer = format_answer(expr, evaluate(expr))
        steps = demo_steps(expr, lang)
    so = t["so"].format(answer=answer) if p.concept not in NEW_CONCEPTS else ""  # newer steps end with the answer
    p.stage = "demo"
    p.gain = 0.0 if p.role_switched else gain
    p.demo = {"problem": expr, "answer": answer}
    quote = t["you_said"].format(quote=f"“{p.quote}”") if p.quote else ""
    say = " ".join(x for x in [reaction, quote, t["like_taught"], *steps, so, t["did_i"]] if x)
    story = dreams.story(session.dream, p.concept, expr, item.data if p.concept in NEW_CONCEPTS else {}, lang,
                         st.used_stories)  # a version not already on the page
    return _turn(session, "happy", say, "demo", p,
                 demo=TeachDemo(problem=story or expr, steps=[*steps, so] if so else steps, answer=answer,
                                visual=visual))


async def _rate(session: Session, p: TeachProblem, lang: str, text: str) -> tuple[str, Optional[str], Optional[str]]:
    """Returns (quality, llm_reaction or None, quote or None)."""
    if not text.strip():
        return "vague", None, None
    if llm.enabled():
        c = TT["en"]["concepts"][p.concept]
        out = await llm.generate(
            TeachExplainLLM,
            llm.prompt(
                "teach_explain", robot_name=ROBOT_NAME, language_name=LANGUAGE_NAMES[lang],
                concept=c["label"], problem=_pretty(p.problem), lumi_answer=p.lumi_answer,
                correct_answer=_show(p, p.correct_answer, "en"), error_step=p.error_step or "(unknown)",
                child_said=text, followups=p.followups,
            ),
            temperature=0.4, label="teach_rate",
        )
        if out is not None:
            reaction = _sanitize(out.reaction)
            if reaction and out.quality in ("incorrect", "vague") and _affirms(reaction, lang):
                reaction = None  # never affirm a wrong / empty explanation
            quote = _sanitize(out.quote)
            return out.quality, reaction, (quote[:80] if quote else None)
    quality = classify_rules(p.concept, text)
    return quality, None, (text.strip()[:80] if quality in ("concept", "procedure") else None)


async def _explain(session: Session, p: TeachProblem, req: TeachTurnRequest) -> TeachTurn:
    lang, t = req.language, TT[req.language]
    c = t["concepts"][p.concept]
    st = session.teach
    if req.chip_id:
        quality, reaction, quote = ("procedure" if req.chip_id == "c0" else "incorrect"), None, None
        chip_final = req.chip_id == "c0"
    else:
        quality, reaction, quote = await _rate(session, p, lang, req.child_said or "")
        chip_final = False
    session.log("teach_explained", problem=p.problem, concept=p.concept, quality=quality,
                source="chip" if req.chip_id else ("speech" if (req.child_said or "").strip() else "none"))
    if quote and quality in ("concept", "procedure"):
        p.quote = quote
        prev = session.teach_quotes.get(p.concept)
        if prev is None or (prev[0] != "concept" and quality == "concept"):
            session.teach_quotes[p.concept] = (quality, quote)

    if quality == "incorrect":
        p.incorrect += 1
        if p.incorrect >= 2:
            p.role_switched = True
            session.log("teach_role_switch", problem=p.problem, reason="explanation")
            return _start_demo(session, p, lang, t["let_me_help"].format(rule=_cline(p, lang, "rule")), 0.0)
        line = reaction or t["incorrect_expl"].format(lumi=p.lumi_answer)
        return _turn(session, "confused", line, "explain", p, chips=_chips(lang, p.concept, _rng(st, p, 2)))
    if quality == "concept":
        return _start_demo(session, p, lang, reaction or t["praise_concept"], 1.0)
    if quality == "procedure":
        if chip_final or p.followups >= 1:
            return _start_demo(session, p, lang, reaction or t["praise_procedure"], max(p.gain, 0.5))
        p.followups, p.gain = 1, 0.5
        return _turn(session, "curious", reaction or _cline(p, lang, "ask_why"), "explain", p)
    # vague (after a "why?" follow-up to a procedure answer, move on and keep the ½ star)
    if p.followups < 2 and p.gain == 0:
        p.followups += 1
        return _turn(session, "curious", reaction or _cline(p, lang, "point"), "explain", p,
                     chips=_chips(lang, p.concept, _rng(st, p, 3)))
    return _start_demo(session, p, lang, t["thanks_move_on"], p.gain)


def _next(session: Session, lang: str, prefix: str = "") -> TeachTurn:
    st, t = session.teach, TT[lang]
    if st.current is not None:
        cur = st.get(st.current)
        if cur:
            cur.stage = None
    st.current = None
    while st.queue:
        p = st.get(st.queue.pop(0))
        if p is not None:
            return _open(session, p, lang, prefix)
    st.done = True
    stats = _stats(st)
    session.log("teach_done", caught=stats.caught, planted=stats.planted, false_alarms=stats.false_alarms,
                elapsed_s=round(time.time() - st.started), demo=st.demo)
    say = f"{prefix} {t['done'].format(caught=stats.caught, planted=stats.planted)}"
    return _turn(session, "celebrating", say, "done", None, stats=stats)


def _check(session: Session, req: TeachTurnRequest) -> TeachTurn:
    st, lang = session.teach, req.language
    marks = {m.id: m for m in req.marks}
    for p in st.problems:
        m = marks.get(p.id)
        mark = m.mark if m else "none"
        if mark == "circle":
            fix = (m.correction or "").strip() or None
            p.child_fix = fix
            if p.planted:
                p.outcome = "caught_fixed" if _answer_ok(p, fix) else "caught_unfixed"
            else:
                p.outcome = "false_alarm"
        else:  # "check" or unmarked count as "you got it right"
            p.outcome = "missed" if p.planted else "confirmed_ok"
    st.checked = True
    talk = [p.id for p in st.problems if p.outcome in ("caught_fixed", "caught_unfixed", "false_alarm")]
    missed = [p.id for p in st.problems if p.outcome == "missed"]
    st.queue = talk + missed
    session.log("teach_checked", worksheet_id=st.worksheet_id, outcomes={p.id: p.outcome for p in st.problems})
    all_good = not missed and not any(p.outcome == "false_alarm" for p in st.problems)
    return _next(session, lang, TT[lang]["checked_all"] if all_good else "")


def _find(session: Session, p: TeachProblem, req: TeachTurnRequest) -> TeachTurn:
    st, t = session.teach, TT[req.language]
    tapped = st.get(req.problem_id)
    pending = set(st.queue) | {p.id}
    if tapped is not None and tapped.outcome == "missed" and tapped.id in pending:
        if tapped.id != p.id:  # the child found a different missed one: handle that one now
            st.queue = [x for x in st.queue if x != tapped.id]
            st.queue.insert(0, p.id)
            p.stage = None
            p = tapped
            st.current = p.id
        p.stage, p.found = "fix", True
        return _turn(session, "happy", t["find_found"], "fix", p)
    p.nudge += 1
    if p.nudge == 2:
        ids = [x.id for x in st.problems]
        i = ids.index(p.id)
        neighbor = ids[i + 1] if i + 1 < len(ids) else ids[i - 1]
        return _turn(session, "curious", f"{t['find_ok']} {t['find_two']}", "find", None,
                     highlight_ids=sorted([p.id, neighbor]))
    if p.nudge == 3:
        return _turn(session, "curious", f"{t['find_ok']} {t['find_one'].format(id=p.id)}", "find", None,
                     highlight_ids=[p.id])
    p.stage, p.found = "fix", True
    return _turn(session, "encouraging", t["find_point"].format(id=p.id), "fix", p, highlight_ids=[p.id])


def _fix(session: Session, p: TeachProblem, req: TeachTurnRequest) -> TeachTurn:
    st, lang, t = session.teach, req.language, TT[req.language]
    answer = (req.answer or "").strip()
    if _answer_ok(p, answer):
        session.log("teach_fixed", problem=p.problem, tries=p.fix_tries, help_level=p.help_level)
        p.stage = "explain"
        line = t["help_fixed"] if p.help_level else t["fix_right"]
        return _turn(session, "happy", line, "explain", p, chips=_chips(lang, p.concept, _rng(st, p)))
    p.fix_tries += 1
    if p.help_level:
        p.help_level = min(4, p.help_level + 1)
        return _turn(session, "encouraging", _help_line(p, lang), "help", p)
    if p.fix_tries >= 2:
        p.help_level, p.role_switched = 1, True
        session.log("teach_role_switch", problem=p.problem, reason="fix")
        return _turn(session, "encouraging", f"{t['role_switch']} {_help_line(p, lang)}", "help", p)
    line = _cline(p, lang, "wrong_fix", answer=answer or "?")
    return _turn(session, "confused", line, "fix", p)


def _confirm(session: Session, p: TeachProblem, req: TeachTurnRequest) -> TeachTurn:
    lang, t = req.language, TT[req.language]
    if p.stage == "sure":
        p.stage = "next"
        if req.agree is False:
            return _turn(session, "encouraging", t["fa_disagree"].format(answer=_show(p, p.correct_answer, lang)), "next", p)
        return _turn(session, "happy", t["fa_agree"], "next", p)
    # demo
    gain = p.gain
    before = session.lumi_mastery.get(p.concept, 0.0)
    session.lumi_mastery[p.concept] = min(MAX_STARS, before + gain)
    session.log("teach_mastery_up", concept=p.concept, gain=gain, stars=session.lumi_mastery[p.concept],
                agree=req.agree is not False)
    p.stage = "next"
    lead = t["demo_disagree"].format(answer=(p.demo or {}).get("answer", "")) if req.agree is False else ""
    if gain > 0:
        label = t["concepts"][p.concept]["label"]
        return _turn(session, "celebrating", f"{lead} {t['learned'].format(label=label)}", "next", p,
                     mastery_up=p.concept)
    return _turn(session, "happy", f"{lead} {t['thanks_help']}", "next", p)


def _repeat(session: Session, req: Optional[TeachTurnRequest] = None) -> TeachTurn:
    """Out-of-order or duplicate action: no state change, the last turn again."""
    if req is not None:
        st = session.teach
        cur = st.get(st.current)
        log.info("teach repeat: action=%s stage=%s session=%s worksheet=%s",
                 req.action, cur.stage if cur else ("done" if st.done else "mark"), session.id, st.worksheet_id)
    return TeachTurn.model_validate(session.teach.last_turn)


async def respond(session: Session, req: TeachTurnRequest) -> TeachTurn:
    """One step of the Teach-mode conversation. Actions that don't fit the current step repeat the last turn."""
    st = session.teach
    if req.action == "check":
        if st.checked:
            return _repeat(session, req)
        return _check(session, req)
    if not st.checked:
        return _repeat(session, req)
    if req.action == "next":
        cur = st.get(st.current)
        if cur is None or cur.stage == "next" or st.done:
            return _repeat(session, req) if st.done else _next(session, req.language)
        return _repeat(session, req)
    p = st.get(st.current)
    if p is None:
        return _repeat(session, req)
    if req.action == "find" and p.stage == "find":
        return _find(session, p, req)
    if req.action == "fix" and p.stage == "fix":
        return _fix(session, p, req)
    if req.action == "explain" and p.stage == "explain":
        return await _explain(session, p, req)
    if req.action == "confirm" and p.stage in ("sure", "demo"):
        return _confirm(session, p, req)
    return _repeat(session, req)
