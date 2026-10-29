"""Lumi's Town: what Lumi can *do* once the child has taught it a skill (docs/03-lumis-town.md).

Visual motivation only. It reads Lumi's stars and the child's best quotes; it never changes them.
All math comes from teach._make (generation) + demo_steps (narration) + SymPy (the answer).
"""
from __future__ import annotations

import random
from typing import Optional

from .math_check import TEACHABLE, evaluate, format_answer, operands, operator_of
from .session import Session
from .teach import TT, _make, demo_steps

UNLOCK_STARS = 1.0  # one real "concept" explanation, or two correct teachings — a single chip isn't enough

PLACES: dict[str, dict] = {
    "en": {
        "dream": "I'm saving up to open a shop in Lumi's Town! Every skill you teach me opens a new place.",
        "need": "Teach Lumi {label} to open it",
        "teaser": "Last time I tried, I said {problem} = {wrong}. Oops! I need a teacher.",
        "carry": {"name": "Lemonade Stand", "emoji": "🍋",
                  "intro": "A customer buys a lemonade for {a}¢ and a cookie for {b}¢. Let me add the prices!",
                  "outro": "That's {answer}¢, please! Thank you, teacher!"},
        "borrow": {"name": "Change Counter", "emoji": "🪙",
                   "intro": "A customer pays {a}¢ for a treat that costs {b}¢. Let me work out the change!",
                   "outro": "Here's your {answer}¢ change! I did it because you taught me."},
        "off_by_one": {"name": "Coin Jar", "emoji": "🫙",
                       "intro_add": "I have {a} coins in my jar and I put in {b} more. Let me count carefully!",
                       "intro_sub": "I have {a} coins and I spend {b}. Let me count carefully!",
                       "outro": "{answer} coins! Careful counting, just like you taught me."},
        "mul": {"name": "Bakery", "emoji": "🍪",
                "intro": "I baked {a} trays with {b} cookies on each tray. How many cookies?",
                "outro": "{answer} cookies! Times tables make baking easy."},
    },
    "es": {
        "dream": "¡Estoy ahorrando para abrir una tienda en el Pueblo de Lumi! Cada cosa que me enseñas abre un lugar nuevo.",
        "need": "Enséñale a Lumi {label} para abrirlo",
        "teaser": "La última vez dije que {problem} = {wrong}. ¡Uy! Necesito un profe.",
        "carry": {"name": "Puesto de limonada", "emoji": "🍋",
                  "intro": "Un cliente compra una limonada de {a}¢ y una galleta de {b}¢. ¡Voy a sumar los precios!",
                  "outro": "¡Son {answer}¢, por favor! ¡Gracias, profe!"},
        "borrow": {"name": "Caja del cambio", "emoji": "🪙",
                   "intro": "Un cliente paga {a}¢ por un dulce que cuesta {b}¢. ¡Voy a calcular el cambio!",
                   "outro": "¡Aquí está tu cambio de {answer}¢! Lo logré porque tú me enseñaste."},
        "off_by_one": {"name": "Frasco de monedas", "emoji": "🫙",
                       "intro_add": "Tengo {a} monedas en mi frasco y pongo {b} más. ¡Voy a contar con cuidado!",
                       "intro_sub": "Tengo {a} monedas y gasto {b}. ¡Voy a contar con cuidado!",
                       "outro": "¡{answer} monedas! Conté con cuidado, como me enseñaste."},
        "mul": {"name": "Panadería", "emoji": "🍪",
                "intro": "Horneé {a} bandejas con {b} galletas en cada una. ¿Cuántas galletas hay?",
                "outro": "¡{answer} galletas! Las tablas hacen fácil hornear."},
    },
    "vi": {
        "dream": "Mình đang để dành tiền để mở một cửa hàng ở Thị trấn Lumi! Mỗi điều bạn dạy mình sẽ mở một nơi mới.",
        "need": "Dạy Lumi {label} để mở nơi này",
        "teaser": "Lần trước mình nói {problem} = {wrong}. Ối! Mình cần một cô giáo.",
        "carry": {"name": "Quầy nước chanh", "emoji": "🍋",
                  "intro": "Một khách mua ly nước chanh {a}¢ và một cái bánh {b}¢. Để mình cộng giá nhé!",
                  "outro": "Tất cả là {answer}¢ ạ! Cảm ơn bạn đã dạy mình!"},
        "borrow": {"name": "Quầy thối tiền", "emoji": "🪙",
                   "intro": "Một khách trả {a}¢ cho món ăn vặt giá {b}¢. Để mình tính tiền thối nhé!",
                   "outro": "Đây là {answer}¢ tiền thối! Mình làm được nhờ bạn dạy."},
        "off_by_one": {"name": "Hũ tiền xu", "emoji": "🫙",
                       "intro_add": "Mình có {a} đồng xu trong hũ và bỏ thêm {b} đồng. Để mình đếm cẩn thận nhé!",
                       "intro_sub": "Mình có {a} đồng xu và tiêu {b} đồng. Để mình đếm cẩn thận nhé!",
                       "outro": "{answer} đồng xu! Đếm cẩn thận, như bạn đã dạy mình."},
        "mul": {"name": "Tiệm bánh", "emoji": "🍪",
                "intro": "Mình nướng {a} khay, mỗi khay có {b} cái bánh. Có bao nhiêu cái bánh?",
                "outro": "{answer} cái bánh! Bảng cửu chương giúp nướng bánh thật dễ."},
    },
}


def _pretty(expr: str) -> str:
    return expr.replace(" - ", " − ").replace("*", "×")


def _label(lang: str, concept: str) -> str:
    return TT[lang]["concepts"][concept]["label"]


def _teaser(lang: str, concept: str, session: Session) -> str:
    """A friendly 'I got it wrong' line, using a diagnose()-verified planted mistake."""
    rng = random.Random(f"teaser-{session.id}-{concept}")
    expr, wrong = _make(concept, True, rng)
    if concept in ("carry", "borrow"):  # money places speak in cents
        return PLACES[lang]["teaser"].format(problem=_money(expr), wrong=f"{wrong}¢")
    return PLACES[lang]["teaser"].format(problem=_pretty(expr), wrong=wrong)


def _money(expr: str) -> str:
    a, b = operands(expr)
    op = "+" if operator_of(expr) == "+" else "−"
    return f"{a}¢ {op} {b}¢"


def town(session: Session, lang: str) -> dict:
    places = []
    for c in TEACHABLE:
        stars = session.lumi_mastery.get(c, 0.0)
        unlocked = stars >= UNLOCK_STARS
        p = PLACES[lang][c]
        places.append({
            "concept": c, "name": p["name"], "emoji": p["emoji"], "stars": stars, "unlocked": unlocked,
            "need": None if unlocked else PLACES[lang]["need"].format(label=_label(lang, c)),
            "teaser": None if unlocked else _teaser(lang, c, session),
        })
    scrapbook = [
        {"concept": c, "label": _label(lang, c), "quote": session.teach_quotes[c][1], "stars": session.lumi_mastery.get(c, 0.0)}
        for c in TEACHABLE if c in session.teach_quotes and session.lumi_mastery.get(c, 0.0) > 0
    ]
    return {"dream": PLACES[lang]["dream"], "unlock_stars": UNLOCK_STARS, "places": places, "scrapbook": scrapbook}


def scene(session: Session, lang: str, concept: str) -> dict:
    p = PLACES[lang][concept]
    title = f"{p['emoji']} {p['name']}"
    if session.lumi_mastery.get(concept, 0.0) < UNLOCK_STARS:
        teaser = _teaser(lang, concept, session)
        return {"concept": concept, "unlocked": False, "title": title, "lines": [teaser], "answer": None, "say": teaser}

    visit = session.town_visits.get(concept, 0)
    session.town_visits[concept] = visit + 1
    rng = random.Random(f"scene-{session.id}-{concept}-{visit}")
    expr, _ = _make(concept, False, rng)
    answer = format_answer(expr, evaluate(expr))
    a, b = operands(expr)
    if concept == "off_by_one":
        intro = p["intro_add" if operator_of(expr) == "+" else "intro_sub"].format(a=a, b=b)
    else:
        intro = p["intro"].format(a=a, b=b)
    outro = p["outro"].format(answer=answer)
    lines = [intro, *demo_steps(expr, lang), outro]
    session.log("town_scene", concept=concept, visit=visit + 1)
    return {"concept": concept, "unlocked": True, "title": title, "problem": expr, "lines": lines, "answer": answer,
            "say": " ".join(lines), "parts": parts(expr)}


def parts(expr: str) -> dict:
    """Every digit the picture shows (columns, carried/borrowed 1, skip-count sequence), computed here so
    the illustrated scene can never display arithmetic the backend didn't produce. Checked against SymPy."""
    op = operator_of(expr)
    a, b = operands(expr)
    answer = int(evaluate(expr))
    if op == "*":
        seq = [b * i for i in range(1, a + 1)]
        assert seq[-1] == answer
        return {"op": "*", "a": a, "b": b, "answer": answer, "seq": seq}
    a10, a1 = divmod(a, 10)
    b10, b1 = divmod(b, 10)
    if op == "+":
        regroup = a1 + b1 >= 10
        ones, tens = (a1 + b1) % 10, a10 + b10 + int(regroup)
    else:
        regroup = a1 < b1
        ones, tens = a1 + 10 * int(regroup) - b1, a10 - int(regroup) - b10
    assert tens * 10 + ones == answer, expr
    out = {"op": op, "a": a, "b": b, "answer": answer, "a_digits": [a10, a1], "b_digits": [b10, b1],
           "regroup": regroup, "ones": ones, "tens": tens}
    if op == "-" and regroup:  # what the board writes above the crossed-out digits
        out["borrow_tens"], out["borrow_ones"] = a10 - 1, a1 + 10
    return out
