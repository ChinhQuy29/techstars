# 12 · Lumi's dream

**Status: three dreams to choose from.** Astronaut and baker have their own lessons. Doctor can be chosen, but its lessons are plain math until its stories are written and reviewed.

## What it is
Before the first lesson the child chooses **Lumi's dream**: what Lumi wants to be when it grows up. Every Teach problem is then asked as one short question from that dream, with no separate equation. With the astronaut dream, Lumi's "38 + 27 = 65" shows as:

> ⛽ The rocket has 38 L of fuel and gets 27 L more. Now it has **65** L.

Lumi's answer sits where the "?" is in the template, so marking it ✓/✗ and writing the correction work as before.

Lumi's first line on each page is in the dream's words too ("I want to be an astronaut! 🚀 Here's my space homework…"), and bar graphs count 🪐 ⭐ 🌙 ☄️ 🛸 instead of fruit.

Design: [`assets/new_lumi_screen.png`](assets/new_lumi_screen.png).

## The screen
- **Choose Lumi's dream:** title, Lumi in the dream's outfit, the dream's name and Lumi's line ("I want to fly a rocket to the Moon!"), ‹ › arrows (and swipe) to browse, and **Select**. Lumi holds one waving pose while the picker swaps the outfit overlay.
- **When it shows:** the first time a child opens Teach, or when they choose to change careers. The landing page, Home, Help, Town and Journey can all open before a career is picked.
- **Changing it:** open the header menu and choose **Change Lumi's dream**. On phone Home, tapping Lumi or the dream chip also opens the picker. Lumi goes back Home; the next page of homework uses the new dream.
- **Saved** on the device (`localStorage` key `lumi_dream`). It is just the dream id, no personal data.
- **Lumi wears the dream:** once a dream is chosen, every Lumi in the app (header, Home, lessons, Help, Town) is that dream's Lumi, and it changes the moment the child picks another dream (`useDreamArt()` in `frontend/src/dream.ts`, read by `LumiMascot`). Dream Lumi has the same five mood poses as plain Lumi (waving, excited, thinking, confused, sleeping), each dressed in the outfit, plus the "?", "hmm" and "Z z" extras. Before a dream is chosen, Lumi uses the plain poses.

## The rule: wording only
The dream never touches the math.
- Problems, right answers and Lumi's planted mistakes are made and checked exactly as before (SymPy and `concepts.py`). The question is written afterwards from the same numbers.
- Stories are **hand-written templates** filled with the problem's own numbers (`backend/app/services/dreams.py`). No AI writes them, so nothing can be made up and no answer can slip in.
- Tests (`backend/tests/test_dreams.py`):
  - Every number in a story comes from the math problem, and each story has exactly one "?" (the answer's place).
  - Every version (not just the first) stays short (90 characters at most) and passes the same checks; every language has the same number of versions; a worksheet never repeats a version.
  - The math is identical with and without a dream.
  - The graph picture swap keeps the counts and the planted mistake.
  - Unknown dreams are ignored.
  - Every dream has every line in en/es/vi.

## How it works
- The app sends `dream` with each `/api/teach/worksheet` request (`frontend/src/dream.ts`, `api.ts`). The server keeps it on the session for that sheet and for Lumi's "I try" problem.
- The server keeps the math problem (`TeachProblem.problem`) for checking, and the question (`TeachProblem.story`). The app gets the question as `problem`, both for the worksheet and for Lumi's try (`LumiProblemOut`, `TeachDemo`), so the phone card, the desktop worksheet and Lumi's try need no changes.
- Several versions per kind of problem (add, subtract, times, plus each of the newer eight concepts), in the same order in every language. **Astronaut** (4 each): fuel and moon rocks, aliens and space-station bolts, comets and cookies, space naps and launches. **Baker** (5 each): a small bakery with regulars (a hungry bear, Grandma, bunnies, squirrels, birds, a mouse), oven timers, the lunch rush, burnt pretzels, deliveries, recipes and gift boxes; bar graphs count 🧁 🍩 🥐 🍪 🥧. A worksheet uses a different version for each problem of the same kind, and Lumi's try picks one not already on the page (`TeachState.used_stories`). The same problem always gets the same first choice.

## Adding a dream (doctor, baker…)
1. **Backend:** add the id to `DREAMS` in `dreams.py`, plus 11 kinds of question with at least 3 versions each (aim for 5, with different characters and sentence shapes) and 2 intro lines in en/es/vi, and graph pictures. The tests then check it automatically, including that it shares no lines with another dream.
2. **Frontend:** add `{ id, emoji, image, w, h }` to `DREAMS` in `frontend/src/dream.ts`, add the name and line in `i18n.ts` (en/es/vi), and put the art in `frontend/public/assets/dreams/<id>.svg` (exported from Figma without the background).
3. **Review the lines:** they must stay age-appropriate and must not depend on knowing the job, e.g. no medicine doses for the doctor.

**Doctor (next):** the art and the picker entry are done (`frontend/src/dream.ts`, `i18n.ts`). It still needs its stories and intro lines in `dreams.py`. Keep them gentle and non-medical in the numbers (bandages, stickers, teddy-bear check-ups, waiting-room toys), never doses or illnesses.

## Art
All from Figma (file "Lumi", page "new"), exported as SVG with the page, section and screen backgrounds removed:
- `astronaut.svg`: "Group 13" `20:1792`
- `baker.svg`: "Group 26" `20:3074` (the full one; `20:3308` is the faded side preview)
- `doctor.svg`: "Group 27" `20:3254` (`20:3358` and `20:3411` are side previews)
 **Outfit poses** (`frontend/public/assets/mascot/<dream>/lumi-<pose>.svg`, 15 files) are built by `scripts/dream_outfits.py` from the plain poses and the dream drawings:
- **Head pieces** (astronaut helmet `Group 12` + `Vector 72`, chef's hat `Group 21`) are pinned to Lumi's two ear bolts, so they follow each head's position, size and tilt.
- **Body pieces** (apron `Group 25`, doctor's coat `Vector 104–107`) are fitted to the body and trimmed to that pose's body outline, so no sleeve floats where an arm used to be. The doctor's coat therefore has no sleeves in the arms-down poses.
- **The stethoscope** (`Group 28`) follows the body, and **the baguette** (`Rectangle 28`, `Vector 97–99`) goes to Lumi's left hand.
- Outfit poses share a taller 372×470 canvas (hats need room) with the feet at the same spot, so Lumi never jumps between moods (`OUTFIT_SIZE`).

If Minh changes a pose or a dream drawing, export it again (background removed, see above), re-measure the anchors in the browser and rerun `python scripts/dream_outfits.py`. To measure, load each SVG into a page and read `getBBox()` for the ear bolts (`Union`, `Union_2`), the body (`Vector 2`) and the left hand (`Vector 7`). The numbers live in `ANCHORS` at the top of the script.

The picker layers the waving pose and the three outfit-only SVGs from `frontend/public/assets/dreams/picker/`. The same script exports those layers on a shared canvas. Home uses the original Figma dream drawings, and the other mascot views use the pre-rendered poses.

## Log
- 2026-11-14 (outfit moods): every dream Lumi now has the five mood poses, dressed by `scripts/dream_outfits.py`; checked on the emulator (baker on Home, in a lesson and asleep in Help; switch to astronaut).
- 2026-11-14 (dream outfits): Lumi wears the chosen dream everywhere and switches when the dream changes; checked on the emulator (astronaut, then doctor).
- 2026-11-14 (newest): baker and doctor added to the picker (Figma Group 26 and 27); baker lessons with 5 versions per kind in en/es/vi; dream tests run for every dream. 345 backend tests pass. Checked on the emulator.
- 2026-11-14 (latest): four varied questions per skill, never repeated on one page; each problem in its own notebook row (the old fixed ruling ran through two-line questions). 256 backend tests pass.
- 2026-11-14 (later): problems now show only the short story question, with no equation underneath (owner feedback: text and equation together looked jammed).
- 2026-11-14:
  - Built the dream picker, astronaut stories for all 12 concepts in en/es/vi, the astronaut intro lines and space bar-graph pictures.
  - Tests: 218 backend tests pass (53 new).
  - Checked in the browser at phone and desktop size, and on the emulator against the laptop server.
