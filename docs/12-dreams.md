# 12 · Lumi's dream

**Status: built for one dream (astronaut).** Doctor and baker are planned for the demo next.

## What it is
Before the first lesson the child chooses **Lumi's dream**: what Lumi wants to be when it grows up. Every Teach problem then gets a short story from that dream. With the astronaut dream, "38 + 27" becomes:

> ⛽ The rocket has 38 litres of fuel. The crew adds 27 more.
> 38 + 27 = 65

Lumi's first line on each page is in the dream's words too ("I want to be an astronaut! 🚀 Here's my space homework…"), and bar graphs count 🪐 ⭐ 🌙 ☄️ 🛸 instead of fruit.

Design: [`assets/new_lumi_screen.png`](assets/new_lumi_screen.png).

## The screen
- **Choose Lumi's dream:** title, Lumi in the dream's outfit, the dream's name and Lumi's line ("I want to fly a rocket to the Moon!"), ‹ › arrows (and swipe) to browse, and **Select**. With one dream the arrows are dimmed and a line says more dreams are coming.
- **When it shows:** on the first visit, before Home (phone) or before the welcome screen and Teach (desktop). Help, Town and Journey don't need a dream.
- **Changing it:** on the phone, tap Lumi or the "🚀 Astronaut" chip on Home. On desktop, use the chip in the header. Lumi goes back Home; the next page of homework uses the new dream.
- **Saved** on the device (`localStorage` key `lumi_dream`). It is just the dream id, no personal data.

## The rule: wording only
The dream never touches the math.
- Problems, right answers and Lumi's planted mistakes are made and checked exactly as before (SymPy and `concepts.py`). The story is added afterwards.
- Stories are **hand-written templates** filled with the problem's own numbers (`backend/app/services/dreams.py`). No AI writes them, so nothing can be made up and no answer can slip in.
- Tests (`backend/tests/test_dreams.py`):
  - Every number in a story already appears in the problem.
  - The math is identical with and without a dream.
  - The graph picture swap keeps the counts and the planted mistake.
  - Unknown dreams are ignored.
  - Every dream has every line in en/es/vi.

## How it works
- The app sends `dream` with each `/api/teach/worksheet` request (`frontend/src/dream.ts`, `api.ts`). The server keeps it on the session for that sheet and for Lumi's "I try" problem.
- Each problem has a new optional `story` field (`LumiProblemOut`, `TeachDemo`).
- The story is shown above the problem in the phone card, the desktop worksheet and Lumi's try.
- One template per kind of problem: add, subtract, times (the original four), plus one each for the newer eight concepts.

## Adding a dream (doctor, baker…)
1. **Backend:** add the id to `DREAMS` in `dreams.py`, plus 11 story lines and 2 intro lines in en/es/vi, and optional graph pictures. The tests then check it automatically.
2. **Frontend:** add `{ id, emoji, image }` to `DREAMS` in `frontend/src/dream.ts`, add the name and line in `i18n.ts` (en/es/vi), and put the art in `frontend/public/assets/dreams/<id>.webp`.
3. **Review the lines:** they must stay age-appropriate and must not depend on knowing the job, e.g. no medicine doses for the doctor.

## Art
`frontend/public/assets/dreams/astronaut.webp` is cut from the design screenshot (982 × 630). It is sharp enough for phones. A transparent export from Figma (same file name, about 500 × 600 or larger) would still give cleaner edges around the glass visor. Inside lessons Lumi still uses the normal mascot (no space suit), since there is only one astronaut pose so far.

## Log
- 2026-11-14:
  - Built the dream picker, astronaut stories for all 12 concepts in en/es/vi, the astronaut intro lines and space bar-graph pictures.
  - Tests: 218 backend tests pass (53 new).
  - Checked in the browser at phone and desktop size, and on the emulator against the laptop server.
