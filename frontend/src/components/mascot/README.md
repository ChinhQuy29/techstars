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

## Adding raster art later
Put optimized transparent WebP files (200×250 aspect) in `public/assets/mascot/` and register them in `RASTER_ASSETS`, e.g. `happy: "/assets/mascot/lumi-happy.webp"`. That state then renders the image; the others keep the SVG. Generate all poses from one character sheet so the robot doesn't drift.
