import type { Language } from "./api";

/** Kid-facing UI labels. Spoken lines come from the backend (or LINES in App.tsx). */
const STRINGS = {
  en: {
    teachTab: "Teach Lumi", helpTab: "Help me", grownups: "Grown-ups", settings: "Grown-up settings",
    right: "Right", oops: "Oops", doneChecking: "Done checking!", tellLumi: "Tell Lumi",
    tapMistake: "Tap the one with the mistake!", talkWhy: "Tell Lumi why", listening: "I'm listening…",
    notSure: "I'm not sure", orTap: "or tap one:", yesGotIt: "Yes, you got it!", notQuite: "Not quite",
    youWereRight: "You were right, Lumi!", stillWrong: "Still wrong", next: "Next", moreHomework: "More homework",
    report: "Grown-up report", practice: "Practice with Lumi", tryAnyway: "Grown-up: try anyway",
    lumisHomework: "Lumi's Homework", lumisBrain: "Lumi's Brain", typeAnswer: "Type the right answer",
    markAll: "Mark every problem first", found: "Found it!", missed: "Sneaky one!", hmm: "Hmm?", ok: "OK",
    foundStats: "mistakes found", newTry: "Lumi's new try",
    cameraOn: "Turn on camera", cameraOff: "Turn off camera", checkWork: "Check my work", hint: "Hint please",
    talk: "Talk to Lumi", trySample: "Try a sample", trySampleHint: "No camera? Tap a sample page.",
    upload: "Upload photo", newSession: "New session", camera: "Camera", cameraIsOff: "Camera is off",
    putWorksheet: "Put your worksheet under the lamp, write your answers, then move your hands away. Lumi will check it!",
    status: { SLEEPING: "😴 Sleeping", WATCHING: "👀 Watching", CAPTURING: "📸 Snap!", THINKING: "🤔 Thinking", RESULT: "💬 Talking" },
    concepts: { carry: "Carrying", borrow: "Borrowing", off_by_one: "Careful counting", mul: "Times tables" },
  },
  es: {
    teachTab: "Enséñale a Lumi", helpTab: "Ayúdame", grownups: "Adultos", settings: "Ajustes para adultos",
    right: "Bien", oops: "Uy", doneChecking: "¡Ya revisé!", tellLumi: "Díselo a Lumi",
    tapMistake: "¡Toca el que tiene el error!", talkWhy: "Dile a Lumi por qué", listening: "Te escucho…",
    notSure: "No estoy seguro", orTap: "o toca una:", yesGotIt: "¡Sí, lo lograste!", notQuite: "No del todo",
    youWereRight: "¡Tenías razón, Lumi!", stillWrong: "Sigue mal", next: "Siguiente", moreHomework: "Más tarea",
    report: "Informe para adultos", practice: "Practicar con Lumi", tryAnyway: "Adulto: probar igual",
    lumisHomework: "La tarea de Lumi", lumisBrain: "El cerebro de Lumi", typeAnswer: "Escribe la respuesta correcta",
    markAll: "Marca todos los problemas primero", found: "¡Lo encontraste!", missed: "¡Qué escondido!", hmm: "¿Mmm?", ok: "Bien",
    foundStats: "errores encontrados", newTry: "Lumi lo intenta otra vez",
    cameraOn: "Encender cámara", cameraOff: "Apagar cámara", checkWork: "Revisa mi trabajo", hint: "Una pista",
    talk: "Hablar con Lumi", trySample: "Probar un ejemplo", trySampleHint: "¿Sin cámara? Toca una hoja de ejemplo.",
    upload: "Subir foto", newSession: "Nueva sesión", camera: "Cámara", cameraIsOff: "La cámara está apagada",
    putWorksheet: "Pon tu hoja bajo la lámpara, escribe tus respuestas y luego quita las manos. ¡Lumi la revisará!",
    status: { SLEEPING: "😴 Durmiendo", WATCHING: "👀 Mirando", CAPTURING: "📸 ¡Foto!", THINKING: "🤔 Pensando", RESULT: "💬 Hablando" },
    concepts: { carry: "Llevar", borrow: "Pedir prestado", off_by_one: "Contar con cuidado", mul: "Tablas" },
  },
  vi: {
    teachTab: "Dạy Lumi", helpTab: "Giúp mình", grownups: "Người lớn", settings: "Cài đặt cho người lớn",
    right: "Đúng", oops: "Sai", doneChecking: "Kiểm tra xong!", tellLumi: "Nói với Lumi",
    tapMistake: "Chạm vào bài bị sai!", talkWhy: "Nói cho Lumi biết tại sao", listening: "Mình đang nghe…",
    notSure: "Mình không chắc", orTap: "hoặc chạm một ý:", yesGotIt: "Đúng rồi, bạn làm được!", notQuite: "Chưa đúng lắm",
    youWereRight: "Lumi làm đúng!", stillWrong: "Vẫn sai", next: "Tiếp", moreHomework: "Thêm bài tập",
    report: "Báo cáo cho người lớn", practice: "Luyện tập với Lumi", tryAnyway: "Người lớn: cứ thử",
    lumisHomework: "Bài tập của Lumi", lumisBrain: "Bộ não của Lumi", typeAnswer: "Gõ đáp án đúng",
    markAll: "Đánh dấu hết các bài trước nhé", found: "Tìm ra rồi!", missed: "Khó thấy ghê!", hmm: "Ừm?", ok: "Đúng",
    foundStats: "lỗi đã tìm ra", newTry: "Lumi thử lại",
    cameraOn: "Bật camera", cameraOff: "Tắt camera", checkWork: "Chấm bài giúp mình", hint: "Gợi ý",
    talk: "Nói với Lumi", trySample: "Thử bài mẫu", trySampleHint: "Không có camera? Chạm vào bài mẫu.",
    upload: "Tải ảnh lên", newSession: "Phiên mới", camera: "Camera", cameraIsOff: "Camera đang tắt",
    putWorksheet: "Đặt bài tập dưới đèn, viết đáp án, rồi bỏ tay ra. Lumi sẽ kiểm tra!",
    status: { SLEEPING: "😴 Đang ngủ", WATCHING: "👀 Đang nhìn", CAPTURING: "📸 Chụp!", THINKING: "🤔 Đang nghĩ", RESULT: "💬 Đang nói" },
    concepts: { carry: "Nhớ sang hàng chục", borrow: "Mượn ở hàng chục", off_by_one: "Đếm cẩn thận", mul: "Bảng cửu chương" },
  },
} satisfies Record<Language, unknown>;

export type Strings = (typeof STRINGS)["en"];
export const t = (lang: Language): Strings => STRINGS[lang];

export const CONCEPT_EMOJI: Record<string, string> = { carry: "➕", borrow: "➖", off_by_one: "🔢", mul: "✖️" };
export const TEACHABLE = ["carry", "borrow", "off_by_one", "mul"] as const;

/** "52 - 17" → "52 − 17", "6 * 7" → "6 × 7" for display. */
export const pretty = (p: string) => p.replace(/\*/g, "×").replace(/\//g, "÷").replace(/ - /g, " − ");
