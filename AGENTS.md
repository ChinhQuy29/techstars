# AGENTS.md — Lumi

Rules for any AI coding agent working in this repo. Read this, then the docs it points to.

## Product in one paragraph
Lumi is a web app where a child (6–10) **teaches** a friendly robot math. Lumi brings homework with deliberate, verified mistakes; the child finds, fixes and explains them; Lumi solves a new problem "like you taught me". Help mode grades the child's own worksheet photo with hints, not answers. Lumi's Town shows what each taught skill lets Lumi do. Parents get an honest report. Goal: kids who understand math and come back, in an app that is **playful where the child acts and polished everywhere**. Math only: twelve primary-school concepts (carry, borrow, careful counting, times tables, sharing, patterns, big numbers, time, measuring, shapes, fractions, bar graphs) that the child picks in any order; software only (no lamp, LED or hardware concepts, a dropped early idea). New subjects, ages, providers, accounts or social features are proposals until the owner approves them.

## Docs
| | |
|---|---|
| [01 Product vision](docs/01-product-vision.md) | goal, research basis, users, positioning, long-term vision |
| [02 Learning design](docs/02-learning-design.md) | **source of truth for behavior** |
| [03 Lumi's Town](docs/03-lumis-town.md) | motivation layer, scenes, `parts` |
| [04 Character, UI and art](docs/04-character-ui-and-art.md) | mascot, must-keep UI rules vs. current style, screens, town art |
| [05 Architecture and API](docs/05-architecture-and-api.md) | layout, modules, endpoints, state, config |
| [06 Privacy and safety](docs/06-privacy-and-safety.md) | data map, consent, pilot |
| [07 Testing and demo](docs/07-testing-and-demo.md) | test coverage, manual run, demo script |
| [08 Status and roadmap](docs/08-status-and-roadmap.md) | built, unverified, next, out of scope |

Docs = intended behavior; code = implementation constraints. If they disagree (or docs disagree with each other), name it and ask; when a change is approved, update docs in the same change. Never invent requirements, assets, endpoints, libraries or test results. For large or ambiguous tasks, summarize requirements, current state, gaps and risks, and propose steps first; wait for approval when asked.

## Never break
1. The LLM never does math. SymPy computes and judges every answer (Lumi's, the child's, demos, Help, practice, Town). Gemini only extracts, rates explanations and phrases one sentence.
2. The server owns hint levels, the Teach state machine, outcomes and stars; the client renders `step`. A mismatched or duplicate action repeats the last turn with no state change.
3. No answer before hint level 4 (leak guard). Never affirm a wrong or vague explanation (affirmation guard). LLM text is sanitized, ≤ 200 chars, with template fallback.
4. Lumi's mistakes are only planted, `diagnose()`-verified ones; every number Lumi says comes from the backend.
5. The client never receives truth fields or outcomes of unfound mistakes.
6. Stars change only at demo confirmation; a chip earns ½; a town place needs 1 star; the town is read-only.
7. Voice, camera and an API key are never required; chips, typing and the keypad always work; mock mode runs everything.
8. Every error offers Try again / Start over; adult actions are hold-to-confirm in Grown-up settings.
9. Nothing persists without adult opt-in; only `mastery, quotes, ready, town_visits` are stored; the child's words never go in the event log; `CONSENT_VERSION` matches in `store.py` and `api.ts`.
10. One mascot renderer (`LumiMascot`), expressions follow backend state, no sad face while teaching (gentle disappointment only in story setbacks); no dark patterns (streaks, timers, leaderboards, purchases, guilt).
11. The must-keep UI rules in [04](docs/04-character-ui-and-art.md) beat any design skill or template; the visual style may change, Lumi's character may not.

## Conventions
- Small, focused, type-safe changes in the existing style; reuse components; no framework migrations or new dependencies without a reason (ask for big ones).
- Every line and label in **en, es and vi**: backend templates (`teach.TT`, `tutor.T`, `town.PLACES`) share keys (tested); `i18n.ts` types es/vi as the English shape. Lumi's wording is tuned: change it only with approval.
- Every number shown to the child is covered by a test against SymPy. New mutating actions get stale/duplicate/out-of-order tests. New stored fields need a whitelist entry, a privacy-doc update and a test.
- Don't edit `docs/assets/` originals; reuse approved art, never silently regenerate it; no text or numbers inside art.
- Lines are 1–2 short sentences a 6-year-old can follow; praise the teaching, never "you're smart".

## Commands
```bash
cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # setup: python -m venv .venv; .venv/Scripts/pip install -r requirements.txt; cp .env.example .env
cd backend && .venv/Scripts/python -m pytest
cd frontend && npm install && npm run dev        # http://localhost:5173, proxies /api and /socket.io
cd frontend && npm run build                     # type-check + build
```
No key or `MOCK_MODE=1` → deterministic mock mode. Develop and test in mock mode first. To test features without teaching, run the backend with `LUMI_ADMIN=1` and open `/?admin=1` (presets, stars, story choices, previews); never enable it on a deployed server.

## Workflow
Understand (docs + code) → pick relevant skills (follow their `SKILL.md`; say so if one is unavailable; use the fewest that help) → plan the smallest change with acceptance criteria → implement → validate (tests, build, browser at desktop and 375 px in mock mode, clean console) → review the diff (regressions, a11y, privacy, docs) → report. Never report a check as passing unless it ran.

Skills the owner has installed: `idea-refine`, `interview-me`, `spec-driven-development`, `planning-and-task-breakdown`, `ui-ux-pro-max` (UI decisions within the must-keep rules), `incremental-implementation`.

**Report:** Implemented · Files · Skills used · Validation (commands + real results) · Open issues / next step. Work on the requested task only; don't start the next roadmap item unasked. If an approved `docs/IMPLEMENTATION_PLAN.md` exists, it is the roadmap for the work it covers.

## Git and secrets
- Never commit `backend/.env` (holds `GEMINI_API_KEY`), keys, `.venv/`, `node_modules/`, build output, `backend/data/`, or any real child data.
- Never commit, push, open PRs, deploy or buy services without explicit permission. Commits: plain descriptive messages, the owner as sole author, no `Co-Authored-By` or "Generated with" lines.

## Pitfalls already hit
- Demo problems must come from the worksheet generator (`_make`), not a generic practice generator (it drifted to 84 + 99 for careful counting).
- Follow up only while `followups < 2` and no gain is pending, or a vague answer re-asks.
- Keypad: keep the latest value in a ref (double taps dropped digits).
- Reset the hidden TeachView when leaving the town to Help/Welcome, or it revives.
- `AnimatePresence mode="wait"` froze the speech bubble; use a keyed `motion.div`.
- Flag emoji render as letters on Windows: show language names.
- React 19 types: use `ReactElement`, not `JSX.Element`.
- Draw the mascot's arms after the body.
- Hide the Help score in Teach-only reports (it said "0 problems").
- Chips are the child speaking to Lumi ("You forgot…").
- Check 375 px: notebook rows wrapped and town tags overlapped before.
- Gemini: thinking `low`, 25 s timeout, filler line; demo in mock mode.
- Fire side effects once per state change (the sleep timer once spammed requests).
