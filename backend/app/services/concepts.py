"""The eight newer Teach concepts (grades 1-4): sharing, patterns, big numbers, time, measuring, shapes,
fractions, bar graphs. Spec: docs/02-learning-design.md.

Same contract as the original four (math_check): every problem has one deterministic correct answer
computed in Python, and Lumi's planted answer is one named, classic misconception that `diagnose()`
recognizes. Problems are plain text with "?" where the answer goes, plus an optional `visual`
(ruler, shape, fraction bars, bar chart) that the frontend only draws.
"""
from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from typing import Optional

from .math_check import TEACHABLE

NEW_CONCEPTS = ("share", "patterns", "big_numbers", "time", "measure", "shapes", "fractions", "graphs")
ALL_CONCEPTS = TEACHABLE + NEW_CONCEPTS

# How the child types an answer: digits, a clock time, or a comparison sign.
ANSWER_KIND = {c: "number" for c in ALL_CONCEPTS} | {"time": "time", "fractions": "compare"}


@dataclass
class Item:
    concept: str
    problem: str  # display text; "?" marks where the answer goes
    answer: str  # the correct answer, canonical form
    wrong: str  # Lumi's planted answer for this exact problem (one classic misconception)
    kind: str
    visual: Optional[dict] = None
    data: dict = field(default_factory=dict)


# ---------- answers ----------

def normalize(kind: str, text: Optional[str]) -> Optional[str]:
    t = (text or "").strip()
    if not t:
        return None
    if kind == "compare":
        return t if t in ("<", ">", "=") else None
    if kind == "time":
        m = re.fullmatch(r"(\d{1,2})\s*[:.h]?\s*(\d{2})", t)
        if not m:
            return None
        h, mm = int(m.group(1)), int(m.group(2))
        return f"{h}:{mm:02d}" if 0 <= mm else None
    digits = re.sub(r"[\s,. ]", "", t)
    return str(int(digits)) if digits.isdigit() else None


def is_correct(kind: str, correct: str, given: Optional[str]) -> bool:
    g = normalize(kind, given)
    if g is None:
        return False
    if kind == "time":  # 6:75 is not a time, even if it "means" 7:15
        return int(g.split(":")[1]) < 60 and g == correct
    return g == correct


def diagnose(item: Item, given: str) -> Optional[str]:
    """The concept tag if `given` is this problem's classic mistake (and not the right answer)."""
    g = normalize(item.kind, given)
    if g is None or is_correct(item.kind, item.answer, given):
        return None
    return item.concept if g == normalize(item.kind, item.wrong) else None


def fmt(n: int, lang: str) -> str:
    """Big numbers the way each language writes them (384,400 / 384.400)."""
    s = f"{n:,}"
    return s if lang == "en" else s.replace(",", ".")


def display(item: Item, answer: str, lang: str) -> str:
    """An answer the way the child sees it."""
    if item.concept == "big_numbers" and answer.isdigit():
        return fmt(int(answer), lang)
    return answer


# ---------- per-language text ----------

PLACES = {
    "en": {1: "tens", 2: "hundreds", 3: "thousands", 4: "ten thousands", 5: "hundred thousands"},
    "es": {1: "decenas", 2: "centenas", 3: "unidades de mil", 4: "decenas de mil", 5: "centenas de mil"},
    "vi": {1: "hàng chục", 2: "hàng trăm", 3: "hàng nghìn", 4: "hàng chục nghìn", 5: "hàng trăm nghìn"},
}
OBJECTS = {
    "en": {"pencil": "pencil", "crayon": "crayon", "key": "key", "leaf": "leaf", "spoon": "spoon"},
    "es": {"pencil": "lápiz", "crayon": "crayón", "key": "llave", "leaf": "hoja", "spoon": "cuchara"},
    "vi": {"pencil": "bút chì", "crayon": "bút sáp", "key": "chìa khóa", "leaf": "chiếc lá", "spoon": "cái thìa"},
}
SHAPES = {  # flat faces: total, and how many show in a front view (Lumi only counts those)
    "cube": (6, 3), "box": (6, 3), "pyramid": (5, 4), "prism": (5, 3), "tetra": (4, 3), "pentaprism": (7, 4),
}
SHAPE_NAMES = {
    "en": {"cube": "cube", "box": "box (rectangular prism)", "pyramid": "square pyramid", "prism": "triangular prism",
           "tetra": "triangular pyramid", "pentaprism": "pentagonal prism"},
    "es": {"cube": "cubo", "box": "caja (prisma rectangular)", "pyramid": "pirámide cuadrada", "prism": "prisma triangular",
           "tetra": "pirámide triangular", "pentaprism": "prisma pentagonal"},
    "vi": {"cube": "hình lập phương", "box": "hình hộp chữ nhật", "pyramid": "hình chóp vuông", "prism": "hình lăng trụ tam giác",
           "tetra": "hình chóp tam giác", "pentaprism": "hình lăng trụ ngũ giác"},
}
FRUITS = ["🍎", "🍐", "🍌", "🍇", "🍓"]

TEXT: dict[str, dict] = {
    "en": {
        "share": {
            "label": "division", "q": "{a} ÷ {b} = ?",
            "ask_why": "Ooh! But what does sharing mean?",
            "point": "Hmm, did I make equal groups?",
            "rule": "Sharing means making equal groups and counting how many are in each.",
            "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we make the groups together?",
            "chips": ["You took away instead of sharing into equal groups", "You forgot to carry the 1", "Sharing means adding the numbers"],
            "steps": ["I share {a} into {b} equal groups.", "I count by {b}s: {seq}. That's {q} times.", "So each group gets {q}."],
            "hints": ["Sharing means making equal groups. How many go in each group?", "Count by {b}s until you reach {a}.", "{b}, {b2}, {b3}… How many times did you count?"],
        },
        "patterns": {
            "label": "patterns", "q": "{seq}, ?",
            "ask_why": "Ooh! But how do you know what comes next?",
            "point": "Hmm, how much do the numbers jump each time?",
            "rule": "A pattern makes the same jump every time.",
            "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we look at the jumps together?",
            "chips": ["You added 1, but the pattern jumps by the same amount every time", "You should start again from the first number", "Patterns always go up by 1"],
            "steps": ["The numbers jump by {d} each time: {x} → {y}.", "After {last} I jump {d} more: {last} + {d} = {next}."],
            "hints": ["Look at how much the numbers grow each time.", "Find the jump between two numbers next to each other.", "{x} to {y} is a jump of {d}. What comes after {last}?"],
        },
        "big_numbers": {
            "label": "place value", "q": "In {n}, the {d} is worth ?",
            "ask_why": "Ooh! But how do you know how much the {d} is worth?",
            "point": "Hmm, which place is the {d} in?",
            "rule": "A digit is worth more in each place to the left: ones, tens, hundreds, thousands.",
            "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we count the places together?",
            "chips": ["You counted one place too few, so the digit is worth 10 times more", "You forgot to carry the 1", "A digit is always worth just itself"],
            "steps": ["I count the places from the right: ones, tens, hundreds, thousands…", "The {d} is in the {place} place.", "So it is worth {value}."],
            "hints": ["Which place is the {d} in?", "Count the places from the right: ones, tens, hundreds…", "The {d} is in the {place} place."],
        },
        "time": {
            "label": "time", "q": "{start} + {m} min = ?",
            "ask_why": "Ooh! But why can't the minutes go past 60?",
            "point": "Hmm, how many minutes are in one hour?",
            "rule": "An hour has 60 minutes, so 60 minutes make one more hour.",
            "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we count the minutes together?",
            "chips": ["An hour has only 60 minutes, not 100", "You should take the minutes away", "Clocks go up to 100 minutes"],
            "steps": ["{mm} minutes plus {m} minutes is {sum} minutes.", "60 minutes make 1 hour, so that's 1 more hour and {rest} minutes.", "So the time is {answer}."],
            "hints": ["How many minutes are in one hour?", "When the minutes reach 60, that makes a new hour.", "{mm} + {m} = {sum} minutes. Take away 60 for one hour."],
        },
        "measure": {
            "label": "measurement", "q": "📏 The {obj} is ? cm long.",
            "ask_why": "Ooh! But why can't I just read the number at the end?",
            "point": "Hmm, where does the {obj} start on the ruler?",
            "rule": "If something doesn't start at 0, we count from where it starts.",
            "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we look at the ruler together?",
            "chips": ["It doesn't start at 0, so you can't just read the end", "You should add the two numbers", "The ruler is broken"],
            "steps": ["The {obj} starts at {s}, not at 0.", "It ends at {e}.", "{e} minus {s} is {len}, so it is {len} cm long."],
            "hints": ["Where does the {obj} start on the ruler?", "If it doesn't start at 0, count the spaces from where it starts.", "It starts at {s} and ends at {e}."],
        },
        "shapes": {
            "label": "shapes", "q": "A {shape} has ? flat faces.",
            "ask_why": "Ooh! But how can you count faces you can't see?",
            "point": "Hmm, did I count every face, even at the back?",
            "rule": "A solid shape also has faces at the back and bottom that we can't see.",
            "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we turn the shape around together?",
            "chips": ["You forgot the faces hiding at the back and bottom", "You counted the corners instead", "A shape only has the faces you can see"],
            "steps": ["I can see {visible} faces at the front.", "{hidden} more faces hide at the back and bottom.", "{visible} + {hidden} = {total} flat faces."],
            "hints": ["Are there faces you can't see in the picture?", "Imagine turning the {shape} around. Count the back and the bottom too.", "There are {visible} faces at the front. How many are hiding?"],
        },
        "fractions": {
            "label": "fractions", "q": "1/{a} ? 1/{b}",
            "ask_why": "Ooh! But why are the pieces smaller?",
            "point": "Hmm, which piece is bigger?",
            "rule": "The more equal pieces we cut, the smaller each piece is.",
            "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we look at the bars together?",
            "chips": ["A bigger bottom number means smaller pieces", "The bigger bottom number is always bigger", "You forgot to carry the 1"],
            "steps": ["1/{a} means one whole cut into {a} equal pieces.", "1/{b} means the same whole cut into {b} pieces.", "More pieces make each piece smaller, so 1/{a} {sym} 1/{b}."],
            "hints": ["Which piece is bigger: a pizza cut into {a} or into {b}?", "More pieces means smaller pieces.", "Look at the bars: which one is longer?"],
        },
        "graphs": {
            "label": "bar graphs", "q": "📊 How many more {e1} than {e2}? ?",
            "ask_why": "Ooh! But why do I need both bars?",
            "point": "Hmm, did I compare the two bars?",
            "rule": "\"How many more\" means we compare two bars and find the difference.",
            "wrong_fix": "Hmm, I tried {answer} and it still doesn't look right. Can we read both bars together?",
            "chips": ["You read one bar, but you need to compare both", "You should add the two bars together", "The tallest bar is always the answer"],
            "steps": ["The {e1} bar goes up to {v1}.", "The {e2} bar goes up to {v2}.", "{v1} − {v2} = {diff}, so there are {diff} more."],
            "hints": ["\"How many more\" means we compare two bars.", "Read both bars, then find the difference.", "{e1} is {v1} and {e2} is {v2}."],
        },
    },
    "es": {
        "share": {
            "label": "división", "q": "{a} ÷ {b} = ?",
            "ask_why": "¡Oh! ¿Pero qué significa repartir?",
            "point": "Mmm, ¿hice grupos iguales?",
            "rule": "Repartir es hacer grupos iguales y contar cuántos hay en cada uno.",
            "wrong_fix": "Mmm, probé {answer} y sigue sin verse bien. ¿Hacemos los grupos juntos?",
            "chips": ["Quitaste en vez de repartir en grupos iguales", "Se te olvidó llevar el 1", "Repartir es sumar los números"],
            "steps": ["Reparto {a} en {b} grupos iguales.", "Cuento de {b} en {b}: {seq}. Son {q} veces.", "Así que cada grupo tiene {q}."],
            "hints": ["Repartir es hacer grupos iguales. ¿Cuántos van en cada grupo?", "Cuenta de {b} en {b} hasta llegar a {a}.", "{b}, {b2}, {b3}… ¿Cuántas veces contaste?"],
        },
        "patterns": {
            "label": "patrones", "q": "{seq}, ?",
            "ask_why": "¡Oh! ¿Pero cómo sabes qué sigue?",
            "point": "Mmm, ¿cuánto saltan los números cada vez?",
            "rule": "Un patrón da el mismo salto cada vez.",
            "wrong_fix": "Mmm, probé {answer} y sigue sin verse bien. ¿Miramos los saltos juntos?",
            "chips": ["Sumaste 1, pero el patrón salta lo mismo cada vez", "Hay que empezar otra vez desde el primer número", "Los patrones siempre suben de 1 en 1"],
            "steps": ["Los números saltan de {d} en {d}: {x} → {y}.", "Después de {last} salto {d} más: {last} + {d} = {next}."],
            "hints": ["Mira cuánto crecen los números cada vez.", "Busca el salto entre dos números seguidos.", "De {x} a {y} hay un salto de {d}. ¿Qué viene después de {last}?"],
        },
        "big_numbers": {
            "label": "valor posicional", "q": "En {n}, el {d} vale ?",
            "ask_why": "¡Oh! ¿Pero cómo sabes cuánto vale el {d}?",
            "point": "Mmm, ¿en qué lugar está el {d}?",
            "rule": "Un dígito vale más en cada lugar hacia la izquierda: unidades, decenas, centenas, millares.",
            "wrong_fix": "Mmm, probé {answer} y sigue sin verse bien. ¿Contamos los lugares juntos?",
            "chips": ["Contaste un lugar de menos, así que el dígito vale 10 veces más", "Se te olvidó llevar el 1", "Un dígito siempre vale solo lo que es"],
            "steps": ["Cuento los lugares desde la derecha: unidades, decenas, centenas, millares…", "El {d} está en las {place}.", "Así que vale {value}."],
            "hints": ["¿En qué lugar está el {d}?", "Cuenta los lugares desde la derecha: unidades, decenas, centenas…", "El {d} está en las {place}."],
        },
        "time": {
            "label": "la hora", "q": "{start} + {m} min = ?",
            "ask_why": "¡Oh! ¿Pero por qué los minutos no pueden pasar de 60?",
            "point": "Mmm, ¿cuántos minutos tiene una hora?",
            "rule": "Una hora tiene 60 minutos, así que 60 minutos forman una hora más.",
            "wrong_fix": "Mmm, probé {answer} y sigue sin verse bien. ¿Contamos los minutos juntos?",
            "chips": ["Una hora tiene solo 60 minutos, no 100", "Había que restar los minutos", "Los relojes llegan a 100 minutos"],
            "steps": ["{mm} minutos más {m} minutos son {sum} minutos.", "60 minutos forman 1 hora, así que es 1 hora más y {rest} minutos.", "Así que la hora es {answer}."],
            "hints": ["¿Cuántos minutos tiene una hora?", "Cuando los minutos llegan a 60, se forma una hora nueva.", "{mm} + {m} = {sum} minutos. Quita 60 para una hora."],
        },
        "measure": {
            "label": "medición", "q": "📏 El/la {obj} mide ? cm.",
            "ask_why": "¡Oh! ¿Pero por qué no puedo leer solo el número del final?",
            "point": "Mmm, ¿dónde empieza el/la {obj} en la regla?",
            "rule": "Si algo no empieza en 0, contamos desde donde empieza.",
            "wrong_fix": "Mmm, probé {answer} y sigue sin verse bien. ¿Miramos la regla juntos?",
            "chips": ["No empieza en 0, así que no basta con leer el final", "Había que sumar los dos números", "La regla está rota"],
            "steps": ["El/la {obj} empieza en {s}, no en 0.", "Termina en {e}.", "{e} menos {s} es {len}, así que mide {len} cm."],
            "hints": ["¿Dónde empieza el/la {obj} en la regla?", "Si no empieza en 0, cuenta los espacios desde donde empieza.", "Empieza en {s} y termina en {e}."],
        },
        "shapes": {
            "label": "figuras", "q": "Un/a {shape} tiene ? caras planas.",
            "ask_why": "¡Oh! ¿Pero cómo cuentas caras que no se ven?",
            "point": "Mmm, ¿conté todas las caras, también las de atrás?",
            "rule": "Un cuerpo también tiene caras atrás y abajo que no vemos.",
            "wrong_fix": "Mmm, probé {answer} y sigue sin verse bien. ¿Giramos la figura juntos?",
            "chips": ["Olvidaste las caras escondidas atrás y abajo", "Contaste las esquinas", "Una figura solo tiene las caras que se ven"],
            "steps": ["Veo {visible} caras delante.", "{hidden} caras más se esconden atrás y abajo.", "{visible} + {hidden} = {total} caras planas."],
            "hints": ["¿Hay caras que no se ven en el dibujo?", "Imagina que giras la figura. Cuenta también atrás y abajo.", "Hay {visible} caras delante. ¿Cuántas se esconden?"],
        },
        "fractions": {
            "label": "fracciones", "q": "1/{a} ? 1/{b}",
            "ask_why": "¡Oh! ¿Pero por qué los pedazos son más pequeños?",
            "point": "Mmm, ¿qué pedazo es más grande?",
            "rule": "Cuantas más partes iguales cortamos, más pequeña es cada parte.",
            "wrong_fix": "Mmm, probé {answer} y sigue sin verse bien. ¿Miramos las barras juntos?",
            "chips": ["Un número de abajo más grande da pedazos más pequeños", "El número de abajo más grande siempre es mayor", "Se te olvidó llevar el 1"],
            "steps": ["1/{a} es un entero cortado en {a} partes iguales.", "1/{b} es el mismo entero cortado en {b} partes.", "Más partes hacen cada parte más pequeña, así que 1/{a} {sym} 1/{b}."],
            "hints": ["¿Qué pedazo es más grande: una pizza cortada en {a} o en {b}?", "Más partes significa partes más pequeñas.", "Mira las barras: ¿cuál es más larga?"],
        },
        "graphs": {
            "label": "gráficas de barras", "q": "📊 ¿Cuántos {e1} más que {e2}? ?",
            "ask_why": "¡Oh! ¿Pero por qué necesito las dos barras?",
            "point": "Mmm, ¿comparé las dos barras?",
            "rule": "\"Cuántos más\" significa comparar dos barras y buscar la diferencia.",
            "wrong_fix": "Mmm, probé {answer} y sigue sin verse bien. ¿Leemos las dos barras juntos?",
            "chips": ["Leíste una barra, pero hay que comparar las dos", "Había que sumar las dos barras", "La barra más alta siempre es la respuesta"],
            "steps": ["La barra de {e1} llega a {v1}.", "La barra de {e2} llega a {v2}.", "{v1} − {v2} = {diff}, así que hay {diff} más."],
            "hints": ["\"Cuántos más\" significa comparar dos barras.", "Lee las dos barras y busca la diferencia.", "{e1} es {v1} y {e2} es {v2}."],
        },
    },
    "vi": {
        "share": {
            "label": "phép chia", "q": "{a} : {b} = ?",
            "ask_why": "Ồ! Nhưng chia đều nghĩa là gì?",
            "point": "Ừm, mình có chia thành các nhóm bằng nhau không?",
            "rule": "Chia đều là chia thành các nhóm bằng nhau rồi đếm mỗi nhóm có bao nhiêu.",
            "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng chia nhóm nhé?",
            "chips": ["Bạn đã trừ đi thay vì chia thành các nhóm bằng nhau", "Bạn quên nhớ 1", "Chia đều là cộng các số lại"],
            "steps": ["Mình chia {a} thành {b} nhóm bằng nhau.", "Mình đếm thêm {b} mỗi lần: {seq}. Đó là {q} lần.", "Vậy mỗi nhóm có {q}."],
            "hints": ["Chia đều là chia thành các nhóm bằng nhau. Mỗi nhóm có bao nhiêu?", "Đếm thêm {b} mỗi lần cho đến {a}.", "{b}, {b2}, {b3}… Bạn đếm bao nhiêu lần?"],
        },
        "patterns": {
            "label": "quy luật dãy số", "q": "{seq}, ?",
            "ask_why": "Ồ! Nhưng làm sao bạn biết số tiếp theo?",
            "point": "Ừm, mỗi lần các số nhảy bao nhiêu?",
            "rule": "Một quy luật nhảy cùng một bước mỗi lần.",
            "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng xem các bước nhảy nhé?",
            "chips": ["Bạn cộng 1, nhưng dãy số nhảy cùng một bước mỗi lần", "Phải bắt đầu lại từ số đầu tiên", "Dãy số luôn tăng 1"],
            "steps": ["Các số nhảy {d} mỗi lần: {x} → {y}.", "Sau {last} mình nhảy thêm {d}: {last} + {d} = {next}."],
            "hints": ["Xem các số tăng bao nhiêu mỗi lần.", "Tìm bước nhảy giữa hai số đứng cạnh nhau.", "Từ {x} đến {y} là nhảy {d}. Sau {last} là số mấy?"],
        },
        "big_numbers": {
            "label": "giá trị hàng", "q": "Trong số {n}, chữ số {d} có giá trị ?",
            "ask_why": "Ồ! Nhưng làm sao bạn biết chữ số {d} có giá trị bao nhiêu?",
            "point": "Ừm, chữ số {d} ở hàng nào?",
            "rule": "Mỗi hàng sang trái thì chữ số có giá trị lớn hơn: đơn vị, chục, trăm, nghìn.",
            "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng đếm các hàng nhé?",
            "chips": ["Bạn đếm thiếu một hàng, nên chữ số có giá trị gấp 10 lần", "Bạn quên nhớ 1", "Chữ số nào cũng chỉ có giá trị bằng chính nó"],
            "steps": ["Mình đếm các hàng từ phải sang: đơn vị, chục, trăm, nghìn…", "Chữ số {d} ở {place}.", "Vậy nó có giá trị {value}."],
            "hints": ["Chữ số {d} ở hàng nào?", "Đếm các hàng từ phải sang: đơn vị, chục, trăm…", "Chữ số {d} ở {place}."],
        },
        "time": {
            "label": "thời gian", "q": "{start} + {m} phút = ?",
            "ask_why": "Ồ! Nhưng tại sao số phút không được quá 60?",
            "point": "Ừm, một giờ có bao nhiêu phút?",
            "rule": "Một giờ có 60 phút, nên 60 phút là thêm một giờ.",
            "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng đếm số phút nhé?",
            "chips": ["Một giờ chỉ có 60 phút, không phải 100", "Phải trừ số phút đi", "Đồng hồ có đến 100 phút"],
            "steps": ["{mm} phút cộng {m} phút là {sum} phút.", "60 phút là 1 giờ, nên thêm 1 giờ và {rest} phút.", "Vậy là {answer}."],
            "hints": ["Một giờ có bao nhiêu phút?", "Khi đủ 60 phút thì thành một giờ mới.", "{mm} + {m} = {sum} phút. Bớt 60 phút để thành một giờ."],
        },
        "measure": {
            "label": "đo lường", "q": "📏 {obj} dài ? cm.",
            "ask_why": "Ồ! Nhưng tại sao mình không đọc số ở cuối được?",
            "point": "Ừm, {obj} bắt đầu ở đâu trên thước?",
            "rule": "Nếu vật không bắt đầu ở số 0, mình đếm từ chỗ nó bắt đầu.",
            "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng nhìn cái thước nhé?",
            "chips": ["Nó không bắt đầu ở số 0, nên không thể chỉ đọc số ở cuối", "Phải cộng hai số lại", "Cái thước bị hỏng"],
            "steps": ["{obj} bắt đầu ở {s}, không phải ở 0.", "Nó kết thúc ở {e}.", "{e} trừ {s} là {len}, vậy nó dài {len} cm."],
            "hints": ["{obj} bắt đầu ở đâu trên thước?", "Nếu không bắt đầu ở 0, hãy đếm các khoảng từ chỗ bắt đầu.", "Nó bắt đầu ở {s} và kết thúc ở {e}."],
        },
        "shapes": {
            "label": "hình khối", "q": "{shape} có ? mặt phẳng.",
            "ask_why": "Ồ! Nhưng làm sao đếm được những mặt mình không nhìn thấy?",
            "point": "Ừm, mình đã đếm hết các mặt, cả mặt phía sau chưa?",
            "rule": "Một hình khối còn có những mặt ở phía sau và mặt dưới mà mình không thấy.",
            "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng xoay hình nhé?",
            "chips": ["Bạn quên những mặt bị che ở phía sau và mặt dưới", "Bạn đã đếm các góc", "Hình chỉ có những mặt mình nhìn thấy"],
            "steps": ["Mình thấy {visible} mặt ở phía trước.", "Còn {hidden} mặt nữa bị che ở phía sau và bên dưới.", "{visible} + {hidden} = {total} mặt phẳng."],
            "hints": ["Có mặt nào bị che trong hình không?", "Thử tưởng tượng xoay {shape}. Đếm cả mặt sau và mặt dưới.", "Có {visible} mặt ở phía trước. Còn bao nhiêu mặt bị che?"],
        },
        "fractions": {
            "label": "phân số", "q": "1/{a} ? 1/{b}",
            "ask_why": "Ồ! Nhưng tại sao các phần lại nhỏ hơn?",
            "point": "Ừm, phần nào lớn hơn?",
            "rule": "Chia càng nhiều phần bằng nhau thì mỗi phần càng nhỏ.",
            "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng nhìn các thanh nhé?",
            "chips": ["Mẫu số lớn hơn thì mỗi phần nhỏ hơn", "Mẫu số lớn hơn thì phân số luôn lớn hơn", "Bạn quên nhớ 1"],
            "steps": ["1/{a} là một cái bánh chia thành {a} phần bằng nhau.", "1/{b} là cái bánh đó chia thành {b} phần.", "Càng nhiều phần thì mỗi phần càng nhỏ, nên 1/{a} {sym} 1/{b}."],
            "hints": ["Miếng nào lớn hơn: bánh chia {a} phần hay chia {b} phần?", "Nhiều phần hơn nghĩa là mỗi phần nhỏ hơn.", "Nhìn các thanh: thanh nào dài hơn?"],
        },
        "graphs": {
            "label": "biểu đồ cột", "q": "📊 {e1} nhiều hơn {e2} bao nhiêu? ?",
            "ask_why": "Ồ! Nhưng tại sao mình cần cả hai cột?",
            "point": "Ừm, mình đã so sánh hai cột chưa?",
            "rule": "\"Nhiều hơn bao nhiêu\" nghĩa là so sánh hai cột và tìm hiệu.",
            "wrong_fix": "Ừm, mình thử {answer} mà vẫn chưa đúng. Mình cùng đọc cả hai cột nhé?",
            "chips": ["Bạn chỉ đọc một cột, nhưng phải so sánh cả hai", "Phải cộng hai cột lại", "Cột cao nhất luôn là đáp án"],
            "steps": ["Cột {e1} cao đến {v1}.", "Cột {e2} cao đến {v2}.", "{v1} − {v2} = {diff}, vậy nhiều hơn {diff}."],
            "hints": ["\"Nhiều hơn bao nhiêu\" nghĩa là so sánh hai cột.", "Đọc cả hai cột rồi tìm hiệu.", "{e1} là {v1} và {e2} là {v2}."],
        },
    },
}

# Explanation keywords (mock mode / LLM fallback): wrong idea → incorrect; why → concept; action → procedure.
RULES: dict[str, dict[str, str]] = {
    "share": {
        "wrong": r"take away|subtract|minus|\badd\b|plus|quit|rest|sum|trừ|cộng",
        "why": r"equal|same|each|fair|igual|cada|bằng nhau|mỗi|như nhau",
        "action": r"shar|group|divid|split|count by|repart|grupo|divid|chia|nhóm|đếm",
    },
    "patterns": {
        "wrong": r"carr|borrow|times table|llev|prest|nhớ|mượn",
        "why": r"same|each time|every time|always|pattern|mismo|cada vez|siempre|patr[oó]n|giống nhau|mỗi lần|luôn|quy luật",
        "action": r"jump|count by|skip|\badd|plus|by \d|salt|cont|suma|de \d+ en|nhảy|đếm|cộng|thêm",
    },
    "big_numbers": {
        "wrong": r"carr|borrow|llev|prest|nhớ|mượn",
        "why": r"place|hundred|thousand|times more|10 times|ten times|lugar|posici[oó]n|centena|mil|veces m[aá]s|hàng|trăm|nghìn|ngàn|gấp",
        "action": r"zero|count|digit|left|right|cero|d[ií]gito|cont|izquierda|derecha|số 0|chữ số|đếm|trái|phải",
    },
    "time": {
        "wrong": r"\b100\b|hundred|cien|một trăm",
        "why": r"\b60\b|sixty|an hour|one hour|new hour|sesenta|una hora|hora nueva|sáu mươi|một giờ|giờ mới",
        "action": r"minute|\badd|plus|hour|minuto|suma|hora|phút|cộng|giờ",
    },
    "measure": {
        "wrong": r"carr|borrow|times|llev|prest|nhớ|mượn|nhân",
        "why": r"\b0\b|zero|start|begin|cero|empie|comienz|inicio|bắt đầu|số 0|không bắt đầu",
        "action": r"count|subtract|minus|take away|space|cont|rest|espacio|đếm|trừ|khoảng",
    },
    "shapes": {
        "wrong": r"corner|edge|esquina|v[eé]rtice|arista|góc|đỉnh|cạnh",
        "why": r"hid|back|behind|bottom|can'?t see|cannot see|underneath|other side|atr[aá]s|abajo|debajo|no se ve|escond|oculta|phía sau|đằng sau|bên dưới|mặt dưới|không thấy|bị che",
        "action": r"count|face|side|turn|cont|cara|gira|đếm|mặt|xoay",
    },
    "fractions": {
        "wrong": r"carr|borrow|\badd\b|plus|llev|prest|suma|nhớ|mượn|cộng",
        "why": r"more pieces|smaller piece|pieces are smaller|cut into more|m[aá]s (partes|pedazos|trozos)|m[aá]s peque|partes m[aá]s|nhiều phần|phần nhỏ|càng nhỏ|mỗi phần nhỏ",
        "action": r"bottom|bigger|smaller|compare|piece|abajo|mayor|menor|compar|parte|pedazo|mẫu|lớn|nhỏ|so sánh|phần",
    },
    "graphs": {
        "wrong": r"\badd\b|plus|together|total|sum|suma|juntas|cộng|tổng",
        "why": r"compare|difference|both|two bars|how many more|compar|diferencia|ambas|las dos|so sánh|hiệu|cả hai|hai cột",
        "action": r"subtract|minus|take away|read|bar|rest|quit|lee|barra|trừ|đọc|cột",
    },
}

# The quick warm-up (gate for the new concepts): two problems the child solves themself.
WARMUP_TEXT = {
    "en": {"intro": "Before you teach me {label}, can you solve these two?", "pass": "Wow, you really know {label}! Now you can teach me.",
           "fail": "Almost! Let's try two more. You can do it."},
    "es": {"intro": "Antes de enseñarme {label}, ¿puedes resolver estos dos?", "pass": "¡Guau, sabes mucho de {label}! Ahora puedes enseñarme.",
           "fail": "¡Casi! Probemos dos más. Tú puedes."},
    "vi": {"intro": "Trước khi dạy mình {label}, bạn giải hai bài này nhé?", "pass": "Ôi, bạn giỏi {label} thật! Giờ bạn có thể dạy mình rồi.",
           "fail": "Gần đúng rồi! Mình thử hai bài nữa nhé. Bạn làm được mà."},
}


# ---------- generators (each returns an Item; numbers sized for ages 6-10) ----------

def _t(lang: str, concept: str) -> dict:
    return TEXT[lang][concept]


def _share(rng: random.Random, lang: str) -> Item:
    b, q = rng.randint(2, 9), rng.randint(3, 9)
    a = b * q
    return Item("share", _t(lang, "share")["q"].format(a=a, b=b), str(q), str(a - b), "number",
                data={"a": a, "b": b, "q": q})


def _patterns(rng: random.Random, lang: str) -> Item:
    d = rng.choice([2, 3, 4, 5, 10])
    start = rng.randint(1, 20) if d != 10 else rng.randint(1, 9) * 10 + rng.choice([0, 5])
    seq = [start + d * i for i in range(4)]
    nxt = seq[-1] + d
    return Item("patterns", _t(lang, "patterns")["q"].format(seq=", ".join(map(str, seq))), str(nxt), str(seq[-1] + 1),
                "number", data={"seq": seq, "d": d, "next": nxt})


def _big_numbers(rng: random.Random, lang: str) -> Item:
    for _ in range(100):
        n = rng.randint(1000, 999_999)
        s = str(n)
        k = rng.randint(1, len(s) - 1)  # place: 1 = tens … 5 = hundred thousands
        d = int(s[len(s) - 1 - k])
        if d == 0 or s.count(str(d)) != 1:
            continue  # the digit must be named unambiguously
        value, wrong = d * 10 ** k, d * 10 ** (k - 1)
        return Item("big_numbers", _t(lang, "big_numbers")["q"].format(n=fmt(n, lang), d=d), str(value), str(wrong),
                    "number", data={"n": n, "d": d, "k": k, "value": value})
    raise RuntimeError("big_numbers generator failed")


def _time(rng: random.Random, lang: str) -> Item:
    h = rng.randint(1, 10)
    mm = rng.choice(range(20, 60, 5))
    m = rng.choice([x for x in range(15, 60, 5) if 60 < mm + x < 100])  # Lumi's wrong "6:75" stays 2 digits
    total = mm + m
    answer = f"{h + 1}:{total - 60:02d}"
    return Item("time", _t(lang, "time")["q"].format(start=f"{h}:{mm:02d}", m=m), answer, f"{h}:{total}", "time",
                data={"h": h, "mm": mm, "m": m, "sum": total, "rest": total - 60})


def _measure(rng: random.Random, lang: str) -> Item:
    obj = rng.choice(list(OBJECTS["en"]))
    s = rng.randint(1, 5)
    length = rng.randint(3, 8)
    e = s + length
    name = OBJECTS[lang][obj]
    return Item("measure", _t(lang, "measure")["q"].format(obj=name), str(length), str(e), "number",
                visual={"type": "ruler", "start": s, "end": e, "max": 15, "item": obj},
                data={"obj": name, "s": s, "e": e, "len": length})


def _shapes(rng: random.Random, lang: str) -> Item:
    shape = rng.choice(list(SHAPES))
    total, visible = SHAPES[shape]
    name = SHAPE_NAMES[lang][shape]
    return Item("shapes", _t(lang, "shapes")["q"].format(shape=name), str(total), str(visible), "number",
                visual={"type": "shape", "shape": shape},
                data={"shape": name, "total": total, "visible": visible, "hidden": total - visible})


def _fractions(rng: random.Random, lang: str) -> Item:
    a, b = rng.sample([2, 3, 4, 5, 6, 8, 10], 2)
    sym = "<" if a > b else ">"  # 1/a < 1/b when a > b
    wrong = ">" if sym == "<" else "<"  # "the bigger bottom number is bigger"
    return Item("fractions", _t(lang, "fractions")["q"].format(a=a, b=b), sym, wrong, "compare",
                visual={"type": "fractions", "a": a, "b": b}, data={"a": a, "b": b, "sym": sym})


def _graphs(rng: random.Random, lang: str) -> Item:
    e1, e2, e3 = rng.sample(FRUITS, 3)
    v1 = rng.randint(5, 10)
    v2 = rng.randint(1, v1 - 2)
    v3 = rng.randint(1, 10)
    bars = [{"label": e, "value": v} for e, v in rng.sample([(e1, v1), (e2, v2), (e3, v3)], 3)]
    return Item("graphs", _t(lang, "graphs")["q"].format(e1=e1, e2=e2), str(v1 - v2), str(v1), "number",
                visual={"type": "bars", "bars": bars, "max": 10},
                data={"e1": e1, "e2": e2, "v1": v1, "v2": v2, "diff": v1 - v2})


GENERATORS = {
    "share": _share, "patterns": _patterns, "big_numbers": _big_numbers, "time": _time,
    "measure": _measure, "shapes": _shapes, "fractions": _fractions, "graphs": _graphs,
}


def make(concept: str, rng: random.Random, lang: str) -> Item:
    item = GENERATORS[concept](rng, lang)
    # The contract every problem must meet before anyone sees it.
    assert is_correct(item.kind, item.answer, item.answer), item
    assert not is_correct(item.kind, item.answer, item.wrong), item
    assert diagnose(item, item.wrong) == concept, item
    return item


# ---------- narration (numbers from Python) ----------

def _fields(item: Item, lang: str) -> dict:
    d = dict(item.data)
    c = item.concept
    if c == "share":
        d["seq"] = ", ".join(str(d["b"] * i) for i in range(1, d["q"] + 1))
        d["b2"], d["b3"] = d["b"] * 2, d["b"] * 3
    elif c == "patterns":
        d["x"], d["y"], d["last"] = d["seq"][0], d["seq"][1], d["seq"][-1]
    elif c == "big_numbers":
        d["place"], d["value"] = PLACES[lang][d["k"]], fmt(d["value"], lang)
    elif c == "time":
        d["answer"] = item.answer
    elif c == "fractions":
        d["sym"] = item.answer
    return d


def steps(item: Item, lang: str) -> list[str]:
    f = _fields(item, lang)
    return [s.format(**f) for s in _t(lang, item.concept)["steps"]]


def hint(item: Item, lang: str, level: int) -> str:
    """Help-mode hint ladder for a role switch: 1 reflect, 2 strategy, 3 worked step (4 reveals: caller)."""
    f = _fields(item, lang)
    return _t(lang, item.concept)["hints"][min(max(level, 1), 3) - 1].format(**f)


def concept_text(lang: str, concept: str) -> dict:
    """The same keys the original four have in teach.TT: label, ask_why, point, rule, wrong_fix, chips."""
    t = _t(lang, concept)
    return {k: t[k] for k in ("label", "ask_why", "point", "rule", "wrong_fix", "chips")}


def item_from(concept: str, problem: str, answer: str, kind: str, visual: Optional[dict], data: dict) -> Item:
    return Item(concept, problem, answer, "", kind, visual, data)
