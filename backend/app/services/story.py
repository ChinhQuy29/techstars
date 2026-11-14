"""Lumi's Journey to the moon: a choices-matter story built from what the child teaches.
Spec: docs/03-lumis-town.md (Lumi's Journey).

- Three acts, four versions each. A version opens when BOTH of its two concepts have ≥ 1 star, in any order.
- Acts go in order; the child picks one version per act (a choice when more than one has opened).
- The Act 2 version is the path (engineer / musician / scientist / pilot) and decides the moon ending.
- Versions not picked become "What if…?" stories once both concepts are taught.
- Read-only for learning: the story never changes stars. Every number in a scene is computed here.
"""
from __future__ import annotations

from typing import Optional

from .concepts import fmt
from .session import Session

UNLOCK = 1.0  # stars a concept needs to count for the story (same as a Town place)
START_PLACES = 2  # the journey starts once two Town shops are open
TOWN = ("carry", "borrow", "off_by_one", "mul")

# act -> versions: key -> (concept pair, emoji, numbers for the lines)
ACTS: dict[int, dict[str, tuple[tuple[str, str], str]]] = {
    1: {
        "savings": (("carry", "borrow"), "🐷"),
        "bake_sale": (("mul", "share"), "🍪"),
        "star_map": (("patterns", "big_numbers"), "🔭"),
        "town_vote": (("graphs", "off_by_one"), "🗳️"),
    },
    2: {
        "engineer": (("measure", "shapes"), "🛠️"),
        "musician": (("patterns", "fractions"), "🥁"),
        "scientist": (("graphs", "share"), "🔬"),
        "pilot": (("time", "big_numbers"), "✈️"),
    },
    3: {
        "packing": (("mul", "fractions"), "🎒"),
        "launch_window": (("time", "borrow"), "⏰"),
        "trouble": (("measure", "carry"), "🔧"),
        "navigation": (("big_numbers", "off_by_one"), "🧭"),
    },
}
ENDINGS = {"engineer": "moon_engineer", "musician": "moon_musician", "scientist": "moon_scientist", "pilot": "moon_pilot"}


def _numbers(lang: str) -> dict[str, dict]:
    """Every number the scenes say, computed (so the story's math is always right)."""
    a, b, spent = 245, 378, 185
    trays, per, boxes = 6, 8, 4
    yes, no = 17, 4
    seeds, pots, sunny, shady = 24, 6, 12, 7
    start_h, start_m, lesson = 9, 40, 35
    end_total = start_h * 60 + start_m + lesson
    days, meals = 3, 4
    lift_h, now_m = 7, 42
    g1, g2 = 38, 47
    dist, done = 384_400, 250_000
    return {
        "savings": {"a": a, "b": b, "sum": a + b, "spent": spent, "left": a + b - spent},
        "bake_sale": {"trays": trays, "per": per, "total": trays * per, "boxes": boxes, "each": trays * per // boxes},
        "star_map": {"dist": fmt(dist, lang)},
        "town_vote": {"yes": yes, "no": no, "more": yes - no},
        "engineer": {"fins": 4, "fin": 30},
        "musician": {"beats": 4},
        "scientist": {"seeds": seeds, "pots": pots, "each": seeds // pots, "sunny": sunny, "shady": shady, "diff": sunny - shady},
        "pilot": {"alt": fmt(10_000, lang), "start": f"{start_h}:{start_m:02d}", "mins": lesson,
                  "end": f"{end_total // 60}:{end_total % 60:02d}"},
        "packing": {"days": days, "meals": meals, "packs": days * meals},
        "launch_window": {"lift": f"{lift_h}:00", "now": f"{lift_h - 1}:{now_m}", "wait": 60 - now_m},
        "trouble": {"g1": g1, "g2": g2, "total": g1 + g2},
        "navigation": {"done": fmt(done, lang), "left": fmt(dist - done, lang)},
    }


# Scene text: title + lines, each line with Lumi's emotion. Gentle sadness is allowed only in story setbacks.
TEXT: dict[str, dict] = {
    "en": {
        "acts": {1: "Getting ready", 2: "Finding a way", 3: "The journey", 4: "The moon"},
        "need_start": "Open two shops in Lumi's Town to start Lumi's journey to the moon!",
        "dream": "I want to go to the moon! What you teach me decides how I get there.",
        "two_ideas": "I have more than one idea! Which one should I try?",
        "idea": "Lumi is getting an idea…",
        "mystery": "A mystery",
        "what_if": "What if…?",
        "thanks": "You taught me {label}: “{quote}”",
        "scenes": {
            "savings": ("Counting the savings", [
                ("thinking", "Lumi empties its piggy bank: {a}¢ from the lemonade stand plus {b}¢ from the change counter makes {sum}¢!"),
                ("thinking", "Then Lumi takes away {spent}¢ for new tools. {sum} − {spent} = {left}¢ left."),
                ("happy", "\"It's a start! Moon, here I come!\"")]),
            "bake_sale": ("The bake sale", [
                ("thinking", "Lumi bakes {trays} trays with {per} cookies on each. That's {total} cookies!"),
                ("thinking", "It shares them into {boxes} boxes: {each} cookies in every box."),
                ("celebrating", "The whole town lines up, and every box sells by lunchtime!")]),
            "star_map": ("The star map", [
                ("curious", "In the library, Lumi counts the stars on a map by fives: 5, 10, 15, 20, 25, 30!"),
                ("confused", "The book says the moon is {dist} kilometers away. Lumi gulps. That's so far…"),
                ("encouraging", "\"Far is okay. I'll get there one step at a time.\"")]),
            "town_vote": ("The town vote", [
                ("thinking", "Lumi asks the whole town: should Lumi go to the moon? It counts every vote carefully, twice."),
                ("curious", "On the bar graph, Yes has {yes} votes and No has {no}. That's {more} more for Yes!"),
                ("celebrating", "Everyone cheers. Lumi's eyes glow extra bright.")]),
            "engineer": ("Lumi the Engineer", [
                ("thinking", "Lumi designs its own rocket: a cone for the nose, a cylinder for the body and {fins} triangle fins."),
                ("thinking", "Each fin must be {fin} cm long. Lumi measures from 0, just like you taught it."),
                ("happy", "Bolt by bolt, the rocket rises behind the workshop.")]),
            "musician": ("Lumi the Musician", [
                ("thinking", "Lumi writes a song with {beats} beats in every bar: tap, tap, tap, tap, the same every time."),
                ("happy", "Two half notes fill a bar, and so do four quarter notes. A 1/2 note is longer than a 1/4 note!"),
                ("celebrating", "The concert is so good that the Moon Mission invites Lumi to play in space!")]),
            "scientist": ("Lumi the Scientist", [
                ("thinking", "Lumi plants a moon garden, sharing {seeds} seeds equally into {pots} pots: {each} in each."),
                ("curious", "Every day it graphs the plants. The sunny pots reach {sunny} cm and the shady ones {shady} cm: {diff} cm more!"),
                ("celebrating", "The science fair loves it, and Lumi wins a seat on the moon science mission!")]),
            "pilot": ("Lumi the Pilot", [
                ("confused", "At flight school, Lumi reads the altimeter for the first time: {alt} meters up! Its hands shake a little."),
                ("thinking", "The lesson starts at {start} and lasts {mins} minutes, so it ends at {end}. Right on time."),
                ("celebrating", "Lumi earns its pilot wings. Next stop: the moon!")]),
            "packing": ("Packing supplies", [
                ("thinking", "The trip takes {days} days, with {meals} meals a day: {packs} meal packs."),
                ("thinking", "The water tank is 1/2 full, so Lumi fills the other 1/2. Two halves make one whole tank!"),
                ("happy", "Everything fits. Lumi zips the bag with a happy click.")]),
            "launch_window": ("The launch window", [
                ("curious", "Liftoff is at {lift}. It's {now} now, so there are {wait} minutes to go."),
                ("confused", "Lumi's antenna wiggles. Its lights flicker. It's nervous… and excited."),
                ("celebrating", "3… 2… 1… Liftoff!")]),
            "trouble": ("Trouble in space", [
                ("confused", "Crack! A panel breaks halfway to the moon. Lumi's lights go dim. It feels scared and sad."),
                ("thinking", "Then it remembers what you taught it. It measures the gaps: {g1} cm and {g2} cm, {total} cm in all."),
                ("happy", "Patch, patch, done. \"I couldn't have fixed it without you, teacher.\"")]),
            "navigation": ("Finding the way", [
                ("thinking", "Lumi checks the map: {done} km traveled."),
                ("thinking", "It counts carefully, twice: {left} km still to go."),
                ("celebrating", "And there it is: the moon, big and bright in the window!")]),
            "moon_engineer": ("The moon", [
                ("happy", "Lumi steps out beside the rocket it built with its own hands."),
                ("celebrating", "It plants a flag with a lemon, a coin and a cookie, and happy tears glow in its eyes.")]),
            "moon_musician": ("The moon", [
                ("happy", "On the quiet moon, Lumi sets up its drums while Earth glows above."),
                ("celebrating", "It plays the song you helped it learn, and happy tears glow in its eyes.")]),
            "moon_scientist": ("The moon", [
                ("happy", "Lumi picks up a moon rock and holds it up to Earth, where you are."),
                ("celebrating", "\"The first moon rock for our garden!\" Happy tears glow in its eyes.")]),
            "moon_pilot": ("The moon", [
                ("happy", "Lumi lands softly and climbs out of the cockpit."),
                ("celebrating", "It salutes its friends back home, and happy tears glow in its eyes.")]),
        },
    },
    "es": {
        "acts": {1: "Preparativos", 2: "Buscando el camino", 3: "El viaje", 4: "La luna"},
        "need_start": "¡Abre dos tiendas en el Pueblo de Lumi para empezar su viaje a la luna!",
        "dream": "¡Quiero ir a la luna! Lo que me enseñes decide cómo llego.",
        "two_ideas": "¡Tengo más de una idea! ¿Cuál pruebo?",
        "idea": "A Lumi se le está ocurriendo una idea…",
        "mystery": "Un misterio",
        "what_if": "¿Y si…?",
        "thanks": "Me enseñaste {label}: «{quote}»",
        "scenes": {
            "savings": ("Contando los ahorros", [
                ("thinking", "Lumi vacía su alcancía: {a}¢ del puesto de limonada más {b}¢ de la caja del cambio son {sum}¢."),
                ("thinking", "Luego quita {spent}¢ para herramientas nuevas. {sum} − {spent} = {left}¢."),
                ("happy", "«¡Es un comienzo! ¡Luna, allá voy!»")]),
            "bake_sale": ("La venta de galletas", [
                ("thinking", "Lumi hornea {trays} bandejas con {per} galletas cada una. ¡Son {total} galletas!"),
                ("thinking", "Las reparte en {boxes} cajas: {each} galletas en cada caja."),
                ("celebrating", "¡Todo el pueblo hace fila y las cajas se venden antes del almuerzo!")]),
            "star_map": ("El mapa de estrellas", [
                ("curious", "En la biblioteca, Lumi cuenta las estrellas de un mapa de cinco en cinco: 5, 10, 15, 20, 25, 30."),
                ("confused", "El libro dice que la luna está a {dist} kilómetros. Lumi traga saliva. Está tan lejos…"),
                ("encouraging", "«Lejos está bien. Llegaré paso a paso.»")]),
            "town_vote": ("La votación del pueblo", [
                ("thinking", "Lumi le pregunta a todo el pueblo: ¿debe Lumi ir a la luna? Cuenta cada voto con cuidado, dos veces."),
                ("curious", "En la gráfica de barras, Sí tiene {yes} votos y No tiene {no}. ¡Son {more} más para Sí!"),
                ("celebrating", "Todos aplauden. Los ojos de Lumi brillan más que nunca.")]),
            "engineer": ("Lumi ingeniero", [
                ("thinking", "Lumi diseña su propio cohete: un cono para la punta, un cilindro para el cuerpo y {fins} aletas triangulares."),
                ("thinking", "Cada aleta debe medir {fin} cm. Lumi mide desde el 0, como le enseñaste."),
                ("happy", "Tornillo a tornillo, el cohete se alza detrás del taller.")]),
            "musician": ("Lumi músico", [
                ("thinking", "Lumi escribe una canción con {beats} tiempos en cada compás: tap, tap, tap, tap, siempre igual."),
                ("happy", "Dos blancas llenan un compás, y también cuatro negras. ¡Una nota de 1/2 dura más que una de 1/4!"),
                ("celebrating", "¡El concierto es tan bueno que la Misión Lunar invita a Lumi a tocar en el espacio!")]),
            "scientist": ("Lumi científico", [
                ("thinking", "Lumi planta un jardín lunar y reparte {seeds} semillas por igual en {pots} macetas: {each} en cada una."),
                ("curious", "Cada día hace una gráfica. Las macetas al sol llegan a {sunny} cm y las de sombra a {shady} cm: ¡{diff} cm más!"),
                ("celebrating", "¡A la feria de ciencias le encanta, y Lumi gana un lugar en la misión científica a la luna!")]),
            "pilot": ("Lumi piloto", [
                ("confused", "En la escuela de vuelo, Lumi lee el altímetro por primera vez: ¡{alt} metros de altura! Le tiemblan un poco las manos."),
                ("thinking", "La clase empieza a las {start} y dura {mins} minutos, así que termina a las {end}. Justo a tiempo."),
                ("celebrating", "Lumi gana sus alas de piloto. Próxima parada: ¡la luna!")]),
            "packing": ("Preparando provisiones", [
                ("thinking", "El viaje dura {days} días, con {meals} comidas al día: {packs} paquetes de comida."),
                ("thinking", "El tanque de agua está a 1/2, así que Lumi llena la otra 1/2. ¡Dos mitades hacen un tanque entero!"),
                ("happy", "Todo cabe. Lumi cierra la mochila con un clic feliz.")]),
            "launch_window": ("La ventana de lanzamiento", [
                ("curious", "El despegue es a las {lift}. Son las {now}, así que faltan {wait} minutos."),
                ("confused", "La antena de Lumi tiembla y sus luces parpadean. Está nervioso… y emocionado."),
                ("celebrating", "3… 2… 1… ¡Despegue!")]),
            "trouble": ("Problemas en el espacio", [
                ("confused", "¡Crac! Un panel se rompe a mitad de camino. Las luces de Lumi se apagan un poco. Siente miedo y tristeza."),
                ("thinking", "Entonces recuerda lo que le enseñaste. Mide los huecos: {g1} cm y {g2} cm, {total} cm en total."),
                ("happy", "Parche, parche, listo. «No lo habría logrado sin ti, profe.»")]),
            "navigation": ("Buscando el rumbo", [
                ("thinking", "Lumi revisa el mapa: {done} km recorridos."),
                ("thinking", "Cuenta con cuidado, dos veces: faltan {left} km."),
                ("celebrating", "¡Y ahí está: la luna, grande y brillante en la ventana!")]),
            "moon_engineer": ("La luna", [
                ("happy", "Lumi sale junto al cohete que construyó con sus propias manos."),
                ("celebrating", "Clava una bandera con un limón, una moneda y una galleta, y lágrimas de alegría brillan en sus ojos.")]),
            "moon_musician": ("La luna", [
                ("happy", "En la luna silenciosa, Lumi arma su batería mientras la Tierra brilla arriba."),
                ("celebrating", "Toca la canción que lo ayudaste a aprender, y lágrimas de alegría brillan en sus ojos.")]),
            "moon_scientist": ("La luna", [
                ("happy", "Lumi recoge una roca lunar y la levanta hacia la Tierra, donde estás tú."),
                ("celebrating", "«¡La primera roca lunar para nuestro jardín!» Lágrimas de alegría brillan en sus ojos.")]),
            "moon_pilot": ("La luna", [
                ("happy", "Lumi aterriza suavemente y sale de la cabina."),
                ("celebrating", "Saluda a sus amigos en casa, y lágrimas de alegría brillan en sus ojos.")]),
        },
    },
    "vi": {
        "acts": {1: "Chuẩn bị", 2: "Tìm đường", 3: "Chuyến đi", 4: "Mặt trăng"},
        "need_start": "Mở hai cửa hàng ở Thị trấn Lumi để bắt đầu chuyến đi lên mặt trăng nhé!",
        "dream": "Mình muốn lên mặt trăng! Những gì bạn dạy sẽ quyết định cách mình đến đó.",
        "two_ideas": "Mình có nhiều ý tưởng! Mình nên thử cái nào?",
        "idea": "Lumi đang nảy ra một ý tưởng…",
        "mystery": "Điều bí ẩn",
        "what_if": "Nếu như…?",
        "thanks": "Bạn đã dạy mình {label}: “{quote}”",
        "scenes": {
            "savings": ("Đếm tiền tiết kiệm", [
                ("thinking", "Lumi đổ heo đất ra: {a}¢ từ quầy nước chanh cộng {b}¢ từ quầy đổi tiền là {sum}¢!"),
                ("thinking", "Rồi Lumi bớt {spent}¢ để mua dụng cụ. {sum} − {spent} = {left}¢."),
                ("happy", "“Khởi đầu rồi! Mặt trăng ơi, mình đến đây!”")]),
            "bake_sale": ("Phiên chợ bánh", [
                ("thinking", "Lumi nướng {trays} khay, mỗi khay {per} cái bánh. Tất cả {total} cái!"),
                ("thinking", "Lumi chia đều vào {boxes} hộp: mỗi hộp {each} cái."),
                ("celebrating", "Cả thị trấn xếp hàng, đến trưa là bán hết!")]),
            "star_map": ("Bản đồ sao", [
                ("curious", "Ở thư viện, Lumi đếm các ngôi sao trên bản đồ theo năm: 5, 10, 15, 20, 25, 30!"),
                ("confused", "Sách nói mặt trăng cách {dist} ki-lô-mét. Lumi nuốt nước bọt. Xa quá…"),
                ("encouraging", "“Xa cũng không sao. Mình sẽ đi từng bước một.”")]),
            "town_vote": ("Cuộc bỏ phiếu", [
                ("thinking", "Lumi hỏi cả thị trấn: Lumi có nên lên mặt trăng không? Lumi đếm từng phiếu thật cẩn thận, hai lần."),
                ("curious", "Trên biểu đồ cột, Có được {yes} phiếu, Không được {no} phiếu. Có nhiều hơn {more} phiếu!"),
                ("celebrating", "Mọi người reo hò. Mắt Lumi sáng rực.")]),
            "engineer": ("Kỹ sư Lumi", [
                ("thinking", "Lumi tự thiết kế tên lửa: đầu hình nón, thân hình trụ và {fins} cánh tam giác."),
                ("thinking", "Mỗi cánh phải dài {fin} cm. Lumi đo từ số 0, đúng như bạn đã dạy."),
                ("happy", "Từng con ốc một, tên lửa vươn cao sau xưởng.")]),
            "musician": ("Nhạc sĩ Lumi", [
                ("thinking", "Lumi viết bài hát có {beats} phách mỗi ô nhịp: tách, tách, tách, tách, lần nào cũng vậy."),
                ("happy", "Hai nốt trắng lấp đầy một ô nhịp, bốn nốt đen cũng vậy. Nốt 1/2 dài hơn nốt 1/4!"),
                ("celebrating", "Buổi hòa nhạc hay đến nỗi Nhiệm vụ Mặt trăng mời Lumi biểu diễn trong không gian!")]),
            "scientist": ("Nhà khoa học Lumi", [
                ("thinking", "Lumi trồng vườn mặt trăng, chia đều {seeds} hạt vào {pots} chậu: mỗi chậu {each} hạt."),
                ("curious", "Mỗi ngày Lumi vẽ biểu đồ. Chậu nắng cao {sunny} cm, chậu râm {shady} cm: hơn {diff} cm!"),
                ("celebrating", "Hội chợ khoa học rất thích, và Lumi giành một chỗ trong nhiệm vụ khoa học lên mặt trăng!")]),
            "pilot": ("Phi công Lumi", [
                ("confused", "Ở trường bay, Lumi đọc đồng hồ độ cao lần đầu: {alt} mét! Tay Lumi hơi run."),
                ("thinking", "Buổi học bắt đầu lúc {start} và kéo dài {mins} phút, nên kết thúc lúc {end}. Thật đúng giờ."),
                ("celebrating", "Lumi nhận huy hiệu phi công. Điểm đến tiếp theo: mặt trăng!")]),
            "packing": ("Chuẩn bị đồ ăn", [
                ("thinking", "Chuyến đi dài {days} ngày, mỗi ngày {meals} bữa: {packs} gói đồ ăn."),
                ("thinking", "Bình nước mới đầy 1/2, Lumi đổ thêm 1/2 nữa. Hai nửa là một bình đầy!"),
                ("happy", "Mọi thứ vừa khít. Lumi kéo khóa ba lô “tách” một tiếng vui vẻ.")]),
            "launch_window": ("Giờ phóng", [
                ("curious", "Tên lửa phóng lúc {lift}. Bây giờ là {now}, còn {wait} phút nữa."),
                ("confused", "Ăng-ten của Lumi rung rung, đèn nhấp nháy. Lumi hồi hộp… và háo hức."),
                ("celebrating", "3… 2… 1… Phóng!")]),
            "trouble": ("Sự cố ngoài không gian", [
                ("confused", "Rắc! Một tấm vỏ bị vỡ giữa đường. Đèn của Lumi mờ đi. Lumi thấy sợ và buồn."),
                ("thinking", "Rồi Lumi nhớ lại điều bạn đã dạy. Lumi đo các khe hở: {g1} cm và {g2} cm, tổng cộng {total} cm."),
                ("happy", "Vá, vá, xong! “Không có bạn, mình đã không sửa được.”")]),
            "navigation": ("Tìm đường", [
                ("thinking", "Lumi xem bản đồ: đã đi được {done} km."),
                ("thinking", "Lumi đếm cẩn thận, hai lần: còn {left} km nữa."),
                ("celebrating", "Kia rồi: mặt trăng, to và sáng ngoài cửa sổ!")]),
            "moon_engineer": ("Mặt trăng", [
                ("happy", "Lumi bước ra cạnh chiếc tên lửa do chính tay mình làm."),
                ("celebrating", "Lumi cắm lá cờ có quả chanh, đồng xu và chiếc bánh, mắt lấp lánh giọt nước mắt hạnh phúc.")]),
            "moon_musician": ("Mặt trăng", [
                ("happy", "Trên mặt trăng yên tĩnh, Lumi đặt bộ trống, Trái Đất sáng phía trên."),
                ("celebrating", "Lumi chơi bài hát bạn đã giúp mình học, mắt lấp lánh giọt nước mắt hạnh phúc.")]),
            "moon_scientist": ("Mặt trăng", [
                ("happy", "Lumi nhặt một hòn đá mặt trăng và giơ về phía Trái Đất, nơi có bạn."),
                ("celebrating", "“Hòn đá mặt trăng đầu tiên cho khu vườn của chúng mình!” Mắt Lumi lấp lánh giọt nước mắt hạnh phúc.")]),
            "moon_pilot": ("Mặt trăng", [
                ("happy", "Lumi hạ cánh nhẹ nhàng và bước ra khỏi buồng lái."),
                ("celebrating", "Lumi chào các bạn ở nhà, mắt lấp lánh giọt nước mắt hạnh phúc.")]),
        },
    },
}


# ---------- state ----------

def _taught(session: Session, c: str) -> bool:
    return session.lumi_mastery.get(c, 0.0) >= UNLOCK


def started(session: Session) -> bool:
    return sum(_taught(session, c) for c in TOWN) >= START_PLACES


def current_act(session: Session) -> int:
    """The first act without a chosen version (4 = the ending)."""
    for act in (1, 2, 3):
        if act not in session.story_chosen:
            return act
    return 4


def ending_key(session: Session) -> Optional[str]:
    path = session.story_chosen.get(2)
    return ENDINGS[path] if path and current_act(session) == 4 else None


def _act_of(key: str) -> Optional[int]:
    return next((a for a, vs in ACTS.items() if key in vs), None)


def _state(session: Session, act: int, key: str) -> str:
    pair = ACTS[act][key][0]
    both = all(_taught(session, c) for c in pair)
    if session.story_chosen.get(act) == key:
        return "chosen"
    if act in session.story_chosen:  # another version was picked: this one is a "What if…?" story
        return "what_if" if both else ("partial" if any(_taught(session, c) for c in pair) else "locked")
    if act > current_act(session):
        return "later"
    if both:
        return "available"
    return "partial" if any(_taught(session, c) for c in pair) else "locked"


def available(session: Session) -> set[str]:
    """Scenes the child can open right now that they haven't seen: what turns announce."""
    if not started(session):
        return set()
    out = {k for a in ACTS for k in ACTS[a] if _state(session, a, k) in ("available", "what_if")}
    end = ending_key(session)
    if end:
        out.add(end)
    return out - session.story_seen


# ---------- what the client gets ----------

def title_of(lang: str, key: str) -> str:
    return TEXT[lang]["scenes"][key][0]


def emoji_of(key: str) -> str:
    if key in ENDINGS.values():
        return "🌙"
    act = _act_of(key)
    return ACTS[act][key][1] if act else "✨"


def journey(session: Session, lang: str, labels: dict[str, str]) -> dict:
    t = TEXT[lang]
    if not started(session):
        return {"started": False, "say": t["need_start"], "acts": [], "current_act": 1, "ending": None}
    cur = current_act(session)
    acts = []
    for act, versions in ACTS.items():
        rows = []
        for key, (pair, emoji) in versions.items():
            st = _state(session, act, key)
            known = st in ("available", "chosen", "what_if")
            # Mystery cards reveal only the concepts already taught (a clue for what to teach next).
            rows.append({
                "key": key, "state": st, "emoji": emoji if known else "❓",
                "title": title_of(lang, key) if known else (t["idea"] if st == "partial" else t["mystery"]),
                "concepts": [c for c in pair if known or _taught(session, c)],
                "concept_labels": [labels[c] for c in pair if known or _taught(session, c)],
                "seen": key in session.story_seen,
            })
        acts.append({"act": act, "title": t["acts"][act], "chosen": session.story_chosen.get(act), "versions": rows})
    n_avail = sum(1 for r in acts[cur - 1]["versions"] if r["state"] == "available") if cur <= 3 else 0
    say = t["two_ideas"] if n_avail > 1 else t["dream"]
    end = ending_key(session)
    ending = {"key": end, "title": title_of(lang, end), "emoji": "🌙", "seen": end in session.story_seen} if end else None
    return {"started": True, "say": say, "acts": acts, "current_act": cur, "ending": ending}


def scene(session: Session, lang: str, key: str, labels: dict[str, str]) -> Optional[dict]:
    """Play a scene. Opening an available version of the current act chooses it. None = not open."""
    if not started(session):
        return None
    t = TEXT[lang]
    act = _act_of(key)
    if act is None:
        if key != ending_key(session):
            return None
        act = 4
    else:
        st = _state(session, act, key)
        if st not in ("available", "chosen", "what_if"):
            return None
        if st == "available":
            session.story_chosen[act] = key
            session.log("story_chosen", act=act, key=key)
    title, lines = t["scenes"][key]
    nums = _numbers(lang).get(key, {})
    out = [{"emotion": e, "text": s.format(**nums)} for e, s in lines]
    if act == 4:  # the ending thanks the child with their own words for each concept on the way
        path = [c for a in (1, 2, 3) for c in ACTS[a][session.story_chosen[a]][0]]
        for c in dict.fromkeys(path):
            if c in session.teach_quotes:
                out.append({"emotion": "celebrating", "text": t["thanks"].format(label=labels[c], quote=session.teach_quotes[c][1])})
    session.story_seen.add(key)
    what_if = act <= 3 and session.story_chosen.get(act) != key
    return {"key": key, "act": act, "title": title, "emoji": emoji_of(key), "lines": out, "what_if": what_if,
            "what_if_label": t["what_if"] if what_if else None}
