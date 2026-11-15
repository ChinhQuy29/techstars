# 08 · Status and roadmap

## Built
- **Teach:** twelve concepts (the original four plus sharing, patterns, big numbers, time, measuring, shapes, fractions, bar graphs, with ruler / 3D shape / fraction-bar / bar-chart pictures and time and compare keypads); a concept picker (any order) with a quick-warm-up gate for the newer eight; unlock notifications; generation with verified plants, marking, outcomes, voice/chip/typed explanations with rating and guards, demo and stars, all repair paths, gate + adult bypass, demo sheet, robust state machine and recovery, report section.
- **Help:** capture (webcam, phone, upload, samples, optional Auto-snap/voice), Gemini or mock extraction, SymPy grading, circles, error steps, hint ladder with leak guard, low-confidence confirmation.
- **Town (T1–T5):** illustrated map and scenes with backend digits, teasers, scrapbook, banner, opt-in saved progress; the 31 ChatGPT illustrations are the primary visuals with SVG fallback.
- **Lumi's Journey:** three acts × four versions unlocked by concept pairs in any order, choices, mystery clues, "What if…?" stories, four moon endings with the child's quotes, story notifications, saved choices; placeholder pictures.
- **UI:** one mascot (9 expressions, 2 poses), kid design system, en/es/vi, accessibility basics, 375 px.
- **Phone layout** ([10](10-mobile-ui.md)): bottom tab bar, Lumi's Brain Home (free choice of skill), one-problem-at-a-time lessons with notebook step tabs, pointing-hand hints and short Lumi lines, a one-step-at-a-time Help, Grown-ups sheet. Checked in the browser at 360 px and on the emulator; not yet on the owner's phone.
- **Lumi's dream** ([12](12-dreams.md)): "Choose Lumi's dream" screen before the first lesson; the astronaut dream adds a space story to every Teach problem (all 12 concepts, en/es/vi) without changing the math. Doctor and baker next.
- **Admin portal** (`/?admin=1`, dev only): presets, per-skill stars/readiness/quotes, story choices, problem and scene previews, deep links into the app.
- **Android app** (Capacitor, debug APK): the whole app on a phone, back camera in Help, Lumi's voice through the phone's text-to-speech, server address in Grown-up settings, Android back button, Lumi icon and opening screen. Tested on the emulator and the owner's Galaxy Z Flip5 ([09](09-android-app.md)). Voice explanations in Teach through the phone's speech recognizer (big 🎤 button); real speech not yet tested.
- 218 backend tests pass; frontend builds; main flows verified in the browser (picker, warm-up, a full Time sheet, all four pictures, Spanish, 375 px).

## Not verified
Real mic with children; real Gemini rating; Help camera after the restyle and real lighting; tablets; OS reduced motion end to end; fresh checkout elsewhere; backup demo video; how long kids watch scenes.

## Next
- **Security before real families:** sign-in or app key, rate limits, CORS limited to the app, a release-signed Android build, privacy policy and consent review (COPPA). Done: unguessable session ids, phone-camera relay off by default ([06](06-privacy-and-safety.md)).
0. **Android demo:** works on the owner's phone over mobile data with the Render backend; rehearse it and record a backup video ([09](09-android-app.md)).
1. **Story art:** 16 scene pictures (`docs/assets/story/story_<key>.png`), then rerun `scripts/town_art.py`.
2. **Startup Weekend readiness** (Nov 13–15, 2026): fresh-checkout run, backup video, rehearsal.
3. **Parent interviews** and a concrete pilot offer.
4. **Exact-mistake targeting** from Help `diagnose()` results (never claim it before it's built).
5. **T6 refreshers**, then **T7 chapters**.
6. **HRI lab pilot** (Help vs. Teach; town vs. stars-only).
7. **Deferred:** printable Lumi worksheet with camera reading of paper ✓/✗ marks.
8. **Science pilot (proposal, approval needed):** one "Float or sink" lesson for ages 5–8 behind a grown-up setting ([11](11-science-pilot.md)).
9. **Vision (approval needed):** older learners and other subjects ([01](01-product-vision.md)).

## Out of scope
Hardware of any kind (the parked ESP32 sketch in `deferred/` is unused); chatbot or "teach anything"; word problems, algebra; adaptive TTS voice, demo "slips"; accounts, LMS, teacher dashboards; social features, leaderboards, ads, purchases, loot; AI memory beyond the whitelist; other ages/subjects until approved.

## Known limits
In-memory sessions (single backend instance); one profile per browser; readiness per concept, not exact mistake; speech varies with young voices (chips and typing cover it); historical names remain in the folder (`HomeworkChecker`) and Render service (`homework-lamp-api`).
