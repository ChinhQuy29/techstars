# 03 · Lumi's Town

Why kids come back. **Every skill the child teaches lets Lumi *do* something new, using exactly that math.** Lumi's dream: "I'm saving up to open a shop in Lumi's Town! Every skill you teach me opens a new place." The reward is seeing your impact on a friend, not points (protégé effect, overjustification effect, SDT; see [01](01-product-vision.md)).

## Places
| Concept | Place | Scene |
|---|---|---|
| `carry` | 🍋 Lemonade Stand | customer buys lemonade (a¢) + cookie (b¢); Lumi adds with carrying |
| `borrow` | 🪙 Change Counter | customer pays a¢ for a b¢ treat; Lumi makes change with borrowing |
| `off_by_one` | 🫙 Coin Jar | Lumi adds or spends coins, counting carefully |
| `mul` | 🍪 Bakery | a trays of b cookies, skip-counted |

- **Locked:** greyed, CLOSED sign + padlock, "Teach Lumi carrying to open it"; tapping plays a funny teaser with a real `diagnose()`-verified mistake ("Last time I said 47 + 38 = 75. Oops! I need a teacher.").
- **Unlocked:** Visit plays the scene; **🔄 Another customer!** gives fresh numbers.
- **Lumi's Scrapbook:** per taught concept: emoji, skill, stars, and the child's own words ("You taught me: …").

## Rules
1. **All math from the backend:** numbers from `_make(concept, planted=False)`, narration from `demo_steps()`, answer from SymPy, every displayed digit from `town.parts()` (asserted against SymPy). No arithmetic in the browser.
2. **Unlock at ≥ 1 star** (`UNLOCK_STARS = 1.0`): one `concept` explanation or two correct teachings; a chip (½) isn't enough. Stars still move only at demo confirmation.
3. **No dark patterns:** no guilt, streaks, timers, leaderboards, purchases or random rewards.
4. **Read-only:** never changes stars or quotes.
5. **No new data** beyond a visit count per place (seeds fresh problems).

## Where it appears
- Study Town is the opening view and the first mode tab. The 🏘️ button on the Teach screen still opens Town. TeachView stays mounted (hidden) in Town so a worksheet survives; **📒 Back to homework** returns. Leaving to Help or Welcome resets it.
- On Teach `next`, when a concept just reached 1 star: "🎉 New place in Lumi's Town: 🍋 Lemonade Stand!" → Visit opens that scene.
- Welcome: "Welcome back! Lumi remembers…" with saved progress.

## As built
- **Map** (`components/town/StudyTown.tsx`): a large game viewport with Art, Math, English, Biology, and Astronomy houses. Use the arrow keys, WASD, the on-screen arrows, or tap the road. The camera follows Lumi horizontally. The in-map subject shortcuts guide Lumi to the same doorways. An end gate closes off the upcoming area.
- **House menus:** Reaching a door opens its popup. Math uses the existing Teach Lumi skill picker and starts the existing lesson flow with the chosen dream and readiness gate. The other houses display planned topics. Town movement and house selection stay in memory.
- **XP:** The five marks count distinct skills with teaching credit across Town, capped at five. The bar follows the current session and any opted-in saved progress attached to it. Math is the first subject with lessons.
- **Town extras** (`views/TownPage.tsx`): the in-map controls open Scrapbook, Journey on desktop, and paused homework when available. Existing skill scenes still open through their lesson links.
- **Map assets:** `frontend/public/assets/map_asset/walking-terrain.png` is the 3840 × 1280 Spring Grove Walking Terrain export from Figma. The game shows it at 1920 × 640 and mirrors a section of its right edge to extend the road and forest. The house PNGs are existing Spring Grove components from the same Kenney CC0 kit. The assembled map and road exports are also available in the asset folder.
- **Character assets:** Edit `map_asset/character_asset/lumi-walk.svg` and export over `lumi-walk.png` to replace the sprite. Keep the transparent 480 × 480 sheet, 160 × 160 cells, rows for down/right/up in that order, and foot anchor at (80, 137) in each cell. Columns are step A, standing, and step B, and the right row mirrors for left. The stylesheet holds the map crop and sprite display size.
- **Scene** (`components/town/SkillScene.tsx`): a 16:9 picture, then the math board and captions. One caption every 1.8 s; picture, board and captions share one `stage`.
  - Lemonade: price tags 🍋 a¢ / 🍪 b¢; register board fills ones, pops the carried 1, then tens and total; coins slide to Lumi.
  - Change Counter: "💰 Paid a¢ / 🍬 Costs b¢"; the board crosses out the tens digit and writes the borrowed digits (e.g. 4→3, 6→16), then the change; coins slide back.
  - Coin Jar: the jar fills or empties; its label changes from a to the answer.
  - Bakery: trays appear one by one with the running count (b, 2b … a·b), echoed on a chalkboard.
  - End: green "answer ✓" badge, happy customer (bunny/bear/cat/duck, chosen from the problem) with "Thank you, Lumi!", Another customer!. Lumi `thinking` while working, `happy` at the end. Captions are `aria-live`.
- `ColumnBoard` looks: `register`, `jar`, `chalk`; it only displays digits it receives.
- **Art:** the 31 illustrations (backgrounds, shops open/closed, Lumi poses, customers, props) are the primary visuals, with the SVG drawings (`Buildings`, `Critter`, `LumiMascot`) as fallback. See [04 · Town art](04-character-ui-and-art.md).
- Verified: 33¢+58¢ → 91¢ (carry 1); 46¢−38¢ (4→3, 6→16) → 8¢; Coin Jar 78; 5×8 → 8, 16, 24, 32, 40. Works at 375 px.

## API
- `POST /api/teach/town {session_id, language}` → `{dream, unlock_stars, places[{concept, name, emoji, stars, unlocked, need, teaser}], scrapbook[{concept, label, quote, stars}]}`.
- `POST /api/teach/scene {session_id, language, concept}` → `{concept, unlocked, title, problem, lines[], answer, say, parts}`; locked → teaser, no math. Fresh problem per visit (seed: session + concept + visit). Logs `town_scene {concept, visit}`.

`parts`: `op` (+ − *), `a`, `b`, `answer`; for + −: `a_digits`, `b_digits` ([tens, ones]), `regroup`, `ones`, `tens`; for − with borrowing: `borrow_tens`, `borrow_ones`; for ×: `seq`.

## Lumi's Journey to the moon (built)
A choices-matter story on the Town page's **🌙 Lumi's Journey** tab (`services/story.py`, `components/town/Journey.tsx`). What the child teaches, in any order, decides how Lumi gets to the moon.

- **Starts** once two Town shops are open. Lumi: "What you teach me decides how I get there."
- **Three acts, four versions each.** A version opens when **both** of its two concepts have ≥ 1 star. Every concept appears in exactly two versions.

| Act | Versions (concept pair) |
|---|---|
| 1 · Getting ready | 🐷 Counting the savings (carrying + borrowing) · 🍪 The bake sale (times tables + sharing) · 🔭 The star map (patterns + big numbers) · 🗳️ The town vote (bar graphs + careful counting) |
| 2 · Finding a way (the path) | 🛠️ Engineer (measuring + shapes) · 🥁 Musician (patterns + fractions) · 🔬 Scientist (bar graphs + sharing) · ✈️ Pilot (time + big numbers) |
| 3 · The journey | 🎒 Packing supplies (times tables + fractions) · ⏰ The launch window (time + borrowing) · 🔧 Trouble in space (measuring + carrying, a setback) · 🧭 Finding the way (big numbers + careful counting) |
| 4 · The moon | one ending per path (rocket it built, a concert, a moon rock, a pilot's salute), plus the child's own quotes for the concepts on the way |

- **Choices:** acts go in order; opening an open version of the current act chooses it. When several are open, Lumi says "I have more than one idea! Which one should I try?". 4 × 4 × 4 = 64 storylines from 16 scenes.
- **Mystery cards:** unopened versions show ❓ and only the concepts already taught (e.g. 📏 + ❔), so the child can guess what to teach next. Future acts read "Coming later".
- **What if…?:** after an act is chosen, its other versions can still be watched (labelled "What if…?") once both concepts are taught. They never change the chosen path.
- **Notifications:** a teaching turn that opens an unseen scene (or the ending) adds `unlocks[{kind: "story"}]`; the Teach screen shows "🎉 New story scene: …" with **Visit**, which opens that scene.
- **Rules:** read-only (never changes stars); every number in a scene is computed in `story._numbers()` (tested); lines in en/es/vi with big numbers in each language's format; gentle sadness only in setbacks (the star map's distance, the pilot's nerves, the launch, trouble in space), always followed by recovery.
- **Scenes:** a picture (`story_<key>` art if present, else the version's emoji on an act-colored sky), Lumi's expression per line, one line every 2.6 s, spoken; "Next" skips ahead.
- **Saved progress:** the chosen version per act and scenes seen (`story` in the whitelist).
- **API:** `POST /api/teach/story {session_id, language}` → `{started, say, current_act, acts[{act, title, chosen, versions[{key, state: chosen|available|what_if|partial|locked|later, emoji, title, concepts, concept_labels, seen}]}], ending}`; `POST /api/teach/story/scene {session_id, language, key}` → `{key, act, title, emoji, lines[{emotion, text}], what_if, what_if_label}`, 409 `scene_locked`.

## Roadmap
- [x] T1 places, locks, teasers, dream · T2 illustrated scenes with backend digits · T3 scrapbook · T4 new-place banner · T5 opt-in saved progress
- [ ] T6 gentle refreshers: after a few days Lumi asks "Can you remind me how to carry?" (curiosity, never loss; places stay open)
- [ ] T7 chapters: places grow with stars; the child picks the next goal
- [x] Lumi's Journey to the moon (above), with placeholder pictures
- [ ] Story art: one picture per scene (`docs/assets/story/story_<key>.png`)
- [ ] T8 pilot: town vs. stars-only on return and explanation quality

**Watch for** kids rushing explanations to unlock places (falling share of `concept`).
