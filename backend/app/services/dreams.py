"""Lumi's dream: the child picks what Lumi wants to be, and every Teach problem gets a short story from it.

Only the wording changes. The math (numbers, right answer, Lumi's planted mistake) is made and checked exactly
as before; a story is a fixed, hand-written template filled with the problem's own numbers, so it can never
change or give away an answer. No AI writes these lines. Spec: docs/12-dreams.md.
"""
from __future__ import annotations

import re
from typing import Optional

from .concepts import Item

# Dreams the child can pick today. More (doctor, baker) are added here, with their stories below.
DREAMS: tuple[str, ...] = ("astronaut",)


def valid_dream(dream: Optional[str]) -> Optional[str]:
    """A known dream, or None (unknown values are ignored, never an error)."""
    return dream if dream in DREAMS else None


# Bar-graph pictures: the generator draws fruit; a dream swaps them for its own (same counts).
GRAPH_ICONS: dict[str, dict[str, str]] = {
    "astronaut": {"🍎": "🪐", "🍐": "⭐", "🍌": "🌙", "🍇": "☄️", "🍓": "🛸"},
}

# One line per kind of problem. Placeholders come from the problem's own numbers; none of them is the answer.
STORIES: dict[str, dict[str, dict[str, str]]] = {
    "astronaut": {
        "en": {
            "add": "⛽ The rocket has {a} litres of fuel. The crew adds {b} more.",
            "sub": "⭐ Lumi counts {a} stars. {b} of them hide behind the Moon.",
            "mul": "🚀 There are {a} rockets. Each rocket has {b} windows.",
            "share": "🍱 {a} space snacks are shared equally by {b} astronauts.",
            "patterns": "📡 Beeps from a faraway planet follow a pattern.",
            "big_numbers": "🔭 Lumi reads a big number on the star map.",
            "time": "🧑‍🚀 Lumi's space walk starts at {start} and lasts {m} minutes.",
            "measure": "🎒 Lumi packs a {obj} for the trip to space.",
            "shapes": "🛰️ Lumi builds a satellite part shaped like a {shape}.",
            "fractions": "🍕 Two space pizzas: one is cut into {a} equal slices, the other into {b}.",
            "graphs": "📊 Mission control counted what Lumi saw from the rocket window.",
        },
        "es": {
            "add": "⛽ El cohete tiene {a} litros de combustible. La tripulación pone {b} más.",
            "sub": "⭐ Lumi cuenta {a} estrellas. {b} se esconden detrás de la Luna.",
            "mul": "🚀 Hay {a} cohetes. Cada cohete tiene {b} ventanas.",
            "share": "🍱 {a} meriendas espaciales se reparten por igual entre {b} astronautas.",
            "patterns": "📡 Los pitidos de un planeta lejano siguen un patrón.",
            "big_numbers": "🔭 Lumi lee un número grande en el mapa de estrellas.",
            "time": "🧑‍🚀 El paseo espacial de Lumi empieza a las {start} y dura {m} minutos.",
            "measure": "🎒 Lumi guarda su {obj} para el viaje al espacio.",
            "shapes": "🛰️ Lumi construye una pieza del satélite con forma de {shape}.",
            "fractions": "🍕 Dos pizzas espaciales: una cortada en {a} trozos iguales y la otra en {b}.",
            "graphs": "📊 El control de la misión contó lo que Lumi vio por la ventana del cohete.",
        },
        "vi": {
            "add": "⛽ Tên lửa có {a} lít nhiên liệu. Phi hành đoàn đổ thêm {b} lít.",
            "sub": "⭐ Lumi đếm được {a} ngôi sao. {b} ngôi sao trốn sau Mặt Trăng.",
            "mul": "🚀 Có {a} tên lửa. Mỗi tên lửa có {b} cửa sổ.",
            "share": "🍱 {a} gói đồ ăn vũ trụ được chia đều cho {b} phi hành gia.",
            "patterns": "📡 Tiếng bíp từ một hành tinh xa xôi theo một quy luật.",
            "big_numbers": "🔭 Lumi đọc một số lớn trên bản đồ sao.",
            "time": "🧑‍🚀 Lumi đi bộ ngoài không gian lúc {start} trong {m} phút.",
            "measure": "🎒 Lumi xếp {obj} vào ba lô để bay vào vũ trụ.",
            "shapes": "🛰️ Lumi lắp một bộ phận vệ tinh có dạng {shape}.",
            "fractions": "🍕 Hai chiếc bánh pizza vũ trụ: một chiếc cắt thành {a} miếng bằng nhau, chiếc kia thành {b} miếng.",
            "graphs": "📊 Trung tâm điều khiển đếm những gì Lumi thấy qua cửa sổ tên lửa.",
        },
    },
}

# Lumi's first line on a new page, in the dream's words (same instructions as the plain one).
INTROS: dict[str, dict[str, dict[str, str]]] = {
    "astronaut": {
        "en": {
            "intro": "I want to be an astronaut! 🚀 Here's my space homework. Can you be my teacher? Tap ✓ if I got it right, or ✗ if I made a mistake, and write the right answer.",
            "review_intro": "Astronauts practise a lot! 🚀 Can you check my space homework again, teacher?",
        },
        "es": {
            "intro": "¡Quiero ser astronauta! 🚀 Esta es mi tarea espacial. ¿Puedes ser mi profe? Toca ✓ si está bien, o ✗ si me equivoqué, y escribe la respuesta correcta.",
            "review_intro": "¡Los astronautas practican mucho! 🚀 ¿Puedes revisar mi tarea espacial otra vez, profe?",
        },
        "vi": {
            "intro": "Mình muốn trở thành phi hành gia! 🚀 Đây là bài tập vũ trụ của mình. Bạn làm cô giáo của mình nhé? Chạm ✓ nếu mình làm đúng, hoặc ✗ nếu mình sai, rồi viết đáp án đúng.",
            "review_intro": "Phi hành gia luyện tập nhiều lắm! 🚀 Bạn kiểm tra bài vũ trụ của mình lần nữa nhé?",
        },
    },
}

_EXPR = re.compile(r"^(\d+) ([+\-×]) (\d+)$")


def intro(dream: Optional[str], lang: str, key: str) -> Optional[str]:
    d = valid_dream(dream)
    return INTROS[d][lang][key] if d else None


def dress_item(item: Item, dream: Optional[str]) -> Item:
    """Swap a newer-concept problem's pictures for the dream's (bar graphs only). Counts and answers stay."""
    icons = GRAPH_ICONS.get(valid_dream(dream) or "")
    if not icons or item.concept != "graphs":
        return item
    swap = lambda s: "".join(icons.get(ch, ch) for ch in s)  # noqa: E731  (fruit emojis are single code points)
    item.problem = swap(item.problem)
    if item.visual:
        item.visual = {**item.visual, "bars": [{**b, "label": swap(b["label"])} for b in item.visual.get("bars", [])]}
    item.data = {**item.data, "e1": swap(item.data["e1"]), "e2": swap(item.data["e2"])}
    return item


def story(dream: Optional[str], concept: str, problem: str, data: dict, lang: str) -> Optional[str]:
    """The dream's one-line story for this problem, or None (no dream, or nothing fits)."""
    d = valid_dream(dream)
    if not d:
        return None
    lines = STORIES[d][lang]
    m = _EXPR.match(problem)
    if m:  # the original four: "a op b"
        a, op, b = m.groups()
        key = {"+": "add", "-": "sub", "×": "mul"}[op]
        return lines[key].format(a=a, b=b)
    if concept == "time":
        return lines["time"].format(start=f"{data['h']}:{data['mm']:02d}", m=data["m"])
    if concept in ("share", "fractions"):
        return lines[concept].format(a=data["a"], b=data["b"])
    if concept in ("measure", "shapes"):
        return lines[concept].format(obj=data.get("obj", ""), shape=data.get("shape", ""))
    return lines.get(concept)
