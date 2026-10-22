# Homework Lamp 🪔

An overhead "lamp" camera watches a child's arithmetic worksheet. When the child's hands leave the frame, the app captures the page, grades it, and circles the mistakes. **Lumi**, an animated robot face, then gives Socratic hints instead of the answers.

Full spec: [`homework-lamp-context.md`](homework-lamp-context.md). Build log: [`memory/MEMORY.md`](memory/MEMORY.md).

## Quick start

```bash
# Backend (Python 3.11+)
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # macOS/Linux: .venv/bin/pip
cp .env.example .env                               # add GEMINI_API_KEY (optional)
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# Frontend (Node 20+)
cd frontend
npm install
npm run dev                                        # http://localhost:5173
```

**No API key? It still works.** Without `GEMINI_API_KEY`, the backend runs in **mock mode**: the sample photos in `test-worksheets/` return their recorded extraction, and the tutor uses built-in hint templates (English, Spanish, Vietnamese). SymPy does the grading either way.

### Teach Lumi mode (the roles flip)
Lumi shows **its own** homework with deliberate mistakes; the child marks ✓/✗, fixes them on a kid keypad, and explains why (voice or tap). Lumi then solves a new one "like you taught me" and earns stars in *Lumi's Brain*. Spec: [`teach-lumi-spec.md`](teach-lumi-spec.md).
1. In **🙋 Help me**, grade `worksheet-1` then `worksheet-2`. This unlocks *carrying*. (Or open **🧑‍🏫 Teach Lumi** and tap "Grown-up: try anyway".)
2. **🧑‍🏫 Teach Lumi** → mark each row → **Done checking!** → explain → 👍 → stars + confetti → **Next ➜** … → 🏆.
3. **👪 Grown-ups** shows the "Your child taught Lumi" section.

Teach mode needs no Gemini calls except for rating *spoken* explanations. Chips and everything else use templates and SymPy.

### Demo script (mock mode, no camera needed)
1. Click **📄 worksheet-1**. Problems #2 and #4 get circled, and Lumi gives a level-1 hint.
2. Click **💡 Hint please** a few times. The hint ladder goes reflect → strategy → worked step → reveal plus a practice problem.
3. Click **📄 worksheet-2** (the fixed page). Lumi celebrates with confetti.
4. Click **Parent report** to see the score, concepts to practice, and 3 practice problems.

With a webcam: **Start camera** → write on a worksheet → move your hands away → after about 1.5 s of stillness, Lumi checks the page automatically. Fallback triggers are the **✅ Check my work** button and saying "check my work" with the voice trigger on.

## Architecture

```
Browser (React + Vite + TS + Tailwind)
  camera/   getUserMedia | phone/ESP32 frames over Socket.IO
            MediaPipe HandLandmarker + canvas pixel-diff → capture trigger
  robot/    SVG face (Framer Motion), Web Speech TTS/STT, WebAudio sfx, canvas-confetti
  views/    TutorView (face + still with mistake circles), PhoneCamera (QR), ParentReport
      │ POST /api/grade (one high-res still)   POST /api/tutor   POST /api/report
      ▼
Backend (FastAPI + python-socketio)
  vision.py      Gemini (google-genai): extracts problems/answers/bboxes. Never does math.
  math_check.py  SymPy decides correctness. Rule-based diagnosis (carry/borrow) + practice problems.
  tutor.py       Hint ladder 1-4. Server owns hint_level; reveal only at level 4; answer-leak guard.
  session.py     In-memory session state + event log for the report.
  realtime.py    Socket.IO relay: phone/ESP32 → screen.
```

Key rules from the spec, as implemented:
- **The LLM never does the math.** `correct_answer` and `is_correct` always come from SymPy.
- **The backend gates reveals.** `hint_level` lives in the server session. Below level 4, any LLM reply that contains the answer is replaced by a safe template.
- **Low confidence → ask.** An answer read with confidence < 0.6 is flagged `needs_confirmation`, and Lumi asks instead of grading it.
- **No sad face.** The emotions are sleeping, idle, listening, thinking, happy, celebrating, encouraging, curious, confused.

## Phone as camera
`getUserMedia` needs HTTPS on phones. Expose the Vite dev server through a tunnel (it already proxies `/api` and `/socket.io`):
```bash
ngrok http 5173            # or: cloudflared tunnel --url http://localhost:5173
```
Open the tunnel URL on the laptop, choose **Phone / ESP32 lamp**, then scan the QR code with the phone.

## ESP32 lamp (stretch)
`firmware/lamp.ino` targets the XIAO ESP32S3 Sense with a WS2812 ring. It serves `/stream`, `/capture`, and `/led?state=`, and can **push** frames to `POST /api/frame/<session>` to avoid HTTPS mixed-content issues. Set `LAMP_URL` in `backend/.env` for LED control and high-res pulls.

## Tools
- **Tests:** `cd backend && .venv/Scripts/python -m pytest` (42 tests: SymPy grading, the Help-mode demo flow, and Teach mode in `tests/test_teach.py`).
- **API testing:** open the `bruno/` folder in Bruno. It uses the sample worksheet photos.
- **Regenerate sample worksheets:** `python scripts/make_worksheets.py`
- **Deploy:** frontend → Vercel (`frontend/vercel.json`, set `VITE_BACKEND_URL`); backend → Render (`render.yaml`) or Railway.
- **CI:** `.github/workflows/ci.yml` runs the backend tests and the frontend build.
