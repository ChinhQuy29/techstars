# 07 · Testing and demo

## Automated (130 tests, mock mode, offline)
- **math_check:** check, blanks, non-arithmetic rejected, diagnose, practice problems.
- **api:** Help demo flow (grade → hints 1–4 → fixed → report), samples, quota keeps the previous grade.
- **teach (43):** generation per concept matches `diagnose()`; contract over 60 seeds; gate, force, Help evidence; perfect-teacher flow; one why-follow-up; chips; two incorrect → role switch, no stars; wrong fix → hint ladder; find nudges; false alarm; stale 409, out-of-order and duplicate actions; restart; 503; mastered exclusion and review; canonical demo with a single ½ star; demo sheet fixed; no leaked plants or transcripts; MOCK_MODE overrides key; affirmation guard; sanitizer; rule classifier; template keys aligned; full es/vi flows; demo-step arithmetic.
- **concepts (44):** every newer concept × language over 80 seeds: one right answer, a `diagnose()`-recognized planted mistake, no unfilled text; answers recomputed independently; keypad formats (`7:15`/`715`, `80,000`/`80.000`, `<`); texts and keywords in every language; the picker lists all twelve with their gates; warm-up pass/fail, no answers sent, stale and wrong-concept requests rejected; original concepts still need Help mode; chosen-concept sheets plant only that concept; a full teaching flow for each of the eight (en) and in es/vi; concept hints never leak the answer; a new Town place is announced once (and on a repeated turn); saved progress keeps new concepts.
- **town (17):** all locked at start; ½ star no, 1 star yes; every `parts` digit correct in all languages; teaser is a verified mistake; read-only; unknown concept rejected.
- **profile (10):** no save without consent; outdated version rejected; restore into a new session and town; mid-session consent keeps progress; merge best-of-both; saved readiness opens the gate; delete stops saving; whitelist only; retention purge; bad ids rejected.

**When adding features:** new lines in all three languages; every displayed number asserted against SymPy; stale/duplicate/out-of-order tests for new actions; any new stored field whitelisted, documented in [06](06-privacy-and-safety.md) and tested.

## Manual acceptance run
Mock mode first: fresh start from the README · demo sheet with chips only · voice explanations (Chrome) · mic denied · backend stopped mid-turn and restarted · double-tapped Confirm/Next · gate and hold button · Help: worksheet-1 → hints to reveal → worksheet-2 → report · webcam (and optionally Auto-snap, phone) · town: earn a star → banner → scene; locked teaser; back to homework · saved progress: consent → restart → Welcome back → delete · Teach-only report · Español and Tiếng Việt · 375 px and tablet · keyboard and reduced motion · clean console.

## 90-second demo (mock mode; keep a backup video)
1. Grown-up settings → **🎬 Demo worksheet** (or grade worksheet-1 then worksheet-2 in Help, then open Teach).
2. ✓ rows 1, 3, 5; ✗ **47 + 38 = 75** and type 85; ✗ **52 − 17 = 45** and type 35 → Done checking.
3. "Why is 75 wrong?" → "you forgot to carry the 1" → "But why…?" → "7 plus 8 is 15, so the 1 goes to the tens". (No mic: tap the carry chip, ½ star.)
4. Lumi solves a new carrying problem → 👍 → stars + confetti → new-place banner → optional Lemonade Stand scene.
5. 👪 Grown-ups: the child's words, explained counts, demo label.
6. Close: *"Every other homework app gives kids answers. Lumi makes them the teacher."*

**Help demo:** worksheet-1 (#2 and #4 circled) → Hint please ×3 → worksheet-2 (confetti) → report.

**Gotchas:** use mock mode (free Gemini quota is tiny); phones need HTTPS; glare is the main OCR failure; speech works best in Chrome.
