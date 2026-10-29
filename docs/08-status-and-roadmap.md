# 08 · Status and roadmap

## Built
- **Teach:** twelve concepts (the original four plus sharing, patterns, big numbers, time, measuring, shapes, fractions, bar graphs, with ruler / 3D shape / fraction-bar / bar-chart pictures and time and compare keypads); a concept picker (any order) with a quick-warm-up gate for the newer eight; unlock notifications; generation with verified plants, marking, outcomes, voice/chip/typed explanations with rating and guards, demo and stars, all repair paths, gate + adult bypass, demo sheet, robust state machine and recovery, report section.
- **Help:** capture (webcam, phone, upload, samples, optional Auto-snap/voice), Gemini or mock extraction, SymPy grading, circles, error steps, hint ladder with leak guard, low-confidence confirmation.
- **Town (T1–T5):** illustrated map and scenes with backend digits, teasers, scrapbook, banner, opt-in saved progress; the 31 ChatGPT illustrations are the primary visuals with SVG fallback.
- **UI:** one mascot (9 expressions, 2 poses), kid design system, en/es/vi, accessibility basics, 375 px.
- 130 tests pass; frontend builds; main flows verified in the browser (picker, warm-up, a full Time sheet, all four pictures, Spanish, 375 px).

## Not verified
Real mic with children; real Gemini rating; Help camera after the restyle and real lighting; tablets; OS reduced motion end to end; fresh checkout elsewhere; backup demo video; how long kids watch scenes.

## Next
1. **The story (approved, in progress):** three acts with 4 versions each, unlocked by pairs of concepts in any order, child choices when two qualify, mystery silhouettes, "What if…?" stories, unlock notifications, 4 moon endings ([01](01-product-vision.md)); placeholder pictures until the art is ready.
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
