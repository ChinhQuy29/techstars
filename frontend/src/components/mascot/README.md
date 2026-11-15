# Lumi mascot

Lumi is a small, friendly **robot learning companion**: a curious peer the child teaches, never a teacher, a lamp, or a generic chatbot icon. Design rules: [`docs/04-character-ui-and-art.md`](../../../../docs/04-character-ui-and-art.md). Visual direction: [`docs/assets/lumi-robot-mascot-design-reference.png`](../../../../docs/assets/lumi-robot-mascot-design-reference.png). The reference is inspiration only; the written rules win.

## Files
- `LumiMascot.tsx`: the **only** mascot renderer. Every screen uses it (header, welcome, Teach, Help, report).
- `lumiAssets.ts`: the central mapping: palette, expression → drawing spec, app emotion → expression, missing → `default`, optional raster slots.

## Usage
```tsx
<LumiMascot expression={expressionFor(turn.emotion)} pose="threeQuarter" talking={speech.speaking} label="auto" className="w-40" />
```
- `expression`: `default | happy | curious | confused | thinking | listening | celebrate | encourage | sleeping`. Unknown values fall back to `default`.
- `pose`: `front` (avatar, report, header) or `threeQuarter` (conversation). The spec's optional `side`/`back` views aren't used in the app and aren't drawn.
- `size`: `xs | sm | md | lg | hero` fixed widths, or pass responsive widths in `className`. The 200×250 box never changes, so switching expressions causes no layout shift.
- `label`: omit for decorative use (`aria-hidden`); `"auto"` reads the expression's description; or pass your own text. Correctness is always shown in text and ✓/✗ too, never by the mascot alone.
- `animated` (default true): blink, one gentle `wave`, a short celebrate bounce, thinking dots. With `prefers-reduced-motion` (or `animated={false}`), every state renders as a static pose.

## Expression ↔ learning state
| App emotion (backend / Help flow) | Expression | Where |
|---|---|---|
| `idle` | `default` | welcome, Help idle |
| `happy` | `happy` | worksheet intro, child's fix accepted |
| `curious` | `curious` | "Why is 75 wrong?", find-the-mistake, "Are you sure?" |
| `confused` | `confused` | wrong fix / wrong explanation, can't read the page |
| `thinking` | `thinking` | any request in flight; Lumi's demo steps until the answer shows |
| `listening` | `listening` | microphone open |
| `encouraging` | `encourage` | hints after a role switch, "try again" moments |
| `celebrating` | `celebrate` | a star actually earned (`mastery_up`), sheet finished. Never just for a click |
| `sleeping` | `sleeping` | Help mode after 60 s idle |

The expression follows state the backend already decided. It never decides anything.

## Provenance and license
Original vector artwork written in code for this project (no third-party images, fonts or icon packs in the mascot). Drawn to match the reference sheet's stable features: rounded white head and compact body, navy face screen `#0F2D3D`, glowing cyan eyes and mouth, teal ear panels and chest light `#4FC3C7`, orange antenna tip `#FFB347`, short rounded limbs. The favicon `public/lumi.svg` is a simplified head of the same drawing.

## Figma poses (what the app shows)
The app shows the blue robot from the Figma file **Lumi**, page **new**. Each pose is exported as an SVG into `public/assets/mascot/` and listed in `RASTER_ASSETS`. The drawn white robot above is only a fallback if a file fails to load.

| Figma frame (node) | File | Used for |
|---|---|---|
| Character (`20:1903`) | `lumi-waving.svg` | default, listening |
| excited (`20:2364`) | `lumi-excited.svg` | happy, celebrate, encourage |
| thinking (`20:2516`) | `lumi-thinking.svg` + "hmm" | thinking; curious (no "hmm") |
| confused (`20:2439`) | `lumi-confused.svg` + "?" | confused |
| sleeping (`20:2310`) | `lumi-sleeping.svg` + "Z z" | sleeping |
| sad (`18:1366`) | not used | Lumi never makes a child feel they upset it |

**Exporting a new or changed pose:**
1. Export the frame as SVG.
2. Delete the background `<rect>` (the frames have a dark fill).
3. Make the file ids unique (`paint0_linear_<file>`).
4. Set the viewBox to the shared 342×353 canvas, with the foot shadow's centre at (171, 332), so Lumi never jumps when the mood changes (`ARTWORK_SIZE`).

The "?", "hmm" and "Z z" are drawn by `LumiMascot` beside the head (`ARTWORK_EXTRAS`), not baked into the files. The Figma poses don't blink or move their mouths.

Still needed from Figma: a **listening** pose and a **curious** pose. Also check whether the antenna colour changing per pose is intended.
