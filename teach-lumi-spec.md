# Teach Lumi Mode — Spec

> A second mode for Homework Lamp. In **Help mode** (the original), Lumi tutors the child. In **Teach mode**, the roles flip: Lumi brings *its own* homework with mistakes in it, and the child finds them, fixes them, and explains why. Lumi visibly learns from what the child teaches.
>
> Companion to [`homework-lamp-context.md`](homework-lamp-context.md), which is the source of truth for shared rules. This file is the source of truth for Teach mode. If code and this file disagree, fix one of them; don't leave them out of sync.

## 1. Why this mode exists

Kids using AI tutors want the answer, and Socratic hints fight that instinct. In Teach mode **the child is the expert**, so there is no answer to beg for. Each rule below traces back to a learning-by-teaching finding:

| # | Research finding | Design rule |
|---|---|---|
| R1 | Students try harder for a teachable agent than for themselves; largest gains for lower achievers (Chase et al., 2009) | Lumi is a likeable, slightly younger peer the child feels responsible for (§6) |
| R2 | Children learn only when the robot *visibly learns* (Chandra et al., 2020) | "Lumi's Brain" stars rise only from the child's teaching; mastered concepts stop getting planted errors (§5) |
| R3 | Watching your pupil use what you taught exposes your own gaps without ego threat (Okita & Schwartz, 2013) | After each explanation, Lumi solves a new problem out loud "like you taught me" (§3.6) |
| R4 | Tutors learn from *explaining why*, not reciting (Roscoe & Chi, 2007; Fiorella & Mayer, 2013) | Lumi asks "why?" follow-ups; explanation quality drives the dialogue (§3.5) |
| R5 | Tutoring quality matters and tutors need support (Matsuda et al., 2013) | Readiness gate (§3.1); when the child's teaching is wrong, Lumi stays confused, then switches to tutoring (§3.7) |
| R6 | Social dialogue and voice adaptation raise gains (Lubold et al., 2018) | Short social lines; stretch: TTS adapts to the child's voice (§6) |
| R7 | Adaptive tutor⇄tutee roles beat a fixed role (Chen et al., 2020) | Automatic role switch Teach → Help → Teach (§3.7) |
| R8 | Teachable-agent games raised arithmetic understanding but not attitude (Pareto, 2014) | Measure attitude separately in pilots (§11) |

## 2. Scope

- **Ages 6–10:** whole-number +, −, × on screen. Paper capture of the child's marks is milestone M5 and is not built yet.
- **Teachable concepts.** Planted mistakes come only from error types that `math_check.diagnose()` already recognizes. Every planted error therefore has a known concept and explanation, and generation **asserts `diagnose()` returns the same tag**:

| Tag | Kid label (en) | Planted error | Problem shape |
|---|---|---|---|
| `carry` | Carrying | `_add_no_carry(a, b)` | 2-digit + 2-digit, ones sum ≥ 10, total < 100 |
| `borrow` | Borrowing | `_sub_smaller_from_larger(a, b)` | 2-digit − 2-digit, top ones < bottom ones |
| `off_by_one` | Careful counting | correct ± 1 | 2-digit ± 2-digit, no carry/borrow |
| `mul` | Times tables | `a × (b ± 1)` | single digits 2–9 |

- **Out of scope:** division, word problems, fractions, and free-form "teach Lumi anything".

## 3. Core loop

```
Teach Lumi tab
 → 3.1 Gate ── not ready → "Let's practice X together first!" → Help mode (grown-up can force)
 → 3.2 Lumi's homework (5 problems, 2–3 planted mistakes, ≥1 correct)
 → 3.3 Child marks every row: ✓ right | ✗ oops (+ optional fixed answer)  → "Done checking!"
 → 3.4 Backend scores the marks (SymPy) → queue of problems that need talk
 → for each queued problem, one at a time:
      caught_fixed   → 3.5 Explain → 3.6 Demo → Next
      caught_unfixed → Fix (keypad) → 3.5 → 3.6 → Next
      false_alarm    → "Are you sure?" → Next
      missed (last)  → Find it (nudges) → Fix → 3.5 → 3.6 → Next
 → Done: "You found X of my Y mistakes!" → More homework | Grown-up report
```

### 3.1 Gate (prior knowledge, R5)
- A concept is **ready** if, in this session's Help mode, the child either solved a problem with that concept correctly or fixed one after hints.
- `math_check.concepts_of(problem)` maps problems to concepts:
  - `+` → `carry` if the ones column needs a carry, else `add`; always also `off_by_one`
  - `−` → `borrow` if the ones column needs borrowing, else `sub`; always also `off_by_one`
  - `×` → `mul`
- **Ready set** = ready concepts ∩ {carry, borrow, off_by_one, mul}.
- **Empty ready set** → `ready: false` with step `practice_first`. The kid sees "🙋 Practice with Lumi", which switches to Help mode. A small "Grown-up: try anyway" link resends with `force: true`, which uses {carry, off_by_one}.
- **Every ready concept already has 3 stars** → review mode: use them anyway, and the intro line becomes "I think I forgot a little…".

### 3.2 Lumi's homework
- **Size:** 5 problems, with 2–3 planted mistakes chosen at random, so at least 2 are correct.
- **Primary concept:** the ready concept with the fewest stars; ties are broken at random.
  - The first planted mistake uses the primary concept.
  - Other planted mistakes pick from the ready set, with the primary weighted ×2.
  - Concepts with 3 stars are excluded unless in review mode.
- **Correct problems:** drawn from ready concepts, with Lumi's answer = the SymPy answer.
- **Order:** shuffled, then numbered 1–5.
- **Checks on every problem:**
  - `check(problem, lumi_answer).is_correct == (not planted)`
  - for planted problems, `diagnose(problem, lumi_answer)[1] == concept`
  - Regenerate (up to 50 tries) if a check fails.
- **The client never receives `planted`, `correct_answer` or `error_step`.**

### 3.3 Child marks (screen)
- Each row shows `47 + 38 = 75` in Lumi's handwriting font, with two big buttons: **✓ Right** (green) and **✗ Oops** (orange).
- ✗ opens an inline answer box with a **kid keypad** (0–9, ⌫, big keys). Typing a fix is optional.
- **"Done checking!"** is enabled once every row is marked.

### 3.4 Outcomes (SymPy decides, never the LLM)
| Lumi's answer | Child's mark | Outcome |
|---|---|---|
| wrong | ✗ + correct fix | `caught_fixed` |
| wrong | ✗ + wrong or no fix | `caught_unfixed` |
| wrong | ✓ | `missed` |
| right | ✗ | `false_alarm` |
| right | ✓ | `confirmed_ok` (no talk) |

- **Queue:** `caught_*` and `false_alarm` problems in id order, then `missed` problems.
- **Prefix line:** if every outcome is `confirmed_ok` or `caught_*`, the first line starts with "You checked my whole page!".

### 3.5 Explain ("Why is mine wrong?", R4)
- Lumi asks: *"Oh no, you're right! Why is 75 wrong? What did I mess up?"*
- The mic opens **automatically** after Lumi finishes speaking; if speech recognition is missing, the child taps 🎤.
- **Below the mic**, show 3 big explanation chips (one correct, two misconceptions, shuffled) and a **"🤷 I'm not sure"** button.

**Rating the explanation:** `classify(concept, text)` returns one of four quality levels. Gemini does the rating when a key is set; otherwise keyword rules do (§7.4).

| Quality | Meaning | Lumi's next move |
|---|---|---|
| `concept` | says the rule **and** why ("7+8 is 15, more than 9, so the 1 goes to the tens") | Specific praise → Demo; **+1 star** |
| `procedure` | says what, not why ("you have to carry the 1") | First time: one why-question (`ask_why`). After it, `concept` → Demo **+1**, `procedure`/`vague` → Demo **+½**, `incorrect` → the incorrect path below |
| `vague` | "it's just wrong", silence, "I'm not sure" | Point at the spot (`point`), up to 2 times; the 3rd vague answer → Demo ("Okay, thank you for helping me!"); **+0** |
| `incorrect` | a misconception, or a distractor chip | First time: *"If I do it that way I still get 75. Can you tell me another way?"* (chips again). Second time → role switch: Lumi explains the rule itself → Demo; **+0** |

- **Correct chip:** counts as `procedure` but goes straight to Demo with **+½ star** (no why-question).
- **Chip wording** is what the child says *to* Lumi: "You forgot to carry the 1", never "I forgot…".
- **Follow-up limit:** at most 2 per problem.
- **Quotes for the report:** the child's best spoken explanation per concept is saved; `concept` beats `procedure`.

### 3.6 Demo: Lumi tries again (R2, R3)
- Lumi gets a **new** problem of exactly the same concept and shape, generated by `teach._make(concept, planted=False)` and different from the problem just discussed. (`practice_for_concept` is not used here: its random problems can drift, e.g. a careful-counting demo of 84 + 99.)
- Lumi solves it **correctly** in step-by-step lines from `demo_steps()`. The numbers come from Python and the answer from SymPy.
- Spoken: *"Like you taught me! First the ones: 6 plus 9 is 15. I write 5 and carry the 1. Then the tens: 2 plus 5 plus 1 is 8. So it's 85! Did I do it right?"* If a quote exists, the line opens with it.
- **UI:** the steps appear one by one on a card (~1.6 s apart, roughly in time with the speech), and the answer appears only with the last step. Buttons: **👍 Yes, you got it!** and **🤔 Not quite**.
- **On either button,** apply the pending star gain, log `teach_mastery_up`, then go to step `next`.
  - **Gain > 0:** "Yay! I learned carrying!" with `celebrating` and confetti.
  - **Gain = 0:** "Thanks for helping me, teacher!"
  - **"Not quite":** Lumi first adds "I checked it twice and still get 85. I think I've got it now!"

### 3.7 Repair paths (R5, R7)
**Fix** (`caught_unfixed`, or after Find): the child enters an answer on the keypad.
- **Right:** "Yes! That's right. Now tell me, why was mine wrong?" → Explain.
- **Wrong, first try:** *"Hmm, I tried 95 and it still doesn't look right. Can we look at the ones column together?"* Use "count the groups" for `mul` and "count it slowly" for `off_by_one`. **Never say the correct answer.**
- **Wrong, second try → role switch:** "Let me help you this time, then you can teach me!" plus the Help-mode hint template at level 1 (step `help`). Each further wrong answer raises the hint level by 1. Level 4 may reveal the answer. Hints reuse `tutor.T[lang][1..4]` and `_worked_step`.
- **Fixed during help:** "You got it! Now can you tell me why mine was wrong?" → Explain, with **gain forced to 0**.

**Find** (`missed`):
- **Nudge 1:** "My teacher says one more of mine has a mistake. Can you find it?" The rows become tappable.
- **Nudge 2:** "I think it's one of these two…" Highlight the target plus one neighbor.
- **Nudge 3:** "Can you check number 3 really carefully?" Highlight the target only.
- **Correct tap:** "Yes, that one! What should my answer be?" → Fix.
- **After a 4th wrong tap,** Lumi points at the problem itself → Fix.

**Are you sure?** (`false_alarm`):
- Lumi: *"Are you sure? Let's check it together. {check steps}. Was I right?"*
- **"✅ You were right, Lumi!"** → "Phew! Checking my work was a great idea, teacher." (`happy`)
- **"❌ Still wrong"** → "Hmm, I counted twice and got 37 both times. Let's ask a grown-up to check later!" (`encouraging`)
- Either way → `next`.

**Done:** "Thank you, teacher! You found {caught} of my {planted} mistakes. I learned so much!" (`celebrating`). `caught` counts planted problems the child marked ✗.

## 4. Safety and correctness rules
1. **SymPy is the only judge** of Lumi's answers, the child's fixes and Lumi's demo answers. The LLM only rates explanations and writes one reaction sentence.
2. **Never reinforce a misconception.** When quality is `incorrect` or `vague`, LLM text containing an affirmation (yes / right / correct / good / great / sí / correcto / bien / đúng / giỏi) is replaced with the template (`teach._affirms`).
3. **Never reveal the answer to an unresolved planted problem** before hint level 4. Wrong-fix lines use only the child's number. LLM text is also checked with `tutor._leaks_answer`.
4. **Lumi's mistakes are only the planted ones** from §2. Every number in Lumi's lines comes from the backend.
5. **No sad face.** Lumi's own mistakes are cheerful ("Oops, silly me!").
6. **Honesty with adults:** the grown-up report says Lumi's mistakes are deliberate. For the child it's pretend play.

## 5. Lumi's Brain (visible learning, R2)
- **Stars:** `Session.lumi_mastery[tag]` runs from 0 to 3 in steps of ½ and is shown as stars per concept.
- **Applied on demo confirm:** gains are applied when the child answers the demo, never before.
- **Mastered concepts** (3 stars) stop being planted except in review mode.
- **Storage:** stars live in the in-memory `Session` for now. SQLite persistence plus spaced-review decay (−½ star after a few days) is milestone M7.

## 6. Personality and dialogue
- **A curious, slightly younger peer:** eager and grateful. Lumi asks more than it tells.
- **Praise the teaching, specifically:** at most one praise line per turn. Never say "you're smart".
- **Short lines:** 1–2 sentences. Every line is spoken via TTS in en/es/vi, and all templates live in `teach.TT`.
- **Emotions** reuse the existing set:
  - `curious`: asking why
  - `confused`: wrong teaching
  - `thinking`: Lumi working
  - `happy` / `celebrating`: learned something
  - `encouraging`: role switch
- **Stretch (M7):** match the TTS rate and pitch to the child's voice; Lumi sometimes slips on a demo.

## 7. Backend (as built)

### 7.1 Files
- `app/services/teach.py`: worksheet generation, outcome scoring, the turn state machine, explanation rating (LLM + rules), demo steps, templates `TT`, guards.
- `app/routes/teach.py`: `POST /api/teach/worksheet` and `POST /api/teach/turn`.
- `app/services/session.py`: `Session.teach: Optional[TeachState]`, `Session.lumi_mastery`, `Session.teach_quotes`.
- `app/services/math_check.py`: `concepts_of(problem)` and `TEACHABLE`.
- `app/prompts/teach_explain.txt`: the rating prompt.
- `app/routes/report.py`: adds a `teach` section.
- `tests/test_teach.py`: full mock-mode flow tests (26 tests: generation ×4 concepts, gate, happy path, follow-ups, chips, role switches, find, false alarm, stale/out-of-order actions, LLM affirmation guard, classifier, es/vi demo steps).

### 7.2 API
`POST /api/teach/worksheet`
```jsonc
// request
{ "session_id": "abc123", "language": "en", "force": false }
// response
{
  "ready": true,
  "worksheet_id": "w1a2b3",
  "problems": [ { "id": 1, "problem": "47 + 38", "lumi_answer": "75" } ],   // no truth fields
  "concepts": ["carry", "off_by_one"],
  "turn": { /* TeachTurn, step "mark" */ }
}
```

`POST /api/teach/turn`
```jsonc
{
  "session_id": "abc123", "language": "en", "worksheet_id": "w1a2b3",
  "action": "check" | "fix" | "find" | "explain" | "confirm" | "next",
  "marks": [ { "id": 1, "mark": "circle" | "check" | "none", "correction": "85" } ],  // check
  "problem_id": 3,          // find
  "answer": "85",           // fix
  "child_said": "you forgot to carry", "chip_id": "c0",   // explain (either)
  "agree": true             // confirm (demo / are-you-sure)
}
```

`TeachTurn` (the response to both endpoints):
```jsonc
{
  "emotion": "curious",
  "say": "Oh no, you're right! Why is 75 wrong? What did I mess up?",
  "step": "practice_first" | "mark" | "fix" | "help" | "find" | "explain" | "demo" | "sure" | "next" | "done",
  "focus_problem_id": 1,
  "highlight_ids": [],
  "chips": [ { "id": "c0", "text": "I forgot to carry the 1" } ],
  "demo": { "problem": "26 + 59", "steps": ["First the ones: 6 plus 9 is 15. I write 5 and carry the 1.", "..."], "answer": "85" },
  "outcomes": [ { "id": 1, "outcome": "caught_fixed" } ],
  "mastery": { "carry": 1.0, "borrow": 0, "off_by_one": 0.5, "mul": 0 },
  "mastery_up": "carry",
  "help_level": 0,
  "stats": { "caught": 2, "planted": 3, "false_alarms": 0 }
}
```
- **Unknown or stale `worksheet_id`** → 409.
- **An action that doesn't fit the current step** → the current turn is repeated, so the client can always recover.

### 7.3 State machine (per queued problem)
```
stage: explain | fix | find | sure | demo | next
fix_tries, help_level (0 = not switched), followups, incorrect, nudge, gain (pending), role_switched
```
`teach.respond(session, req)` is a pure function of session state plus the request. All counters live on the server.

### 7.4 Explanation rating
- **Gemini** (`teach_explain.txt`, structured output `TeachExplainLLM {quality, reaction, quote}`): gets the concept, Lumi's wrong answer, the correct answer, the rubric with examples, the language and the follow-up count. `reaction` is one spoken sentence; it is guarded (§4.2) and falls back to the template.
- **Rules** (mock mode, or LLM failure): per-language keyword lists per concept:
  - `incorrect` if a wrong-idea keyword appears (e.g., "borrow" for a carry problem)
  - `concept` if a why-keyword appears (ten / tens / 10 / more than 9 / diez / decena / mười / chục …)
  - `procedure` if an action keyword appears (carry / llevo / nhớ …)
  - otherwise `vague`

### 7.5 Events (for the report)
`teach_worksheet`, `teach_checked{outcome per id}`, `teach_explained{concept, quality}`, `teach_role_switch`, `teach_mastery_up{concept, gain}`, `teach_done{caught, planted}`.

## 8. Frontend (as built, kid-friendly)

### 8.1 Look and feel (applies to the whole app)
- **Bright, warm theme:** sky-to-cream background, white rounded cards (`rounded-3xl`), soft shadows. No dark dashboard look.
- **Fonts:** `Baloo 2` for UI and `Patrick Hand` for Lumi's handwriting, both from Google Fonts with system fallbacks.
- **Chunky buttons:** at least 56 px tall, `text-lg`/`text-xl`, an emoji plus 1–3 words, and a "3D" bottom shadow that presses down on tap. Kids may not read well, so the emoji carries the meaning.
- **Short labels in all three languages:** UI strings live in `src/i18n.ts`. The language picker uses plain names, because Windows draws flag emoji as letters.
- **Changing language restarts Teach mode with a new worksheet** (spoken lines are generated in the language of the request).
- **Grown-up things are tucked away:** session id, model, camera source, trigger debug, voice trigger and the phone QR live in a collapsible **"🔧 Grown-up settings"** panel. The **👪 Grown-ups** button opens the report.
- **Friendly status chip** instead of raw phase names: 👀 Watching · 📸 Snap! · 🤔 Thinking · 💬 Talking · 😴 Sleeping.

### 8.2 Layout
- **Header:** Lumi logo + name · big mode tabs **🧑‍🏫 Teach Lumi** | **🙋 Help me** · language picker · 👪 Grown-ups.
- **Teach mode** (`views/TeachView.tsx`):
  - **Left card:** `Face`, the speech bubble, and `LumiBrain` (4 concept rows, each with an emoji, a label and stars that pop when they rise).
  - **Right card:** `LumiHomework`, a lined notebook page with a red margin and the title "Lumi's Homework 📒", one row per problem, ✓/✗ toggles, inline fix display and outcome badges.
  - **Action area under the notebook,** changing by step:
    - `mark`: "📝 Done checking!"
    - `fix` / `help`: `KidKeypad` + "✅ Tell Lumi"
    - `find`: "Tap the one with the mistake!" (rows pulse)
    - `explain`: a 🎤 mic button with a listening ring, `ExplainChips` and "🤷 I'm not sure"
    - `demo`: a demo card with staggered steps + 👍 / 🤔
    - `sure`: ✅ / ❌
    - `next`: "Next ➜"
    - `done`: a trophy card + "📚 More homework" + "👪 Grown-up report"
    - `practice_first`: "🙋 Practice with Lumi" + "Grown-up: try anyway"
- **Help mode:** the same flow as before, restyled. `TutorView` is on top; below are the camera card ("📷 Turn on camera") and "🧪 Try a sample" (sample worksheets + upload). Grown-up settings are collapsed at the bottom.

### 8.3 Files
`src/i18n.ts`, `src/views/TeachView.tsx`, `src/components/LumiHomework.tsx`, `src/components/LumiBrain.tsx`, `src/components/KidKeypad.tsx`, `src/components/ExplainChips.tsx`. The teach API lives in `src/api.ts`. `App.tsx` gains the mode tabs and the grown-up panel.

## 9. Report (`/api/report`, `teach` section)
- **`taught`:** `[{concept, label, stars}]` for concepts with stars > 0.
- **`quotes`:** `[{concept, label, text}]`, the child's own words.
- **Counts:** `caught`, `planted`, `missed`, `false_alarms`, plus `explanations: {concept, procedure, vague, incorrect}`.
- **`note`:** "Lumi's mistakes are on purpose. Finding and explaining them helps your child understand math more deeply."
- `ParentReport.tsx` shows a **"🧑‍🏫 Your child taught Lumi"** section when `teach` is present. When only Teach mode was used (no Help-mode problems), the Help-mode score block is hidden.

## 10. Build order
- [x] **M1:** worksheet generation + on-screen marking + outcomes (no LLM)
- [x] **M2:** explanation by chips/voice + rating (rules + Gemini) + follow-ups
- [x] **M3:** demo "like you taught me" + Lumi's Brain stars
- [x] **M4:** repair paths (fix, role switch, find, are-you-sure) + done screen
- [x] **M6:** report section; en/es/vi templates
- [ ] **M5:** printable sheet + camera reading of ✓/✗ marks (`prompts/teach_marks.txt`, `TeachMark` schema, known layout)
- [ ] **M7:** SQLite persistence, spaced-review decay, demo slips, TTS voice adaptation

## 11. Pilot plan (with the HRI lab)
- **Design:** within-subjects, counterbalanced Help vs. Teach on matched concepts, 2–3 sessions each.
- **Primary outcome:** pre/post gain on the target concept, plus near-transfer problems.
- **Secondary outcomes:**
  - explanation quality
  - detection accuracy
  - time on task
  - voluntary continuation
  - self-efficacy and attitude (R8)
- **Subgroups:** lower vs. higher prior achievers (R1).
- **Ethics:** IRB approval, parental consent and child assent. No image storage by default.

## 12. Risks
| Risk | Mitigation |
|---|---|
| Speech recognition fails for young kids, accents, code-switching | Chips + "I'm not sure"; never block on speech |
| Child lacks the concept | Gate (§3.1) + role switch |
| Child marks everything ✗ | ≥2 correct problems; false alarms ask for proof; accuracy in report |
| LLM praises a wrong idea | Affirmation guard + templates |
| Gemini quota or latency | LLM only for rating explanations; everything else is templates |

## 13. Demo script (90 s)
1. In **Help me**, grade `worksheet-1` then `worksheet-2` (this unlocks carrying), or use "Grown-up: try anyway".
2. **🧑‍🏫 Teach Lumi:** "I did my homework! Can you be my teacher?"
3. Mark the rows; on 47 + 38 = **75**, tap ✗ and type 85 → **Done checking!**
4. Lumi: "Why is 75 wrong?" → say "you forgot to carry the 1" → Lumi: "But why does the 1 move over?" → "because 7 plus 8 is 15".
5. Lumi solves 26 + 59 out loud "like you taught me" → 👍 → stars pop, confetti.
6. **👪 Grown-ups** → report shows "Explained carrying in their own words".
7. Close: *"Every other homework app gives kids answers. Lumi makes them the teacher."*
