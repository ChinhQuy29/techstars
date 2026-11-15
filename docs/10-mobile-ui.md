# 10 · Phone layout

Plan, progress log and test results for the phone layout (the Android app and any browser narrower than 768 px). Desktop and tablet keep the current layout. Keep this file current while working on it; move settled rules into [04](04-character-ui-and-art.md) when done.

## Why
On a phone the current app is one long scrolling page: the header (logo, three tabs, language, Grown-ups) takes a third of the screen, the worksheet sits below the fold, and Lumi's Brain and Grown-up settings trail at the bottom. Kids see many buttons at once and don't know where to tap. Reference for the feel: big learning apps (one thing per screen, a bottom tab bar, one big next action). We borrow general patterns, never another app's look: after the first build the owner said it looked like a Duolingo clone, so the lesson path and the green progress bar were replaced with Lumi's own ideas (its brain screen, its notebook).

## Decisions (agreed with the owner, 2026-11-14)
| Question | Decision |
|---|---|
| Moving between screens | The bottom tab bar has 🏘️ Town, 🏠 Home, and 🙋 Help. The header has a menu with Grown-ups, and the Town screens show 📔 Scrapbook and 🌙 Journey. Navigation hides during a lesson so the lesson fills the screen. |
| Home | **Lumi's Brain** (changed 2026-11-14 after owner feedback): Lumi above its navy brain screen; the 12 skills are lights in a 3-column grid that glow brighter with stars. The child picks **any** skill: no track, no suggested next skill, no hand pointing at one. "🎲 Lumi, you pick!" stays. ~~Skill path with a Next badge~~ (dropped: felt like a copy of another app and pushed a fixed order). |
| Lesson | **One problem at a time:** Lumi small with its speech bubble, one big problem card with ✓ / ✗. After the last one, the whole sheet is shown with "Done checking". Top: a labelled **🏠 Home** button and the skill, then **notebook tabs** for the lesson's three parts (✓ Check · 💬 Explain · 🤖 Lumi tries) instead of a progress bar and ✕ (changed after owner feedback). |
| Guidance | **Pointing hand** on the next tap (appears when the child hesitates); **Lumi says what to do** (a short spoken + written line for each problem); **progress and small cheers** (the notebook tabs fill in, dots under the card, a soft sound per mark; no streaks or timers). |
| Where it applies | Phones: the Android app and browsers under 768 px wide. Desktop and tablet unchanged. |

## Layout
```
┌──────────────────────────────┐    During a lesson:
│ 🤖 Lumi                 👪   │    ┌──────────────────────────────┐
├──────────────────────────────┤    │ 🏠 Home   ➕ Carrying          │
│ ✓ Check │ 💬 Explain │ 🤖 Tries │
│                              │    │ 🤖 "Is my answer right?"     │
│   screen content, fits       │    │ ┌──────────────────────────┐ │
│   one screen where possible  │    │ │  2 of 5                  │ │
│                              │    │ │   47 + 38 = 75           │ │
│                              │    │ └──────────────────────────┘ │
├──────────────────────────────┤    │   [ ✓ Right ]  [ ✗ Oops ]  👆 │
│ 🏠 Home 🙋 Help 🏘️ Town 🌙 Trip │    └──────────────────────────────┘
└──────────────────────────────┘
```
- **Top bar:** small Lumi + name; 👪 opens the **Grown-ups sheet** (language, report, everything from 🔧 Grown-up settings). Adult actions stay hold-to-confirm.
- **Lesson top bar:** 🏠 Home (asks "Stop this homework?" before leaving), skill chip, notebook tabs for Check / Explain / Lumi tries. Android back during a lesson still sends the app to the background (lesson kept).
- Lumi's Brain is not shown during a phone lesson; the stars are on the Home path.

## Desktop website (agreed with the owner, 2026-11-15)
The website (768 px and wider) follows the same idea of fewer things to click:
- **Header:** the Lumi logo, the dream chip, **☰ Menu / ▲ Hide menu** and one **👪 Grown-ups** button.
- **Nav bar:** Teach Lumi, Practice and Lumi's Town sit in their own bar under the header. The child can hide it with the menu button, and the choice is remembered on the device (`localStorage` key `lumi_nav_open`).
- **Practice:** Opens the first sample as the school-assigned worksheet. The child taps a problem and Lumi helps them work through that problem using backend hints.
- **Grown-ups:** one centred dialog with the language, the grown-up report and every grown-up setting (the same panel as the phone's Grown-ups sheet, `BottomSheet variant="dialog"`). The settings box at the bottom of the page is gone.
- **Lessons take the whole page:** once a skill is picked (warm-up or Lumi's homework), the header, nav bar and Town button hide (`TeachView` `onFocusChange`). Only **← 🏠 Home** stays at the top left; it asks "Stop this homework?" (Keep teaching / Stop) unless the page is finished, then goes Home. The skill picker itself keeps the header and nav bar.

## Must-keep rules this changes (approved by the owner)
- "The worksheet stays near the top on phones; rows never wrap" becomes: on phones, the lesson shows one problem at a time and the whole sheet before "Done checking". Desktop keeps the full sheet.
- Header content moves: tabs go to the bottom bar; language and the report go into the Grown-ups sheet.
Everything else in [04](04-character-ui-and-art.md) "Must keep" still applies: child buttons ≥ 56 px with emoji + 1–3 words, ✓/✗ with words, one clear next action, every spoken line shown as text, hold-to-confirm for adults, no dark patterns, 375 px without sideways scroll.

## Stages
- [x] **A · Shell.** `useIsPhone()`; phone top bar, bottom tab bar, Grown-ups sheet; Home skill path that opens Teach on a chosen skill (gates unchanged: warm-up or Help practice); Android back: tabs → Home, Home → background. Check: every tab reachable, no page scroll on Home at 360 × 800, desktop unchanged.
- [x] **B · Lesson.** Lesson top bar with ✕ + confirm, progress bar; one-problem-at-a-time marking with the keypad for ✗; whole sheet + Done checking at the end; later steps (find, fix, explain, demo, next, done) fitted to one screen. Check: demo sheet end to end on the phone without page scroll in the marking step.
- [x] **C · Guidance.** Pointing hand after 5 s without a tap; short per-problem line spoken and shown; soft sound per mark; progress fills. New lines in en/es/vi. Check: hand appears and hides correctly; lines in all three languages.
- [x] **D · Help, Town, Journey.** Fit Help (camera, samples) and the town tabs into the phone frame. Check: each fits or scrolls only inside the content area.
- [~] **E · Test and document.** Browser at 360 × 780 and the emulator at 412 × 867 done; docs 04, 05, 08 updated. Still to do: the owner's phone.

## What was built
- `platform.ts` `useIsPhone()`; `components/phone/` `PhoneTabBar`, `BottomSheet`, `PointHand` + `useIdle`; `views/PhoneHome.tsx`; phone branches in `App.tsx` (frame, Grown-ups sheet, phone Help), `TeachView.tsx` (`phone`, `startWith`, `onExit`) and `TownPage.tsx` (`phone`, `showBack`); `sounds.pop`; new strings in en/es/vi.
- **Home (Lumi's Brain):** 12 skill lights, any order; brightness and three dots show stars; 🏃 / 🙋 badges show a skill needs the warm-up or Help practice first (the gate runs after tapping, as before). "🎲 Lumi, you pick!" below.
- **Lesson:** one card per problem ("2 of 5"), dots to go back, ✓ / ✗ at the bottom, keypad on ✗; the whole sheet + Done checking at the end; later steps show only the problem being discussed; the demo bubble drops the steps already on the card. ✕ asks "Stop this homework?".
- **Guidance:** the hand appears after 5 s without a tap, only on a single next action (Next) or centred between ✓ and ✗, never leaning toward an answer or a skill. Lumi's per-problem lines: "Did I get this one right?", "Oops! What should the answer be?", "All checked! Tap Done checking." Soft `pop` per mark (same sound for ✓ and ✗).
- **Practice (phone):** assigned worksheet with tappable problem rows and a Hint please button.

## Test results
| Check | Browser 360 × 780 | Emulator 412 × 867 | Phone | Notes |
|---|---|---|---|---|
| Home: Lumi's Brain, any skill, fits one screen | ✅ | ✅ | not run | 360 × 780 and 412 × 867, no scrolling. |
| Tabs: Home, Help, Town, Journey | ✅ | ✅ (labels) | not run | Labels fit in en/es/vi. |
| Grown-ups sheet: language, report, settings, demo | ✅ | ✅ (language) | not run | |
| Demo lesson end to end | ✅ | not run | not run | Marking, keypad, sheet, explain, demo, Next, trophy; no page scroll at any step. |
| Warm-up gate (Sharing) | not run | ✅ | not run | Fits one screen. |
| ✕ → Stop this homework? | ✅ | not run | not run | |
| Help: start → sample → photo view | ✅ | not run | not run | |
| Server asleep | — | ✅ | not run | Render took 12 s to wake; Home showed Try again, which then worked. |
| Desktop unchanged | ✅ | — | — | Console clean. |

## Log
- 2026-11-15: desktop website: hideable nav bar, one Grown-ups dialog (language, report, settings), and full-page lessons with a top-left Home button and a stop check. Checked in headless Edge at 1256 px.
- 2026-11-14 · Decisions agreed with the owner; plan written.
- 2026-11-14 · Stages A–D built and checked in the browser at phone size and on the emulator; desktop unchanged. Owner's phone not connected yet.
- 2026-11-14 · Owner feedback: "looks like a Duolingo clone" and kids should choose any skill. Replaced the path with Lumi's Brain (free choice, no suggested skill) and the progress bar + ✕ with a 🏠 Home button and notebook step tabs. Checked in the browser and on the emulator.
- 2026-11-14 · Bug from the owner: on a skill that needs Help practice first, Lumi said "Tap Help me" but the phone lesson showed only loading dots (the server sends no worksheet in that step). Fixed: the practice step now shows a **🙋 Help me** button (same words as Lumi's line, en/es/vi) right under the bubble, with the pointing hand; tapping it opens Help. Checked on the emulator.
