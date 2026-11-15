# 12 · Lumi's dream

**Status: built for one dream (astronaut).** Doctor and baker are planned for the demo next.

## What it is
Before the first lesson the child chooses **Lumi's dream**: what Lumi wants to be when it grows up. Every Teach problem is then asked as one short question from that dream, with no separate equation. With the astronaut dream, Lumi's "38 + 27 = 65" shows as:

> ⛽ The rocket has 38 L of fuel and gets 27 L more. Now it has **65** L.

Lumi's answer sits where the "?" is in the template, so marking it ✓/✗ and writing the correction work as before.

Lumi's first line on each page is in the dream's words too ("I want to be an astronaut! 🚀 Here's my space homework…"), and bar graphs count 🪐 ⭐ 🌙 ☄️ 🛸 instead of fruit.

Design: [`assets/new_lumi_screen.png`](assets/new_lumi_screen.png).

## The screen
- **Choose Lumi's dream:** title, Lumi in the dream's outfit, the dream's name and Lumi's line ("I want to fly a rocket to the Moon!"), ‹ › arrows (and swipe) to browse, and **Select**. With one dream the arrows are dimmed and a line says more dreams are coming.
- **When it shows:** on the first visit, before Home (phone) or before the welcome screen and Teach (desktop). Help, Town and Journey don't need a dream.
- **Changing it:** on the phone, tap Lumi or the "🚀 Astronaut" chip on Home. On desktop, use the chip in the header. Lumi goes back Home; the next page of homework uses the new dream.
- **Saved** on the device (`localStorage` key `lumi_dream`). It is just the dream id, no personal data.

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
- Four versions per kind of problem (add, subtract, times, plus each of the newer eight concepts), in the same order in every language: fuel and moon rocks, aliens and space-station bolts, comets and cookies, space naps and launches, and more. A worksheet uses a different version for each problem of the same kind, and Lumi's try picks one not already on the page (`TeachState.used_stories`). The same problem always gets the same first choice.

## Adding a dream (doctor, baker…)
1. **Backend:** add the id to `DREAMS` in `dreams.py`, plus 11 kinds of question with 3–4 versions each and 2 intro lines in en/es/vi, and optional graph pictures. The tests then check it automatically.
2. **Frontend:** add `{ id, emoji, image }` to `DREAMS` in `frontend/src/dream.ts`, add the name and line in `i18n.ts` (en/es/vi), and put the art in `frontend/public/assets/dreams/<id>.svg` (exported from Figma without the background).
3. **Review the lines:** they must stay age-appropriate and must not depend on knowing the job, e.g. no medicine doses for the doctor.

## Art
`frontend/public/assets/dreams/astronaut.svg` is exported from Figma (file "Lumi", page "new", the "Group 13" layer `20:1792` on the dream screen), with the screen background removed. Inside lessons Lumi still uses the normal mascot (no space suit), since there is only one astronaut pose so far.

## Log
- 2026-11-14 (latest): four varied questions per skill, never repeated on one page; each problem in its own notebook row (the old fixed ruling ran through two-line questions). 256 backend tests pass.
- 2026-11-14 (later): problems now show only the short story question, with no equation underneath (owner feedback: text and equation together looked jammed).
- 2026-11-14:
  - Built the dream picker, astronaut stories for all 12 concepts in en/es/vi, the astronaut intro lines and space bar-graph pictures.
  - Tests: 218 backend tests pass (53 new).
  - Checked in the browser at phone and desktop size, and on the emulator against the laptop server.
