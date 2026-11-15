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
DREAMS: tuple[str, ...] = ("astronaut", "baker")
# The app also offers "doctor"; it has no stories yet, so a doctor sheet is plain math (valid_dream → None).


def valid_dream(dream: Optional[str]) -> Optional[str]:
    """A known dream, or None (unknown values are ignored, never an error)."""
    return dream if dream in DREAMS else None


# Bar-graph pictures: the generator draws fruit; a dream swaps them for its own (same counts).
GRAPH_ICONS: dict[str, dict[str, str]] = {
    "astronaut": {"🍎": "🪐", "🍐": "⭐", "🍌": "🌙", "🍇": "☄️", "🍓": "🛸"},
    "baker": {"🍎": "🧁", "🍐": "🍩", "🍌": "🥐", "🍇": "🍪", "🍓": "🥧"},
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

# Baker: a busy little bakery with regulars (a hungry bear, Grandma, bunnies, squirrels), oven timers, mishaps and
# deliveries, so a page reads like a day in the shop rather than the same sentence five times.
STORIES["baker"] = {
    "en": {
        "add": [
            "🧁 Lumi baked {a} cupcakes, then {b} more popped out of the oven. Cupcakes now: ?",
            "🐻 A hungry bear orders {a} muffins. Then he wants {b} more! Lumi packs ? muffins.",
            "🥚 The recipe needs {a} g of sugar plus {b} g of honey. Sweet stuff: ? g",
            "🎂 Grandma's party cake gets {a} sprinkles, then Lumi adds {b}. Sprinkles: ?",
            "🚚 Delivery day: {a} loaves to the school, {b} to the park café. Loaves sent: ?",
        ],
        "sub": [
            "🍪 The cookie jar had {a} cookies. Lumi's friends ate {b}. Cookies left: ?",
            "🐦 Lumi set out {a} crumbs and the birds gobbled {b}. ? crumbs remain.",
            "🥐 {a} croissants on the shelf. The lunch rush buys {b}. Still on the shelf: ?",
            "🔥 Oops! {b} of Lumi's {a} pretzels got too crispy. Good pretzels: ?",
            "🧈 Lumi had {a} g of butter and used {b} g in a pie crust. Butter left: ? g",
        ],
        "mul": [
            "🧁 {a} trays hold {b} cupcakes each. That's ? cupcakes to frost!",
            "🍓 Lumi puts {b} strawberries on each of {a} tarts. Strawberries used: ?",
            "🎂 A tower cake has {a} layers with {b} candles on each. Candles: ?",
            "🐰 {a} bunnies each order {b} carrot muffins. Lumi bakes ? muffins.",
            "🍩 {a} boxes of {b} donuts go to the fire station: ? donuts!",
        ],
        "share": [
            "🍪 {a} cookies shared fairly among {b} kids: ? each.",
            "🥧 Lumi puts {a} pie slices on {b} plates, the same on each: ? per plate.",
            "🎁 {a} macarons fit into {b} gift boxes equally. Each box gets ?",
            "🐿️ {a} acorn buns for {b} squirrels, shared fairly: ? per squirrel.",
            "🍞 {a} bread rolls go into {b} baskets evenly: ? rolls per basket.",
        ],
        "patterns": [
            "🍪 Cookies on the tray, row by row: {problem}",
            "🔔 The bakery door bell rings: {problem}",
            "🎂 Candles on each birthday cake: {problem}",
            "🧁 Lumi's frosting swirls: {problem}",
            "🥨 Pretzels sold each hour: {problem}",
        ],
        "big_numbers": [
            "🌾 Grains of flour in the giant sack. {problem}",
            "🧾 Cookies the bakery sells in a year. {problem}",
            "🏆 Votes in the great cake contest. {problem}",
            "🍬 Sprinkles in Lumi's enormous jar. {problem}",
            "🎟️ A ticket number at the bread fair. {problem}",
        ],
        "time": [
            "⏲️ The bread goes in at {start} and bakes for {m} minutes. Ding! at ?",
            "🧁 Cupcakes cool from {start} for {m} minutes. Ready to frost at ?",
            "🍕 Pizza night: the dough rises from {start} for {m} min. Ready at ?",
            "🐻 The bear arrives at {start} and waits {m} min for his pie. He eats at ?",
            "🥐 The bakery opens at {start}. Croissants come out {m} min later, at ?",
        ],
        "measure": [
            "📏 Lumi measures the {obj} next to the rolling pin: ? cm.",
            "🥄 Lumi checks the cake's size with a {obj}. The {obj} is ? cm long.",
            "🧾 Lumi finds a {obj} in the flour bag! It is ? cm long.",
            "🎨 Lumi uses a {obj} as a frosting guide: ? cm long.",
            "🐭 A tiny mouse drags off Lumi's {obj}, which is ? cm long.",
        ],
        "shapes": [
            "🎁 A gift tin shaped like a {shape} has ? flat faces.",
            "🧀 Lumi carves cheese into a {shape}. Flat faces: ?",
            "🍰 A fancy cake shaped like a {shape} has ? flat faces to frost.",
            "🧈 The butter block is a {shape} with ? flat faces.",
            "🍬 A candy mold shaped like a {shape} has ? flat faces.",
        ],
        "fractions": [
            "🥧 Slices of two same-size pies: {problem}",
            "🍫 Pieces of two chocolate bars: {problem}",
            "🍕 Bakery pizza slices: {problem}",
            "🎂 The bigger piece of birthday cake: {problem}",
            "🍞 Slices of two equal loaves: {problem}",
        ],
        "graphs": [
            "📊 Today Lumi sold ? more {e1} than {e2}.",
            "📊 Customers chose {e1} over {e2} by ?",
            "📊 Bake sale chart: {e1} beat {e2} by ?",
            "🐻 The bear counts treats: ? more {e1} than {e2}.",
            "📊 Lumi's order book: ? extra {e1} compared with {e2}.",
        ],
    },
    "es": {
        "add": [
            "🧁 Lumi horneó {a} magdalenas y luego salieron {b} más del horno. Ahora hay ?",
            "🐻 Un oso hambriento pide {a} panecillos. ¡Luego quiere {b} más! Lumi empaca ?",
            "🥚 La receta lleva {a} g de azúcar y {b} g de miel. Dulce en total: ? g",
            "🎂 La tarta de la abuela lleva {a} chispas y Lumi añade {b}. Chispas: ?",
            "🚚 Reparto: {a} panes a la escuela y {b} al café del parque. Panes enviados: ?",
        ],
        "sub": [
            "🍪 El tarro tenía {a} galletas. Los amigos de Lumi se comieron {b}. Quedan ?",
            "🐦 Lumi dejó {a} migas y los pájaros se comieron {b}. Quedan ? migas.",
            "🥐 Hay {a} cruasanes en la repisa. A mediodía se venden {b}. Quedan ?",
            "🔥 ¡Uy! {b} de los {a} pretzels de Lumi se tostaron de más. Buenos: ?",
            "🧈 Lumi tenía {a} g de mantequilla y usó {b} g en una tarta. Le quedan ? g",
        ],
        "mul": [
            "🧁 {a} bandejas con {b} magdalenas cada una. ¡Son ? para decorar!",
            "🍓 Lumi pone {b} fresas en cada una de {a} tartaletas. Fresas usadas: ?",
            "🎂 Una tarta de {a} pisos lleva {b} velas en cada piso. Velas: ?",
            "🐰 {a} conejitos piden {b} panecillos de zanahoria cada uno. Lumi hornea ?",
            "🍩 {a} cajas de {b} donas van a la estación de bomberos: ¡? donas!",
        ],
        "share": [
            "🍪 {a} galletas repartidas por igual entre {b} niños: ? para cada uno.",
            "🥧 Lumi pone {a} trozos de tarta en {b} platos por igual: ? por plato.",
            "🎁 {a} macarons caben por igual en {b} cajas de regalo. Cada caja lleva ?",
            "🐿️ {a} bollos de bellota para {b} ardillas, por igual: ? por ardilla.",
            "🍞 {a} panecillos en {b} cestas por igual: ? por cesta.",
        ],
        "patterns": [
            "🍪 Galletas en la bandeja, fila por fila: {problem}",
            "🔔 La campanita de la panadería suena: {problem}",
            "🎂 Velas en cada tarta de cumpleaños: {problem}",
            "🧁 Los remolinos de crema de Lumi: {problem}",
            "🥨 Pretzels vendidos cada hora: {problem}",
        ],
        "big_numbers": [
            "🌾 Granos de harina en el saco gigante. {problem}",
            "🧾 Galletas que vende la panadería en un año. {problem}",
            "🏆 Votos del gran concurso de tartas. {problem}",
            "🍬 Chispas en el frasco enorme de Lumi. {problem}",
            "🎟️ Un número de entrada a la feria del pan. {problem}",
        ],
        "time": [
            "⏲️ El pan entra al horno a las {start} y se hornea {m} min. ¡Ding! a las ?",
            "🧁 Las magdalenas se enfrían desde las {start} por {m} min. Listas a las ?",
            "🍕 Noche de pizza: la masa sube desde las {start} por {m} min. Lista a las ?",
            "🐻 El oso llega a las {start} y espera su tarta {m} min. Come a las ?",
            "🥐 La panadería abre a las {start}. Los cruasanes salen {m} min después: ?",
        ],
        "measure": [
            "📏 Lumi mide su {obj} junto al rodillo: ? cm.",
            "🥄 Lumi usa su {obj} para medir la tarta. Mide ? cm.",
            "🧾 ¡Lumi encuentra su {obj} en el saco de harina! Mide ? cm.",
            "🎨 Lumi decora usando su {obj} como guía: mide ? cm.",
            "🐭 Un ratoncito arrastra el objeto de Lumi, su {obj}: mide ? cm.",
        ],
        "shapes": [
            "🎁 Una lata de regalo con forma de {shape} tiene ? caras planas.",
            "🧀 Lumi talla queso con forma de {shape}. Caras planas: ?",
            "🍰 Una tarta con forma de {shape} tiene ? caras para decorar.",
            "🧈 La mantequilla, con forma de {shape}, tiene ? caras planas.",
            "🍬 Un molde de caramelos con forma de {shape} tiene ? caras planas.",
        ],
        "fractions": [
            "🥧 Trozos de dos tartas iguales: {problem}",
            "🍫 Trozos de dos tabletas de chocolate: {problem}",
            "🍕 Porciones de pizza de la panadería: {problem}",
            "🎂 El trozo más grande de la tarta: {problem}",
            "🍞 Rebanadas de dos panes iguales: {problem}",
        ],
        "graphs": [
            "📊 Hoy Lumi vendió ? {e1} más que {e2}.",
            "📊 Los clientes eligieron {e1} sobre {e2} por ?",
            "📊 Gráfica de la venta de pasteles: {e1} gana a {e2} por ?",
            "🐻 El oso cuenta dulces: ? {e1} más que {e2}.",
            "📊 El libro de pedidos de Lumi: ? {e1} más que {e2}.",
        ],
    },
    "vi": {
        "add": [
            "🧁 Lumi nướng {a} bánh cupcake, rồi lò ra thêm {b} cái. Giờ có ? cái.",
            "🐻 Bác gấu đói đặt {a} bánh muffin, rồi muốn thêm {b} cái! Lumi gói ? cái.",
            "🥚 Công thức cần {a} g đường và {b} g mật ong. Tổng cộng: ? g",
            "🎂 Bánh tiệc của bà có {a} hạt cốm, Lumi rắc thêm {b} hạt. Có ? hạt cốm.",
            "🚚 Giao hàng: {a} ổ bánh mì tới trường, {b} ổ tới quán cà phê. Đã giao ? ổ.",
        ],
        "sub": [
            "🍪 Hũ có {a} cái bánh quy. Bạn của Lumi ăn mất {b} cái. Còn ? cái.",
            "🐦 Lumi rải {a} vụn bánh, chim mổ mất {b} vụn. Còn ? vụn.",
            "🥐 Kệ có {a} bánh sừng bò. Giờ trưa bán được {b} cái. Còn lại: ?",
            "🔥 Ối! {b} trong {a} bánh xoắn của Lumi bị cháy. Bánh ngon còn: ?",
            "🧈 Lumi có {a} g bơ, dùng {b} g làm vỏ bánh. Còn ? g bơ.",
        ],
        "mul": [
            "🧁 {a} khay, mỗi khay {b} bánh cupcake. Có ? bánh cần phủ kem!",
            "🍓 Lumi đặt {b} quả dâu lên mỗi bánh tart, có {a} bánh. Dùng ? quả dâu.",
            "🎂 Bánh tháp {a} tầng, mỗi tầng {b} cây nến. Có ? cây nến.",
            "🐰 {a} bạn thỏ, mỗi bạn đặt {b} bánh cà rốt. Lumi nướng ? cái.",
            "🍩 {a} hộp, mỗi hộp {b} bánh donut gửi đội cứu hỏa: ? cái!",
        ],
        "share": [
            "🍪 Chia đều {a} bánh quy cho {b} bạn nhỏ: mỗi bạn ? cái.",
            "🥧 Lumi xếp đều {a} miếng bánh vào {b} đĩa: mỗi đĩa ? miếng.",
            "🎁 Xếp đều {a} bánh macaron vào {b} hộp quà: mỗi hộp ? cái.",
            "🐿️ {a} bánh hạt dẻ chia đều cho {b} chú sóc: mỗi chú ? cái.",
            "🍞 Chia đều {a} bánh mì nhỏ vào {b} giỏ: mỗi giỏ ? cái.",
        ],
        "patterns": [
            "🍪 Bánh quy trên khay, từng hàng: {problem}",
            "🔔 Chuông cửa tiệm bánh reo: {problem}",
            "🎂 Số nến trên mỗi bánh sinh nhật: {problem}",
            "🧁 Số vòng kem Lumi bắt: {problem}",
            "🥨 Số bánh xoắn bán mỗi giờ: {problem}",
        ],
        "big_numbers": [
            "🌾 Số hạt bột trong bao khổng lồ. {problem}",
            "🧾 Số bánh quy tiệm bán trong một năm. {problem}",
            "🏆 Số phiếu bầu cuộc thi bánh. {problem}",
            "🍬 Số hạt cốm trong hũ to của Lumi. {problem}",
            "🎟️ Số vé hội chợ bánh. {problem}",
        ],
        "time": [
            "⏲️ Bánh mì vào lò lúc {start}, nướng {m} phút. Ting! lúc ?",
            "🧁 Bánh cupcake để nguội từ {start} trong {m} phút. Phủ kem lúc ?",
            "🍕 Tối pizza: bột ủ từ {start} trong {m} phút. Xong lúc ?",
            "🐻 Bác gấu tới lúc {start}, chờ bánh {m} phút. Bác ăn lúc ?",
            "🥐 Tiệm mở cửa lúc {start}. {m} phút sau bánh sừng bò ra lò, lúc ?",
        ],
        "measure": [
            "📏 Lumi đo {obj} cạnh cây cán bột: ? cm.",
            "🥄 Lumi dùng {obj} để đo bánh. Nó dài ? cm.",
            "🧾 Lumi tìm thấy {obj} trong bao bột! Nó dài ? cm.",
            "🎨 Lumi dùng {obj} làm thước để trang trí: dài ? cm.",
            "🐭 Chú chuột nhỏ kéo {obj} của Lumi đi. Nó dài ? cm.",
        ],
        "shapes": [
            "🎁 Hộp thiếc dạng {shape} có ? mặt phẳng.",
            "🧀 Lumi cắt phô mai thành {shape}. Số mặt phẳng: ?",
            "🍰 Bánh kem dạng {shape} có ? mặt phẳng để phủ kem.",
            "🧈 Khối bơ dạng {shape} có ? mặt phẳng.",
            "🍬 Khuôn kẹo dạng {shape} có ? mặt phẳng.",
        ],
        "fractions": [
            "🥧 Miếng của hai bánh pie bằng nhau: {problem}",
            "🍫 Miếng của hai thanh sô-cô-la: {problem}",
            "🍕 Miếng pizza của tiệm: {problem}",
            "🎂 Miếng bánh sinh nhật nào lớn hơn: {problem}",
            "🍞 Lát của hai ổ bánh mì bằng nhau: {problem}",
        ],
        "graphs": [
            "📊 Hôm nay Lumi bán {e1} nhiều hơn {e2} ? cái.",
            "📊 Khách chọn {e1} nhiều hơn {e2} ? lần.",
            "📊 Biểu đồ hội chợ bánh: {e1} hơn {e2} ? cái.",
            "🐻 Bác gấu đếm bánh: {e1} nhiều hơn {e2} ? cái.",
            "📊 Sổ đặt hàng của Lumi: {e1} hơn {e2} ? cái.",
        ],
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

INTROS["baker"] = {
    "en": {
        "intro": "I want to be a baker! 🧁 Here's my bakery homework. Can you be my teacher? Tap ✓ if I got it right, or ✗ if I made a mistake, and write the right answer.",
        "review_intro": "Bakers practise every morning! 🥐 Can you check my bakery homework again, teacher?",
    },
    "es": {
        "intro": "¡Quiero ser panadero! 🧁 Esta es mi tarea de la panadería. ¿Puedes ser mi profe? Toca ✓ si está bien, o ✗ si me equivoqué, y escribe la respuesta correcta.",
        "review_intro": "¡Los panaderos practican cada mañana! 🥐 ¿Puedes revisar mi tarea de la panadería otra vez, profe?",
    },
    "vi": {
        "intro": "Mình muốn trở thành thợ làm bánh! 🧁 Đây là bài tập tiệm bánh của mình. Bạn làm cô giáo của mình nhé? Chạm ✓ nếu mình làm đúng, hoặc ✗ nếu mình sai, rồi viết đáp án đúng.",
        "review_intro": "Thợ làm bánh luyện tập mỗi sáng! 🥐 Bạn kiểm tra bài tiệm bánh của mình lần nữa nhé?",
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
