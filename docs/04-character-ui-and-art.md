# 04 · Character, UI and art

## Lumi
- A small friendly robot; a curious, kind, slightly goofy peer, a bit younger than the child. Never a lamp, a human in costume, a generic chatbot icon, a lecturer, or a guilt-tripper.
- **Fixed features:** rounded white head and compact body; navy face screen `#0F2D3D`; big glowing cyan eyes and mouth `#6FE7EC`; teal ear panels and chest light `#4FC3C7`; small orange antenna tip `#FFB347`; short rounded limbs, arms in front of the body. Palette in `LUMI_COLORS` (`lumiAssets.ts`). Reference: `docs/assets/lumi-robot-mascot-design-reference.png` (the written features win).
- **One renderer:** `components/mascot/LumiMascot.tsx` on every screen. `lumiAssets.ts` maps emotion → expression (unknown → `default`); `RASTER_ASSETS` can swap in WebP art per expression. Gallery at `/?mascot=gallery`. Usage: [mascot README](../frontend/src/components/mascot/README.md).

| Emotion | Expression | When |
|---|---|---|
| idle | default | welcome, Help idle |
| happy | happy | intro, fix accepted, scene done |
| curious | curious | "why?", find, are you sure |
| confused | confused | wrong fix/explanation, unreadable page |
| thinking | thinking | request in flight, demo steps, scene in progress |
| listening | listening | mic open |
| encouraging | encourage | role switch, try again |
| celebrating | celebrate | a star earned or sheet done, never for a click |
| sleeping | sleeping | Help after 60 s idle |

The expression follows backend state; it never decides anything. Animations are short (150–350 ms): blink, one wave, small bounce, thinking dots. Static under reduced motion.

## Design rules
### Must keep (any design)
- **Two audiences:** playful and easy for children; polished and trustworthy for parents. *Playful where the child acts, polished everywhere.*
- **Professional bar:** one design system (type scale, 4/8 px spacing, small palette with Lumi's colors as anchor, consistent radii, shadows and control states); white space and alignment; at most one or two playful accents per screen; crisp numerals; no layout shift; loading states, never blank waits; calm, structured adult screens; honest copy, no fake badges.
- **Child buttons ≥ 56 px with an emoji + 1–3 words** (the emoji carries the meaning for non-readers; don't swap for line icons). Pressed feedback; nothing hover-only; big keypad keys.
- Right/wrong never by color alone (✓/✗ + words). One clear next action per step. Every spoken line also shown as text. Lumi's handwriting visibly differs from app text. Rows never wrap. On phones the lesson shows one problem at a time and the whole sheet before Done checking ([10](10-mobile-ui.md)).
- Grown-up controls in a collapsed **🔧 Grown-up settings** panel (on phones, inside the 👪 Grown-ups sheet); adult actions are hold-to-confirm (`HoldButton`, 1.5 s, mouse/touch/Enter/Space). Every error offers Try again / Start over. Celebrate only real achievements. No dark patterns.
- Accessibility: contrast ≥ 4.5:1, visible focus, full keyboard use, reduced motion, 375 px with no horizontal scroll, tablets, decorative art `aria-hidden`, captions `aria-live`.
- No text or numbers inside artwork.

### Current style (may be redesigned)
Sky-to-cream background (`#dff3ff` → `#fdf6dc`); white rounded cards; fonts `Baloo 2` (UI) and `Patrick Hand` (Lumi's handwriting); tokens `--color-sun #facc15`, `--color-ink #0f172a`; `.card`, `.btn-kid` (56 px, 3D press shadow), `.btn-small`, `.notebook` (rule lines + red margin), focus ring `4px #38bdf8`; green right / orange wrong; confetti + WebAudio sounds.

### Design skills
With a skill like `ui-ux-pro-max`: describe a learning app for ages 6–10 that must also look professional to parents; ask for a restrained full design system; apply it to the current style only; must-keep rules win (it discourages emoji icons and allows 44 px targets); keep the mascot and town art.

## Screens
Content and order are required; arrangement may change. **Phones** (under 768 px and the Android app) use the layout in [10](10-mobile-ui.md): a bottom tab bar (Home · Help · Town · Journey), Lumi's Brain as Home (any skill, any order), one-problem-at-a-time lessons with notebook step tabs, and a Grown-ups sheet holding the language picker, report and settings.
- **Header:** logo · tabs Teach Lumi / Help me / Lumi's Town · language picker (names, not flags) · 👪 Grown-ups.
- **Welcome:** "Hi! I'm Lumi", waving mascot, two big choices, "Welcome back!" with saved progress.
- **Teach:** Lumi area (mascot, speech bubble, Lumi's Brain) + Lumi's Homework notebook + an action area by step: `mark` Done checking · `fix`/`help` keypad + Tell Lumi · `find` tap the mistake · `explain` mic, chips, I'm not sure, type why · `demo` steps + 👍/🤔 · `sure` ✅/❌ · `next` Next (+ new-place banner) · `done` trophy, More homework, report · `practice_first` Practice with Lumi + hold "try anyway". Plus 🏘️ and the recovery card. Narrow: Brain moves below the worksheet.
- **Help:** Lumi + captured photo with circles; camera card (Turn on camera, Check my work, Hint please, Talk to Lumi); Try a sample.
- **Grown-up settings:** session id, mode/model, demo worksheet, delete session, save/delete progress (hold), camera source + QR, Auto-snap, voice trigger, trigger debug, privacy note.
- **Report:** adult audience: calmer, denser, plain-language metric notes, printable.

## Languages and speech
`src/i18n.ts` (en defines the shape; es/vi typed against it). Backend templates must share keys across languages (tested). Web Speech API for TTS and recognition (Chrome best); listening stops after 12 s. Mic denied → remembered, auto-listen off, "Mic is off — tap a card", chips and typing carry on.

## Town art
- **Source:** 31 PNGs in `docs/assets/town/` (provenance: `SOURCE.md`; generation prompt: `PROMPT.md`). Never edit them.
- **Served copies:** `python scripts/town_art.py` (needs Pillow) writes trimmed, resized WebP files to `frontend/public/assets/town/<name>.webp` (≈ 1.7 MB total vs ≈ 39 MB source) and regenerates `components/town/townArtFiles.ts`, the list of files that exist, so the app never requests a missing one. Sprites delivered without transparency (e.g. `lumi_happy`) get their edge background cleared. Rerun it after adding or replacing art.
- **Slots** (`components/town/townArt.tsx`, `<TownArt name fallback>`): `town_background`; `scene_background_{lemonade,change,coinjar,bakery}`; `shop_{lemonade,change,coinjar,bakery}_{open,closed}`; `lumi_{happy,thinking,waving,celebrating,confused}`; `customer_{bunny,bear,cat,duck}_{waiting,happy}`; `prop_{coin,lemonade_cup,cookie,cookie_tray,sparkle}`.
- **Where they go:** map = `town_background` + `shop_*_open|closed` (closed are dimmed with the code CLOSED sign and padlock on top) + `lumi_waving` (`lumi_confused` during a teaser); scene = `scene_background_*`, the open shop (the Coin Jar scene uses the jar shop itself, with the count on a code tag), `lumi_thinking` → `lumi_happy`, `customer_*_waiting` → `_happy`, coin/cup/cookie/tray props, sparkles around the answer badge. `lumi_celebrating` is mapped but not used yet. On phones the map shows only emoji labels (names are in the button row).
- **Fallback:** a file missing from the list, or one that fails to load, shows the SVG drawing instead (the map also switches to the drawn layout positions), so the town works with none, some or all of the art.
- **Story pictures** (optional): `docs/assets/story/story_<key>.png`, one per scene key (`story_savings`, `story_engineer`, `story_moon_pilot`, …, 16 in all; keys in [03](03-lumis-town.md)), 16:9, no text. The same script converts them; until then each scene shows its emoji on an act-colored sky.
- Tags, coin labels, the board, captions and the answer badge stay in code above the images. The Lumi images are used only in the town; other screens keep `LumiMascot`.
