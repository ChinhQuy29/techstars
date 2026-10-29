# 08 · Status and roadmap

## Built
- **Teach:** generation with verified plants, marking, outcomes, voice/chip/typed explanations with rating and guards, demo and stars, all repair paths, gate + adult bypass, demo sheet, robust state machine and recovery, report section.
- **Help:** capture (webcam, phone, upload, samples, optional Auto-snap/voice), Gemini or mock extraction, SymPy grading, circles, error steps, hint ladder with leak guard, low-confidence confirmation.
- **Town (T1–T5):** illustrated map and scenes with backend digits, teasers, scrapbook, banner, opt-in saved progress; the 31 ChatGPT illustrations are the primary visuals with SVG fallback.
- **UI:** one mascot (9 expressions, 2 poses), kid design system, en/es/vi, accessibility basics, 375 px.
- 86 tests pass; frontend builds; main flows verified in the browser.

## Not verified
Real mic with children; real Gemini rating; Help camera after the restyle and real lighting; tablets; OS reduced motion end to end; fresh checkout elsewhere; backup demo video; how long kids watch scenes.

## Next
1. **Startup Weekend readiness** (Nov 13–15, 2026): fresh-checkout run, backup video, rehearsal.
2. **Parent interviews** and a concrete pilot offer.
3. **Exact-mistake targeting** from Help `diagnose()` results (never claim it before it's built).
4. **T6 refreshers**, then **T7 chapters**.
5. **HRI lab pilot** (Help vs. Teach; town vs. stars-only).
6. **Deferred:** printable Lumi worksheet with camera reading of paper ✓/✗ marks.
7. **Vision (approval needed):** the moon-journey story and older learners ([01](01-product-vision.md)).

## Out of scope
Hardware of any kind (the parked ESP32 sketch in `deferred/` is unused); chatbot or "teach anything"; fractions, Teach division, word problems, algebra; adaptive TTS voice, demo "slips"; accounts, LMS, teacher dashboards; social features, leaderboards, ads, purchases, loot; AI memory beyond the whitelist; the moon story and other ages/subjects until approved.

## Known limits
In-memory sessions (single backend instance); one profile per browser; readiness per concept, not exact mistake; speech varies with young voices (chips and typing cover it); historical names remain in the folder (`HomeworkChecker`) and Render service (`homework-lamp-api`).
