# Homework Lamp — Project Context

> Context file for AI assistants working on this project. Read this before writing code or giving advice.

## What this project is

A hackathon project: a lamp-style overhead camera watches a child's **elementary math worksheet** (printed or handwritten questions, handwritten answers). When the child moves their hands out of the frame, a **website** captures the page, grades it, circles mistakes on the captured image, and an **animated robot face** speaks to the child, giving Socratic hints instead of handing over answers.

The app has **two modes**, chosen with big tabs at the top:
- **🙋 Help me** (the original flow above): Lumi tutors the child on the child's own worksheet.
- **🧑‍🏫 Teach Lumi**: the roles flip. Lumi shows *its own* homework with deliberate mistakes; the child marks them, fixes them, and explains why, and Lumi visibly learns ("Lumi's Brain" stars). It is based on learning-by-teaching research (the protégé effect). **Full spec: [`teach-lumi-spec.md`](teach-lumi-spec.md)**, the source of truth for that mode.

- **Context:** hackathon build (weekend timeline), not a research project. Priorities: a reliable live demo, a clear story, polish.
- **MVP scope:** elementary arithmetic (+, −, ×, ÷ on whole numbers). Word problems and fractions are stretch goals.
- **Target users:** elementary school children; parents/teachers get a session summary.

## Core design principles

1. **The LLM never does the math.** The vision LLM only *extracts* problems, answers, work, and bounding boxes. **SymPy** computes correct answers and decides `is_correct`.
2. **The backend gates answer reveals.** The tutor LLM never decides on its own to reveal an answer; the backend unlocks it only at hint level 4.
3. **The LLM is called only on capture.** Live preview + hand detection run in the browser at no cost; one high-res still is sent per grading.
4. **Low confidence → ask, don't guess.** If OCR confidence is low, the robot asks the child ("Is that a 7 or a 1?").
5. **No negative emotions on wrong answers.** Use encouraging/curious, not sad. Praise effort and strategy, not "being smart." Don't overpraise.
6. **Always demoable.** Build in milestone order so every step produces a working demo.
7. **Kid-first UI.** Bright, warm, big touch targets (≥56 px), an emoji plus 1–3 words per button, short localized labels (`src/i18n.ts`). Grown-up and debug controls live in a collapsed "🔧 Grown-up settings" panel, never in the child's way.
8. **Teach mode never reinforces a misconception.** Lumi never affirms a wrong fix or a wrong explanation (code guard), and its mistakes are only the planted, `diagnose()`-verified ones. See `teach-lumi-spec.md` §4.

## Data flow

```
Camera (webcam / phone / ESP32 lamp)
  → low-res preview stream to browser
Browser
  → MediaPipe hand detection + stillness check
  → trigger when: no hands AND still ~1.5 s AND page changed since last grade
  → capture high-res still → POST /grade
Backend /grade
  → vision LLM extracts problems, child answers, work, bounding boxes, confidence
  → SymPy computes correct answers
  → if wrong + work visible: 2nd LLM call (given correct answer) finds the error step + its bbox
Backend /tutor
  → LLM gets grading results + attempts + hint_level → returns {emotion, say}
Browser
  → face animates, TTS speaks, mistake circles drawn on the captured still,
    confetti on correct, events logged for the parent report
  → back to watching
```

Fallback triggers: a "check my work" button and a voice phrase.

## Tech stack

### Frontend — React + Vite + TypeScript
| Need | Tool |
|---|---|
| Styling | Tailwind CSS (bright kid theme; fonts: Baloo 2 for UI, Patrick Hand for Lumi's handwriting, via Google Fonts) |
| Camera | `getUserMedia` (webcam), or frames over WebSocket (phone / ESP32) |
| Hand detection | `@mediapipe/tasks-vision` (HandLandmarker) |
| Stillness / page-changed check | Canvas pixel diff on a small grayscale frame |
| Robot face + idle animations | SVG + Framer Motion (or Rive) |
| Mistake highlights | `<canvas>` overlay on the captured still (not the live feed) |
| Speech out / in | Web Speech API: `speechSynthesis`, `SpeechRecognition` (Chrome) |
| Celebration | `canvas-confetti` + sound effects |
| Phone-as-camera QR | `qrcode.react` |
| Realtime | Socket.IO client |

### Backend — Python + FastAPI
| Need | Tool |
|---|---|
| API server | FastAPI + Uvicorn |
| Frame relay (phone/ESP32 → screen) | `python-socketio` |
| Vision + tutoring LLM | Gemini API via `google-genai` SDK (good bounding boxes, structured JSON output). Claude / GPT-4o-class are alternatives. |
| Schemas | Pydantic, used as the structured-output schema |
| Math checking | SymPy |
| Session state | In-memory dict (SQLite if persistence is needed) |

### Hardware (stretch goal)
- Seeed XIAO ESP32S3 Sense (OV5640 camera module preferred over stock OV2640 for handwriting)
- WS2812 / NeoPixel LED ring: lamp lighting + status colors (pulse = thinking, green = correct)
- Arduino IDE or PlatformIO, `esp32-camera`, `Adafruit_NeoPixel`
- Camera fixed ~30–40 cm above the desk
- ESP32 role: Wi-Fi camera + LED control only. **No on-device OCR** (not feasible on ESP32-class hardware).
- Firmware endpoints: `/stream` (low-res MJPEG), `/capture` (high-res JPEG), `/led?state=...`

### Tools
- GitHub (single repo), ngrok or Cloudflare Tunnel (HTTPS for phone camera), Bruno/Postman (API testing with saved worksheet photos)
- Deploy: Vercel (frontend), Render or Railway (backend)

## Repo structure

```
homework-lamp/
├── frontend/
│   └── src/
│       ├── App.tsx                  # main state machine, mode tabs, grown-up panel
│       ├── i18n.ts                  # kid-facing UI labels (en/es/vi)
│       ├── camera/
│       │   ├── useWebcam.ts         # getUserMedia source
│       │   ├── useRemoteCamera.ts   # phone/ESP32 frames via socket
│       │   ├── useHandDetector.ts   # MediaPipe wrapper
│       │   └── useCaptureTrigger.ts # hands-out + still + changed logic
│       ├── robot/
│       │   ├── Face.tsx             # SVG face, emotion → expression
│       │   ├── emotions.ts          # emotion definitions + idle behaviors
│       │   └── useSpeech.ts         # TTS / STT + language voice
│       ├── views/
│       │   ├── TutorView.tsx        # Help mode: face + still with mistake overlay
│       │   ├── TeachView.tsx        # Teach mode: face, Lumi's Brain, notebook, step actions
│       │   ├── PhoneCamera.tsx      # page the phone opens via QR
│       │   └── ParentReport.tsx     # session summary
│       ├── components/
│       │   ├── MistakeOverlay.tsx
│       │   ├── LumiHomework.tsx     # Teach: notebook page with ✓/✗ rows
│       │   ├── LumiBrain.tsx        # Teach: per-concept stars
│       │   ├── KidKeypad.tsx        # Teach: big 0-9 keypad
│       │   └── ExplainChips.tsx     # Teach: tappable explanations
│       └── api.ts
├── backend/
│   └── app/
│       ├── main.py                  # FastAPI + socket.io setup
│       ├── routes/
│       │   ├── grade.py             # POST /grade
│       │   ├── tutor.py             # POST /tutor
│       │   ├── report.py            # POST /report (+ teach section)
│       │   └── teach.py             # POST /teach/worksheet, POST /teach/turn
│       ├── services/
│       │   ├── vision.py            # LLM extraction + bounding boxes
│       │   ├── math_check.py        # SymPy grading
│       │   ├── tutor.py             # Socratic hint logic + prompts
│       │   ├── teach.py             # Teach mode: worksheet gen, outcomes, turn state machine
│       │   └── session.py           # per-problem state, event log
│       ├── schemas.py               # Pydantic models
│       └── prompts/                 # prompt text files
├── firmware/
│   └── lamp.ino                     # ESP32 lamp (stretch)
└── test-worksheets/                 # sample photos for testing + demo
```

## Frontend state machine

```
SLEEPING --hand appears--> WATCHING
WATCHING --no hands + still 1.5s + page changed--> CAPTURING
CAPTURING --> THINKING --> RESULT (happy | celebrating | encouraging | curious | confused)
RESULT --> WATCHING
any state --~60s no activity--> SLEEPING
```

Teach mode has its own server-driven flow. The client renders whatever `turn.step` the backend returns (`practice_first | mark | fix | help | find | explain | demo | sure | next | done`). See `teach-lumi-spec.md` §3 and §7.3. The camera loop is idle in Teach mode until milestone M5 (paper marks).

**Emotions:** `sleeping`, `idle` (blinking, looking around), `listening`, `thinking`, `happy`, `celebrating`, `encouraging`, `curious`, `confused` ("I can't read that"). No `sad`.

## API contracts

### `POST /grade`
Input: captured image (+ session id). Output:

```json
{
  "hand_blocking": false,
  "unreadable": false,
  "problems": [
    {
      "id": 3,
      "problem": "47 + 38",
      "child_answer": "75",
      "correct_answer": "85",
      "is_correct": false,
      "bbox": [120, 80, 180, 400],
      "error_step": "forgot to carry the 1 from the ones column",
      "error_bbox": [150, 300, 175, 340],
      "confidence": 0.92
    }
  ]
}
```

- LLM fills: `problem` (normalized expression), `child_answer`, `bbox`, `confidence`, page flags.
- SymPy fills: `correct_answer`, `is_correct`.
- `error_step` / `error_bbox`: only for wrong answers with visible work, from a second LLM call given the correct answer.
- Bounding boxes use Gemini format `[ymin, xmin, ymax, xmax]` scaled 0–1000; convert to pixels on the frontend.
- `hand_blocking: true` → robot says "Move your hand so I can see!" and skips grading.

### `POST /tutor`
Input: problem result, `attempts`, `hint_level`, `language`, short conversation history.
Output: `{ "emotion": "<emotion>", "say": "<text to speak>" }`

Hint ladder (backend advances `hint_level`; only level 4 may reveal the answer):
1. Reflect — "Can you read the question again?"
2. Strategy — "Try counting up from the bigger number."
3. A worked step
4. Answer with explanation, then a similar practice problem

Tutor prompt rules: child-appropriate language, short sentences, never reveal the answer below level 4, never contradict the provided grading result.

### `POST /teach/worksheet`, `POST /teach/turn`
Teach mode. Exact contracts are in `teach-lumi-spec.md` §7.2. All routes are under `/api`, like the others.

### `POST /report`
Input: session event log (graded, hint given, fixed), `language`.
Output: score, concepts the child struggled with (e.g., "carrying in addition"), 3 practice problems, and (when Teach mode was used) a `teach` section: concepts taught with stars, the child's own explanations, and caught/missed/false-alarm counts.

## Features (priority order)

1. Grading with SymPy + results display
2. Animated face + emotions + TTS
3. Mistake circles drawn on the captured page
4. Automatic hands-out capture trigger
5. Socratic hint ladder + voice input
6. Step-level error feedback ("you forgot to carry the 1 here")
7. Parent/teacher report + multilingual explanations (language selector sets LLM output + TTS voice)
8. Phone as camera via QR code
9. ESP32 lamp + LED ring
10. Polish: named robot personality, idle animations, confetti, sounds
11. **Teach Lumi mode** (`teach-lumi-spec.md` §10): M1–M4 + M6 built (screen marking, explanations, demo, stars, repair paths, report). Next: M5 (paper marks via camera), then M7 (persistence, spaced review).

## Known gotchas

- `getUserMedia` requires HTTPS (except `localhost`) → use a tunnel for the phone.
- An HTTPS site can't load the ESP32's `http://` stream (mixed content) → run the frontend locally for the demo, or have the ESP32 push frames to the backend over WebSocket.
- Word problems don't map to SymPy directly → out of MVP scope.
- Lighting/glare is the biggest OCR failure → test with real worksheets under bad light; LED ring helps.
- Latency → show `thinking` immediately; stream speech where possible.
- Keep a webcam fallback and a recorded backup demo video.

## Demo script

**Help me:** Child answers one problem correctly → happy face + praise → answers one wrong → mistake circled on paper + hint → child fixes it → celebration → show parent report. Judges should be able to try it with a worksheet and pencil.

**Teach Lumi:** after Help mode unlocks carrying (or "Grown-up: try anyway"), Lumi shows its homework → the child taps ✗ on 47 + 38 = 75 and types 85 → explains "you forgot to carry" → Lumi asks why, then solves a new one "like you taught me" → stars pop. Full script: `teach-lumi-spec.md` §13.

## Pitch notes

- Problem: parents often can't help with homework (time, language barriers); tutoring is expensive.
- Expected judge question: "Isn't this helping kids cheat?" → Answer: Socratic mode by default; answers only after several attempts, followed by practice problems; parent report keeps adults informed.
- Differentiator: **Teach Lumi** flips the usual AI-tutor role. Answer apps are built for students who want answers; Lumi is built for parents who want learning, and in Teach mode there is no answer to beg for.
