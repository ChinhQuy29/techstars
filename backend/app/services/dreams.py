"""Lumi's dream: the child picks what Lumi wants to be, and every Teach problem is asked as a short story from it.

Only the wording changes. The math (numbers, right answer, Lumi's planted mistake) is made and checked exactly
as before; a story is a fixed, hand-written template filled with the problem's own numbers, so it can never
change or give away an answer. No AI writes these lines. Spec: docs/12-dreams.md.
"""
from __future__ import annotations

import re
import zlib
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

# The problem as one short question. "?" marks where Lumi's answer goes (the app fills it in), so each line has
# exactly one "?". Placeholders come from the problem's own numbers; {problem} is the plain problem text.
# Several versions per kind of problem, all in the same order in every language; a worksheet uses a different
# version for each problem of the same kind (see `story`) so the page doesn't repeat itself.
STORIES: dict[str, dict[str, dict[str, list[str]]]] = {
    "astronaut": {
        "en": {
            "add": [
                "⛽ The rocket has {a} L of fuel and gets {b} L more. Now it has ? L.",
                "🌑 Lumi found {a} moon rocks, then {b} more. Rocks in the bag: ?",
                "👽 {a} friendly aliens wave hello. {b} more fly in. That makes ? aliens!",
                "🛰️ The space station has {a} bolts. Lumi adds {b}. Total bolts: ?",
            ],
            "sub": [
                "⭐ Lumi sees {a} stars. {b} hide behind the Moon. Still shining: ?",
                "🍪 Lumi packed {a} space cookies and ate {b} on the way. Left: ?",
                "☄️ {a} comets zoom past. {b} fly away. ? comets are still here.",
                "🧑‍🚀 The countdown is at {a}. Lumi counts down {b} more. Now it says ?",
            ],
            "mul": [
                "🚀 {a} rockets with {b} windows each have ? windows.",
                "🪐 Lumi jumps {b} times on each of {a} planets. That's ? jumps!",
                "👩‍🚀 {a} astronauts each pack {b} snacks: ? snacks in all.",
                "🌟 {a} rows of {b} stars make a picture of ? stars.",
            ],
            "share": [
                "🍱 {a} snacks shared by {b} astronauts: ? each.",
                "🌑 {a} moon rocks go into {b} boxes equally: ? per box.",
                "🚀 {a} astronauts ride in {b} rockets, the same in each: ? per rocket.",
                "🧃 {a} juice packs last {b} days on the Moon. Each day gets ?",
            ],
            "patterns": [
                "📡 Space beeps: {problem}",
                "🛸 The UFO's lights blink in a pattern: {problem}",
                "🌠 Lumi counts falling stars: {problem}",
                "🔢 The rocket's secret code: {problem}",
            ],
            "big_numbers": [
                "🔭 Star map: {problem}",
                "🌌 A faraway planet. {problem}",
                "🚀 The rocket's serial number. {problem}",
                "🧮 Mission control's big number. {problem}",
            ],
            "time": [
                "🧑‍🚀 A {m}-minute space walk starts at {start}. It ends at ?",
                "🚀 Launch is at {start}. The ride to orbit takes {m} min. Lumi arrives at ?",
                "😴 Lumi naps on the space station at {start} for {m} min. Wake-up time: ?",
                "🍝 Space lunch starts at {start} and lasts {m} minutes. It ends at ?",
            ],
            "measure": [
                "🎒 Lumi's {obj} for space is ? cm long.",
                "🧑‍🚀 Lumi's {obj} floats in zero gravity. It is ? cm long.",
                "📦 Lumi packs a {obj} in the rocket. Its length: ? cm",
                "🔧 Lumi measures a {obj} on the space station: ? cm.",
            ],
            "shapes": [
                "🛰️ A satellite part shaped like a {shape} has ? flat faces.",
                "🏠 Lumi's moon house is a {shape}. Flat faces: ?",
                "📦 A space supply box is a {shape}. It has ? flat faces.",
                "🧱 A moon base block is a {shape} with ? flat faces.",
            ],
            "fractions": [
                "🍕 Space pizza slices: {problem}",
                "🥧 Moon pie pieces: {problem}",
                "🧀 Space cheese slices: {problem}",
                "🍫 Rocket chocolate pieces: {problem}",
            ],
            "graphs": [
                "📊 From the rocket, Lumi saw ? more {e1} than {e2}.",
                "📊 Lumi's space chart: there are ? more {e1} than {e2}.",
                "🔭 Through the telescope: ? more {e1} than {e2}.",
                "📊 Mission log: {e1} beat {e2} by ?",
            ],
        },
        "es": {
            "add": [
                "⛽ El cohete tiene {a} L de combustible y recibe {b} L más. Ahora tiene ? L.",
                "🌑 Lumi encontró {a} rocas lunares y luego {b} más. Rocas en la bolsa: ?",
                "👽 {a} extraterrestres saludan. Llegan {b} más. ¡Ya son ? extraterrestres!",
                "🛰️ La estación espacial tiene {a} tornillos. Lumi pone {b}. Total: ?",
            ],
            "sub": [
                "⭐ Lumi ve {a} estrellas. {b} se esconden tras la Luna. Siguen brillando: ?",
                "🍪 Lumi llevó {a} galletas espaciales y se comió {b}. Quedan: ?",
                "☄️ Pasan {a} cometas. {b} se van. Quedan ? cometas.",
                "🧑‍🚀 La cuenta atrás va en {a}. Lumi baja {b} más. Ahora marca ?",
            ],
            "mul": [
                "🚀 {a} cohetes con {b} ventanas cada uno tienen ? ventanas.",
                "🪐 Lumi salta {b} veces en cada uno de {a} planetas. ¡Son ? saltos!",
                "👩‍🚀 {a} astronautas llevan {b} meriendas cada uno: ? en total.",
                "🌟 {a} filas de {b} estrellas forman un dibujo de ? estrellas.",
            ],
            "share": [
                "🍱 {a} meriendas entre {b} astronautas: ? para cada uno.",
                "🌑 {a} rocas lunares en {b} cajas iguales: ? por caja.",
                "🚀 {a} astronautas viajan en {b} cohetes, igual en cada uno: ? por cohete.",
                "🧃 {a} jugos duran {b} días en la Luna. Cada día toca ?",
            ],
            "patterns": [
                "📡 Pitidos del espacio: {problem}",
                "🛸 Las luces del ovni parpadean así: {problem}",
                "🌠 Lumi cuenta estrellas fugaces: {problem}",
                "🔢 El código secreto del cohete: {problem}",
            ],
            "big_numbers": [
                "🔭 Mapa de estrellas: {problem}",
                "🌌 Un planeta muy lejano. {problem}",
                "🚀 El número de serie del cohete. {problem}",
                "🧮 El gran número del control de la misión. {problem}",
            ],
            "time": [
                "🧑‍🚀 Un paseo espacial de {m} minutos empieza a las {start}. Termina a las ?",
                "🚀 El despegue es a las {start} y el viaje dura {m} min. Lumi llega a las ?",
                "😴 Lumi duerme la siesta a las {start} durante {m} min. Despierta a las ?",
                "🍝 La comida espacial empieza a las {start} y dura {m} min. Termina a las ?",
            ],
            "measure": [
                "🎒 Para el espacio, Lumi lleva su {obj}: mide ? cm.",
                "🧑‍🚀 Su {obj} flota sin gravedad. Mide ? cm.",
                "📦 Lumi guarda su {obj} en el cohete. Largo: ? cm",
                "🔧 En la estación espacial, Lumi mide su {obj}: ? cm.",
            ],
            "shapes": [
                "🛰️ Una pieza del satélite con forma de {shape} tiene ? caras planas.",
                "🏠 La casa lunar de Lumi tiene forma de {shape}. Caras planas: ?",
                "📦 Una caja de provisiones con forma de {shape} tiene ? caras planas.",
                "🧱 Un bloque de la base lunar con forma de {shape} tiene ? caras planas.",
            ],
            "fractions": [
                "🍕 Trozos de pizza espacial: {problem}",
                "🥧 Trozos de pastel lunar: {problem}",
                "🧀 Trozos de queso espacial: {problem}",
                "🍫 Trozos de chocolate cohete: {problem}",
            ],
            "graphs": [
                "📊 Desde el cohete, Lumi vio ? {e1} más que {e2}.",
                "📊 La gráfica espacial de Lumi: hay ? {e1} más que {e2}.",
                "🔭 Por el telescopio: ? {e1} más que {e2}.",
                "📊 Diario de la misión: {e1} le gana a {e2} por ?",
            ],
        },
        "vi": {
            "add": [
                "⛽ Tên lửa có {a} lít nhiên liệu, đổ thêm {b} lít. Giờ có ? lít.",
                "🌑 Lumi nhặt {a} viên đá Mặt Trăng, rồi thêm {b} viên. Trong túi có ? viên.",
                "👽 {a} bạn ngoài hành tinh vẫy chào. {b} bạn nữa bay tới. Có tất cả ? bạn!",
                "🛰️ Trạm vũ trụ có {a} con ốc. Lumi lắp thêm {b} con. Tổng cộng: ?",
            ],
            "sub": [
                "⭐ Lumi thấy {a} ngôi sao. {b} ngôi sao trốn sau Mặt Trăng. Còn ? ngôi sao sáng.",
                "🍪 Lumi mang {a} bánh quy vũ trụ, ăn mất {b} cái. Còn lại: ?",
                "☄️ {a} sao chổi bay qua. {b} sao chổi bay đi. Còn ? sao chổi.",
                "🧑‍🚀 Đếm ngược đang ở số {a}. Lumi đếm lùi thêm {b}. Giờ là ?",
            ],
            "mul": [
                "🚀 {a} tên lửa, mỗi chiếc có {b} cửa sổ. Tất cả có ? cửa sổ.",
                "🪐 Lumi nhảy {b} lần trên mỗi hành tinh, có {a} hành tinh. Tất cả ? lần!",
                "👩‍🚀 {a} phi hành gia, mỗi người mang {b} món ăn vặt: tất cả ? món.",
                "🌟 {a} hàng, mỗi hàng {b} ngôi sao, thành bức tranh ? ngôi sao.",
            ],
            "share": [
                "🍱 Chia {a} gói đồ ăn cho {b} phi hành gia: mỗi người ? gói.",
                "🌑 Chia đều {a} viên đá Mặt Trăng vào {b} hộp: mỗi hộp ? viên.",
                "🚀 {a} phi hành gia đi đều trên {b} tên lửa: mỗi tên lửa ? người.",
                "🧃 {a} hộp nước dùng trong {b} ngày trên Mặt Trăng: mỗi ngày ? hộp.",
            ],
            "patterns": [
                "📡 Tiếng bíp từ vũ trụ: {problem}",
                "🛸 Đèn đĩa bay nhấp nháy theo quy luật: {problem}",
                "🌠 Lumi đếm sao băng: {problem}",
                "🔢 Mật mã bí mật của tên lửa: {problem}",
            ],
            "big_numbers": [
                "🔭 Bản đồ sao: {problem}",
                "🌌 Một hành tinh rất xa. {problem}",
                "🚀 Số hiệu tên lửa. {problem}",
                "🧮 Con số lớn của trung tâm điều khiển. {problem}",
            ],
            "time": [
                "🧑‍🚀 Lumi đi bộ ngoài không gian {m} phút, bắt đầu lúc {start}. Kết thúc lúc ?",
                "🚀 Tên lửa phóng lúc {start}, bay {m} phút lên quỹ đạo. Lumi tới nơi lúc ?",
                "😴 Lumi ngủ trưa trên trạm vũ trụ lúc {start}, ngủ {m} phút. Thức dậy lúc ?",
                "🍝 Bữa trưa vũ trụ bắt đầu lúc {start}, kéo dài {m} phút. Kết thúc lúc ?",
            ],
            "measure": [
                "🎒 Lumi mang {obj} lên vũ trụ. Nó dài ? cm.",
                "🧑‍🚀 {obj} của Lumi bay lơ lửng. Nó dài ? cm.",
                "📦 Lumi cất {obj} vào tên lửa. Chiều dài: ? cm",
                "🔧 Trên trạm vũ trụ, Lumi đo {obj}: ? cm.",
            ],
            "shapes": [
                "🛰️ Bộ phận vệ tinh dạng {shape} có ? mặt phẳng.",
                "🏠 Nhà trên Mặt Trăng của Lumi là {shape}. Số mặt phẳng: ?",
                "📦 Hộp đồ tiếp tế là {shape}, có ? mặt phẳng.",
                "🧱 Khối xây căn cứ Mặt Trăng là {shape}, có ? mặt phẳng.",
            ],
            "fractions": [
                "🍕 Miếng pizza vũ trụ: {problem}",
                "🥧 Miếng bánh Mặt Trăng: {problem}",
                "🧀 Miếng phô mai vũ trụ: {problem}",
                "🍫 Miếng sô-cô-la tên lửa: {problem}",
            ],
            "graphs": [
                "📊 Từ tên lửa, Lumi thấy số {e1} nhiều hơn số {e2} là ?",
                "📊 Biểu đồ vũ trụ của Lumi: {e1} nhiều hơn {e2} ? cái.",
                "🔭 Qua kính thiên văn: {e1} nhiều hơn {e2} ? cái.",
                "📊 Nhật ký nhiệm vụ: {e1} hơn {e2} ? cái.",
            ],
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


def story(dream: Optional[str], concept: str, problem: str, data: dict, lang: str,
          used: Optional[set[str]] = None) -> Optional[str]:
    """This problem as the dream's short question ("?" = the answer's place), or None (no dream).

    `used` (shared across one worksheet) remembers which versions are taken, so two problems of the same kind on a
    page get different stories. The first choice depends only on the problem, so the same problem always reads the same.
    """
    d = valid_dream(dream)
    if not d:
        return None
    lines = STORIES[d][lang]
    m = _EXPR.match(problem)
    if m:  # the original four: "a op b"
        a, op, b = m.groups()
        key = {"+": "add", "-": "sub", "×": "mul"}[op]
        fields = {"a": a, "b": b}
    elif concept in lines:
        key = concept
        fields = {**data, "problem": problem}
        if concept == "time":
            fields["start"] = f"{data['h']}:{data['mm']:02d}"
    else:
        return None
    versions = lines[key]
    first = zlib.crc32(problem.encode("utf-8")) % len(versions)
    order = [(first + i) % len(versions) for i in range(len(versions))]
    pick = next((i for i in order if used is None or f"story:{key}:{i}" not in used), first)
    if used is not None:
        used.add(f"story:{key}:{pick}")
    return versions[pick].format(**fields)
