# 02 · Learning design

The behavioral source of truth. Contracts: [05](05-architecture-and-api.md). Town: [03](03-lumis-town.md). All lines Lumi says live in `teach.TT`, `tutor.T`, `town.PLACES` (en/es/vi); examples below are English.

## Scope
- Ages 6–10, whole-number arithmetic. Three header tabs: **🧑‍🏫 Teach Lumi**, **🙋 Help me**, **🏘️ Lumi's Town**.
- Languages en/es/vi everywhere (UI, speech, templates). Changing language restarts Teach with a new worksheet.
- Help mode: `+ − × ÷` (remainders like `17 ÷ 5 = 3 r 2`). Teach mode: only these four concepts:

| Tag | Kid label | Lumi's planted mistake | Shape |
|---|---|---|---|
| `carry` | Carrying | adds columns without carrying (47+38→75) | 2-digit + 2-digit, ones ≥ 10, total < 100 |
| `borrow` | Borrowing | smaller-from-larger in each column (52−17→45) | 2-digit − 2-digit, top ones < bottom ones |
| `off_by_one` | Careful counting | correct ± 1 | 2-digit ± 2-digit, no regrouping |
| `mul` | Times tables | `a × (b ± 1)` | single digits 2–9 |

Out of scope: fractions, word problems, division in Teach, "teach Lumi anything".

## Teach Lumi loop
The **server owns the flow**; the client renders `step` and sends actions.

```
Gate (ready concepts?) ── no → practice_first (→ Help, or adult hold "try anyway")
 → worksheet: 5 problems, 2–3 planted, ≥2 correct → child marks ✓/✗ (+ optional fix) → Done checking!
 → SymPy scores → queue, one problem at a time:
     caught_fixed → Explain → Demo → Next
     caught_unfixed → Fix → Explain → Demo → Next
     false_alarm → Are you sure? → Next
     missed (last) → Find → Fix → Explain → Demo → Next
 → Done: "You found X of my Y mistakes!" → More homework | Grown-up report
```

**Gate.** A concept is ready if, in Help mode, the child solved one correctly or fixed one after hints (`concepts_of`: `+` → carry or add, plus off_by_one; `−` → borrow or sub, plus off_by_one; `×` → mul), plus readiness saved from earlier days. No ready concept → `practice_first` with **🙋 Practice with Lumi** and **🔒 Grown-up: try anyway** (hold 1.5 s; sends `force`, uses carry + off_by_one). All ready concepts at 3 stars → review mode ("I think I forgot a little…").

**Demo worksheet** (Grown-up settings → 🎬, `demo: true`, bypasses the gate, fixed seed): `23+14=37` ✓, `47+38=75` ✗ carry, `6×7=42` ✓, `52−17=45` ✗ borrow, `34+25=59` ✓. Events carry `demo: true`; the report labels it. Nothing is faked.

**Worksheet generation.** Primary concept = ready concept with fewest stars (ties random); the first planted mistake uses it, the others draw from the ready set with the primary ×2. 3-star concepts are excluded except in review. Shuffled, numbered 1–5. Every problem self-checks (`check(...).is_correct == not planted`; planted → `diagnose()` returns the same tag); retry up to 50 times, else 503 `generation_failed`. The client gets only `{id, problem, lumi_answer}`.

**Marking.** Notebook rows in Lumi's handwriting; big **✓ Right** / **✗ Oops**; ✗ opens a kid keypad (optional fix); Done is enabled when every row is marked.

**Outcomes** (SymPy decides): wrong + ✗ + correct fix = `caught_fixed`; wrong + ✗ otherwise = `caught_unfixed`; wrong + ✓ = `missed`; right + ✗ = `false_alarm`; right + ✓ = `confirmed_ok`. Queue: caught and false alarms in id order, misses last. All caught or confirmed → first line starts "You checked my whole page!". **Outcomes of unfound misses are never sent.**

**Explain** ("Oh no, you're right! Why is 75 wrong? What did I mess up?"). Three ways, none required: voice (mic opens after Lumi speaks), **3 chips** (one correct, two misconceptions, shuffled, worded as the child to Lumi: "You forgot…") plus **🤷 I'm not sure**, or **✍️ typed** (≤ 200 chars, rated like speech).

| Quality | Meaning | Next | Stars |
|---|---|---|---|
| `concept` | rule + why ("15 is more than 9, so the 1 goes to the tens") | praise → Demo | +1 |
| `procedure` | what, not why ("carry the 1") | first time one why-question; then concept +1, procedure/vague +½, incorrect → incorrect path | +½ / +1 |
| `vague` | "it's wrong", silence, not sure | point at the spot (≤ 2), 3rd → Demo "thank you for helping me" | 0 |
| `incorrect` | misconception or distractor chip | "If I do it that way I still get 75…" (chips again); 2nd → role switch, Lumi explains → Demo | 0 |

Correct chip = `procedure` but straight to Demo with +½ (so a chip alone never unlocks a town place). Max 2 follow-ups per problem; a vague answer after the why-question doesn't re-ask. The best quote per concept is kept (`concept` beats `procedure`) for the report and scrapbook.

**Demo** ("like you taught me"). A new problem of the same concept from the same generator (`_make(concept, planted=False)`), never the one just discussed; steps from `demo_steps()`, answer from SymPy; opens with the child's quote if any. Steps appear ~1.6 s apart, answer last, Lumi `thinking` until then. **👍 Yes, you got it! / 🤔 Not quite** → the pending gain is applied (the only time stars change) → `next`. Gain > 0: "Yay! I learned carrying!" + confetti; 0: "Thanks for helping me, teacher!"; "Not quite" first adds "I checked it twice and still get 85."

**Repairs.**
- **Fix:** right → Explain. Wrong once → "I tried 95 and it still doesn't look right. Can we look at the ones column?" (never the answer). Wrong twice → role switch ("Let me help you this time"), Help hint level 1, +1 per further miss, reveal only at 4. Fixed during help → Explain with gain forced to 0.
- **Find:** nudge 1 "one more of mine has a mistake" (rows tappable); 2 highlight target + neighbor; 3 target only; correct tap → Fix; 4th wrong tap → Lumi points → Fix.
- **Are you sure:** Lumi checks aloud; "✅ You were right, Lumi!" → happy, "❌ Still wrong" → "let's ask a grown-up later"; → Next.
- **Done:** caught = planted problems marked ✗.

**Lumi's Brain:** stars 0–3 in ½ steps per concept; change only at demo confirmation; 3 stars → no longer planted. A game signal, never "mastery".

**Robustness:** each mutating action is valid in one stage; anything else repeats the last turn unchanged (so double taps can't double stars or skip problems). Stale `worksheet_id` → 409, client starts a new sheet. Timeouts/network errors → 🔁 Try again / 📚 Start over.

## Help mode
Reads the child's own worksheet; the source of Teach readiness.

- **Capture:** webcam, phone camera (QR + Socket.IO, needs HTTPS), upload, or samples. The child taps **✅ Check my work**; the live picture never leaves the browser until then. Adult options: **Auto-snap** (hands seen then gone, still 1.5 s, > 0.25% of a 160×120 grayscale frame changed; MediaPipe, motion as fallback) and a "check my work" voice trigger. Uploads shrink to 1600 px.
- Gemini extracts problems, answers, boxes, confidence; **SymPy grades**; wrong answers are circled on the photo. Confidence < 0.6 → `needs_confirmation` ("Is that a 7 or a 1?"). Hand blocking → "Move your hand". Quota/timeout → friendly line, previous grade kept. Lumi shows `thinking` with a filler line while waiting; sleeps after 60 s idle.
- **Hint ladder** (server-owned per problem; actions `react | hint | chat`): 1 reflect, 2 strategy, 3 worked step, 4 reveal + SymPy-checked practice problem. `attempts` += 1 per wrong grade; react → level = max(level, attempts, 1); hint → +1; chat → ≥ 1; cap 4. Below 4, LLM text containing the answer is replaced (leak guard).
- Other lines: specific praise when all correct (never "you're smart"), celebration on a fix, a nudge for blanks.
- **Error step:** rule-based `diagnose()` first; a second Gemini call only if rules can't explain it and work is visible.

## Personality
Curious, slightly younger peer; asks more than tells; 1–2 sentence lines, all spoken by TTS; praise the teaching, at most once per turn. **No sad face**: Lumi's own mistakes are cheerful ("Oops, silly me!"). Emotions: `sleeping idle listening thinking happy celebrating encouraging curious confused`. The report tells adults the mistakes are deliberate.

## Safety rules
1. SymPy judges every answer (Lumi's, the child's, demos, Help grading, practice, Town). The LLM only extracts, rates and phrases one sentence.
2. Never affirm a misconception: for `incorrect`/`vague`, LLM text with an affirmation (yes/right/correct/good/great/sí/correcto/bien/đúng/giỏi…) is replaced by the template.
3. Never reveal an answer before hint level 4.
4. Lumi's mistakes are only the planted, `diagnose()`-verified ones; every number comes from the backend.
5. The LLM never decides correctness, reveals, stars, outcomes or flow.
6. LLM text is sanitized (no markup, ≤ 200 chars) with template fallback.
7. The client never sees truth fields or unfound outcomes.
8. Voice is never required.

## Explanation rating
- **Gemini:** `prompts/teach_explain.txt` → `{quality, reaction, quote}` (quote ≤ 12 words), then sanitized and guarded.
- **Rules** (mock mode or any LLM failure), per concept and language in `teach._RULES`: wrong-idea keyword → `incorrect`; why keyword (ten, 10, more than 9, decena, chục…) → `concept`; action keyword (carry, llevo, nhớ…) → `procedure`; else `vague`.

## Parent report (👪 Grown-ups)
- **Help:** score, correct, fixed, hints, struggled concepts, 3 SymPy-checked practice problems, one summary sentence. Hidden when only Teach was used.
- **Teach ("Your child taught Lumi"):** concepts with stars, the child's quotes, caught/planted/missed/false alarms, explanation qualities, each with a plain explanation; the note "Lumi's mistakes are on purpose…"; the demo-sheet label.
- Raw events exclude `teach_*`. Never write "mastered" or "proven".

## Measure
Detection (caught/planted, misses, false alarms), explanation quality over time (a falling share of `concept` = kids rushing), time on task, voluntary "More homework", return visits, adult interventions, attitude separately from learning.
