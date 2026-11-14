# 08 · Status and roadmap

## Built
- **Teach:** twelve concepts (the original four plus sharing, patterns, big numbers, time, measuring, shapes, fractions, bar graphs, with ruler / 3D shape / fraction-bar / bar-chart pictures and time and compare keypads); a concept picker (any order) with a quick-warm-up gate for the newer eight; unlock notifications; generation with verified plants, marking, outcomes, voice/chip/typed explanations with rating and guards, demo and stars, all repair paths, gate + adult bypass, demo sheet, robust state machine and recovery, report section.
- **Help:** capture (webcam, phone, upload, samples, optional Auto-snap/voice), Gemini or mock extraction, SymPy grading, circles, error steps, hint ladder with leak guard, low-confidence confirmation.
- **Town (T1–T5):** illustrated map and scenes with backend digits, teasers, scrapbook, banner, opt-in saved progress; the 31 ChatGPT illustrations are the primary visuals with SVG fallback.
- **Lumi's Journey:** three acts × four versions unlocked by concept pairs in any order, choices, mystery clues, "What if…?" stories, four moon endings with the child's quotes, story notifications, saved choices; placeholder pictures.
- **UI:** one mascot (9 expressions, 2 poses), kid design system, en/es/vi, accessibility basics, 375 px.
- **Admin portal** (`/?admin=1`, dev only): presets, per-skill stars/readiness/quotes, story choices, problem and scene previews, deep links into the app.
- **Android app** (Capacitor, debug APK): the whole app on a phone, back camera in Help, Lumi's voice through the phone's text-to-speech, server address in Grown-up settings, Android back button, Lumi icon and opening screen. Tested on the emulator and the owner's Galaxy Z Flip5 ([09](09-android-app.md)); no voice input yet.
- 153 tests pass; frontend builds; main flows verified in the browser (picker, warm-up, a full Time sheet, all four pictures, Spanish, 375 px).

## Not verified
Real mic with children; real Gemini rating; Help camera after the restyle and real lighting; tablets; OS reduced motion end to end; fresh checkout elsewhere; backup demo video; how long kids watch scenes.

## Next
0. **Android demo:** deploy the backend (mock mode) to Render and point the app at it ([09](09-android-app.md) stage 6).
1. **Story art:** 16 scene pictures (`docs/assets/story/story_<key>.png`), then rerun `scripts/town_art.py`.
2. **Startup Weekend readiness** (Nov 13–15, 2026): fresh-checkout run, backup video, rehearsal.
3. **Parent interviews** and a concrete pilot offer.
4. **Exact-mistake targeting** from Help `diagnose()` results (never claim it before it's built).
5. **T6 refreshers**, then **T7 chapters**.
6. **HRI lab pilot** (Help vs. Teach; town vs. stars-only).
7. **Deferred:** printable Lumi worksheet with camera reading of paper ✓/✗ marks.
8. **Vision (approval needed):** older learners and other subjects ([01](01-product-vision.md)).

## Out of scope
Hardware of any kind (the parked ESP32 sketch in `deferred/` is unused); chatbot or "teach anything"; word problems, algebra; adaptive TTS voice, demo "slips"; accounts, LMS, teacher dashboards; social features, leaderboards, ads, purchases, loot; AI memory beyond the whitelist; other ages/subjects until approved.

## Known limits
In-memory sessions (single backend instance); one profile per browser; readiness per concept, not exact mistake; speech varies with young voices (chips and typing cover it); historical names remain in the folder (`HomeworkChecker`) and Render service (`homework-lamp-api`).
