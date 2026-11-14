# 11 · Science pilot (proposal)

**Status: proposal, not approved.** Math stays Lumi's main subject. This pilot tests, cheaply, whether "teach Lumi" works for science with ages 5–8 and whether parents want it, before anyone rewrites the app around science. Per [AGENTS.md](../AGENTS.md), a new subject is a proposal until the owner approves it.

## The question the pilot answers
1. Do 5–8-year-olds enjoy correcting Lumi's science mistakes and explaining why, as much as they do in math?
2. Do they understand the idea better afterwards (a quick before/after check)?
3. Would parents choose science over math, or want both?

If the answers are weak, we stop with about two weeks spent. If they are strong, the pilot's format becomes the template for more science topics.

## Topic: Float or sink 🛟
Chosen from the teammate's list because it fits Lumi best:

| Why it fits | |
|---|---|
| **One clear right answer per object** | A rock sinks, a cork floats, so the app can check answers without the AI. |
| **Classic kid misconceptions** | "Heavy things sink, light things float", "small things float", "metal always sinks" (but a metal boat floats). These become Lumi's planted mistakes. |
| **Works with pictures and voice** | No reading needed: each object is a picture, and Lumi reads everything aloud. |
| **Kids can try it at home** | A bowl of water and five objects; parents can join in. |
| **Explaining "why" is age-appropriate** | "It's made of wood", "it has air inside", "it's like a boat". |

Backup topic if we want life science instead: **What living things need** (plants: water, sunlight, soil; animals: food, water, shelter).

## How a pilot lesson works
The same loop as math, with taps and voice instead of numbers:

1. **Lumi's homework:** five picture cards, each with Lumi's guess. "🪨 Rock: floats", "🍎 Apple: sinks"… Two of the five are planted mistakes, each from a known misconception.
2. **Check:** the child taps ✓ or ✗ on each card. For ✗, they tap the right answer (🛟 Floats / ⚓ Sinks) instead of typing a number.
3. **Explain:** Lumi asks "Why does the apple float?". The child says it (🎤), taps a picture chip ("🎈 It has air inside", "🪵 It's made of wood", "⚖️ It's heavy"), or says "I'm not sure".
4. **Lumi tries:** Lumi uses the child's idea on a new object ("You taught me that things with air inside can float, so the 🏀 ball floats!"), and the child confirms 👍 / 🤔.
5. **Stars and a place:** a star in "Float or sink", and a new Town place (a little harbor where Lumi tests toy boats).
6. **Try it at home** (optional, for parents): "Get a bowl of water and test: a spoon, a grape, a cork…"

## Keeping it safe and correct (replacing SymPy)
Math is safe because SymPy decides every answer. Science has no equivalent, so in the pilot **a reviewed content bank decides**:

- **Hand-written item bank** (`backend/app/content/science/float_sink.json`): about 30 objects, each with a picture (emoji first, drawings later), the right answer (floats / sinks in plain tap water), and the reason ids that apply ("air inside", "made of wood", "solid metal", "shape like a boat").
- **Planted mistakes come only from a short list of named misconceptions**, each tied to the objects where it gives the wrong answer. The AI never invents a fact or a mistake.
- **No surprises:** leave out objects whose answer depends on details (a shut vs open bottle, peeled vs unpeeled orange) unless the card says which.
- **Rating an explanation:** chips map to reason ids directly. Spoken or typed answers are first matched to reason ids by fixed keyword rules in en/es/vi. Gemini only rates the free answers against the listed reasons for that object, and can't add a new reason. The existing guards stay: never praise a wrong idea, never give the answer early, use a written line if the AI fails.
- **Review:** an adult (ideally a K–2 teacher) checks every object, answer and reason before any child sees it. The checklist and the reviewer's name go in this doc.
- **Mock mode** works fully without the AI, like math.

## What gets built (about 8–10 working days)
| Stage | Work | Done when |
|---|---|---|
| 1 · Content (2 days) | Item bank (~30 objects), 4–5 misconceptions, reasons, chips and Lumi's lines in en/es/vi; teacher review. | The bank passes a test that checks every object has an answer, a picture and at least one reason, every planted mistake gives a wrong answer, and all three languages are complete. |
| 2 · Backend (2–3 days) | A "science" concept type: worksheet from the bank, marking with Floats/Sinks, explain rating by reason ids, Lumi's new try from the child's reason, stars. Same state machine and safety guards as math. | Tests for each step, plus repeated, stale and out-of-order actions, like math's. |
| 3 · App (2–3 days) | Picture cards and Floats/Sinks buttons in the phone lesson; reason chips with pictures; one "Float or sink" light in Lumi's Brain, behind a grown-up setting **"🧪 Science pilot"** so it's hidden by default. | The full lesson works on the emulator and the phone, with voice, at 360 px. |
| 4 · Town and wrap-up (1 day) | Harbor place (emoji or placeholder art), the "try it at home" card for parents, docs. | Docs 02, 05, 06 and 08 updated; desktop unchanged. |
| 5 · Pilot (1–2 weeks of calendar time) | 5–8 families with children aged 5–8, with parent consent (see [06](06-privacy-and-safety.md)), mock mode or reviewed Gemini. | Results table below filled in. |

## How we measure it
- **Before/after check** (2 minutes, by voice or taps): "Which floats?" for 3 objects that aren't in the lesson, plus "Why?" for one. Done before the lesson and again right after.
- **During the lesson:** how many planted mistakes the child caught, explanations given (spoken, chip or "not sure"), time, and whether they asked for another round.
- **Parents** (3 questions after): Would your child do this again? Science, math, or both: which would you pay for? Anything that worried you?
- **Compare with math:** the same families also do one math lesson, so we can see which one they prefer.

| Family | Age | Before (of 3) | After (of 3) | Caught (of 2) | Explained by | Another round? | Parent's choice |
|---|---|---|---|---|---|---|---|
| — | | | | | | | |

## Risks
- **Wrong science content** reaching a child → teacher review, a fixed item bank, and no AI-made facts.
- **Five-year-olds can't read** → pictures, Lumi reading everything aloud, voice and big buttons; test the youngest children first.
- **Speech recognition with young voices** → chips always work; test with real children before relying on voice.
- **It distracts from math** → hidden behind a grown-up setting, 2 weeks of work at most, and a clear stop/go decision at the end.

## Decisions for the owner
1. Topic: **Float or sink** (recommended) or "What living things need"?
2. Who reviews the content (a teacher contact, the KU lab, a parent who teaches)?
3. Ages for the pilot: 5–8 only, or 5–10 so it overlaps with the math families?
4. Start now, or after the parent interviews about which subject parents want?
