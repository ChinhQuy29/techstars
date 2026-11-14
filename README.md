# Lumi 🤖 a robot learning companion

**Lumi** is a friendly little robot who is learning math, and the child (ages 6–10) is its teacher.

- **🧑‍🏫 Teach Lumi:** Lumi brings its own homework with deliberate mistakes. The child finds them, fixes them and explains why; Lumi then solves a new problem "like you taught me" and earns stars in *Lumi's Brain*.
- **🙋 Help me:** the child photographs their own worksheet (webcam, phone or upload). SymPy grades it, mistakes are circled, and Lumi gives Socratic hints instead of answers. This also tells Teach mode which concepts the child is ready to teach.
- **🏘️ Lumi's Town:** each skill the child teaches opens a place where Lumi uses exactly that math (a lemonade stand for carrying, a bakery for times tables), plus a scrapbook of the child's own explanations.
- **🌙 Lumi's Journey:** the concepts the child teaches, in any order, decide how Lumi gets to the moon: 64 possible storylines, with choices, mystery clues and four endings.

Software only. The AI never does the math: Gemini reads handwriting and rates explanations; SymPy decides every answer. With no API key the whole app runs in a deterministic mock mode.

**Full documentation: [`docs/`](docs/README.md)** (vision, learning design, town, UI, architecture and API, privacy, testing, roadmap). **Coding agents: start with [`AGENTS.md`](AGENTS.md).**

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

**No API key? It still works.** Without `GEMINI_API_KEY`, or with `MOCK_MODE=1` in `backend/.env`, the backend runs in mock mode (check under 🔧 Grown-up settings or at `/api/health`): the sample photos in `test-worksheets/` return their recorded extraction, and Lumi uses built-in templates in English, Spanish and Vietnamese.

## Try it

1. **For a pitch or rehearsal:** 🔧 Grown-up settings → **🎬 Demo worksheet** (the same five problems every time; 47 + 38 = 75 and 52 − 17 = 45 are wrong). Script: [`docs/07-testing-and-demo.md`](docs/07-testing-and-demo.md).
   **Otherwise:** in **🙋 Help me**, grade `worksheet-1` then `worksheet-2` to unlock carrying (or **hold** "🔒 Grown-up: try anyway" in Teach Lumi).
2. **🧑‍🏫 Teach Lumi** → mark each row → **Done checking!** → explain (talk, tap a card, or type) → 👍 → stars + confetti → **Next ➜** … → 🏆.
3. **🏘️ Lumi's Town** opens a place once Lumi has a full star in a skill.
4. **👪 Grown-ups** shows the report, including "Your child taught Lumi".

**Saved progress is opt-in:** 🔧 Grown-up settings → **💾 Save Lumi's progress on this device?** (hold to agree). Stored in `backend/data/lumi.db` (gitignored; `LUMI_DB` moves it). Read [`docs/06-privacy-and-safety.md`](docs/06-privacy-and-safety.md) before testing with a real child.

## Tools

- **Tests:** `cd backend && .venv/Scripts/python -m pytest` (153 tests). Frontend check: `cd frontend && npm run build`.
- **Mascot gallery:** `http://localhost:5173/?mascot=gallery`.
- **Admin portal (dev only):** start the backend with `LUMI_ADMIN=1`, open `http://localhost:5173/?admin=1` to jump to any test state (stars, skills ready, story acts, endings) and preview any problem or scene.
- **Phone camera:** tunnel the Vite server (`ngrok http 5173` or `cloudflared tunnel --url http://localhost:5173`), choose Phone camera in Grown-up settings, scan the QR.
- **API testing:** open `bruno/` in Bruno. **Sample worksheets:** `python scripts/make_worksheets.py`.
- **Android app:** `cd frontend && npm run android:build`, then build the APK in `frontend/android` (steps, test results and the server setting: [`docs/09-android-app.md`](docs/09-android-app.md)).
- **Deploy:** frontend → Vercel (`frontend/vercel.json`, set `VITE_BACKEND_URL`); backend → Render (`render.yaml`) or Railway. **CI:** `.github/workflows/ci.yml`.
