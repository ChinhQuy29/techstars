# 01 · Product vision

## What Lumi is
A friendly software robot that is learning elementary math; **the child (6–10) is its teacher.** Lumi brings homework with deliberate, verified mistakes; the child finds, fixes and explains them; Lumi applies the lesson to a new problem; a parent sees the child's own explanation.

**Goal:** children who *understand* math and *want to come back*, in a product that is kid-friendly for the child and polished and trustworthy for the parent. Success = voluntary return, better explanations over time, better performance on *new* problems, and parents who can explain what the report told them.

## Why
- AI homework apps hand out answers; Socratic tutors feel like obstacles; many parents can't help; tutoring is expensive.
- When a child teaches, there is no answer to beg for. Research basis:

| Finding | Design rule |
|---|---|
| Protégé effect: students try harder for a teachable agent, esp. lower achievers (Chase 2009) | Lumi is a likeable, slightly younger peer |
| Kids learn when the robot *visibly* learns (Chandra 2020) | Stars rise only from teaching; Lumi's Town shows new abilities |
| Watching your pupil apply what you taught exposes gaps (Okita & Schwartz 2013) | Lumi solves a new problem "like you taught me" |
| Explaining *why* drives learning (Roscoe & Chi 2007) | "Why?" follow-ups; explanation quality drives stars |
| Child tutors need support (Matsuda 2013); adaptive roles help (Chen 2020) | Readiness gate; role switch to hints when teaching goes wrong |
| Tangible rewards can lower interest (Lepper 1973); SDT (Deci & Ryan) | No coins, points or streaks; competence, relatedness, autonomy |
| Attitude gains differ from learning gains (Pareto 2014) | Measure them separately |

The learning benefit is a **hypothesis to test**, never a marketing claim.

## The differentiating sequence
Verified mistake → child marks it → child explains why → Lumi responds safely to weak or wrong explanations → Lumi solves a *different* problem of the same concept → child confirms → parent report with evidence → Lumi's Town shows what the teaching enabled. Mistakes target concepts the child showed in Help mode (not yet their *exact* mistakes; don't claim that). SymPy checks every number. Works fully offline in mock mode. English, Spanish, Vietnamese.

## Users
- **Child 6–10:** big buttons, little reading, voice optional, never shamed, always a way forward.
- **Parent:** the buyer; needs honest evidence, privacy, little setup, a polished product.
- **Later:** teachers (no extra workload), the KU HRI lab (pilot data).

## Lumi is not
A lecturing teacher, a general chatbot, an answer machine, a replacement for adults, a guilt-tripping character, or hardware. The project began as a "homework lamp" camera; that idea is dropped. No lamps, bulbs, LEDs or devices in product, branding or UI.

## Positioning
> Lumi helps elementary students understand math by letting them teach a friendly robot that makes mistakes, asks why, and applies what the child teaches it.

Never claim: answers any homework, replaces teachers, guaranteed grades, "proven", or "first ever" learning-by-teaching. Competitors (Lathoa, Glitch Detectives, Feynman-style apps) are small and pre-revenue; Lumi's edge is the reliable loop, verified math and evidence. Pitch material lives outside the repo (`D:\Techstars\lumi-pitch-notes.md`).

## What to validate
- **Learning:** for ready children, does Teach beat Help on understanding and transfer? (Pilot: [06](06-privacy-and-safety.md).)
- **Business:** will parents pay for understanding plus evidence? Ask about current behavior first, offer a concrete pilot and price, track real sign-ups, return and payment, and interview families who leave.
- **Promising signals:** kids get "you're the teacher" without long instructions, finish sessions alone, explain in their own words, do better on new problems, and return voluntarily; parents value the report. Report failed sessions too.

## Long-term vision (not in scope; needs owner approval)
**Every learner teaches their own Lumi**, from elementary school to college and beyond, and **Lumi's dream is to go to the moon.** Each taught concept acts like a choice in a story game: it moves Lumi down a different path (engineer, pilot, scientist, performer…), but every path ends on the moon, so nearly every learner sees a different story that proves Lumi learned from *them*. Lumi's Town is chapter 1 (the shops earn money for the trip).

Rules for when it's built:
- Written story beats unlocked by **rules** ("any two building concepts at 1 star"), not exact combinations; 40–60 beats cover it.
- People write beats; AI may only polish wording.
- A beat needs real teaching (a full star); concepts are offered only when the learner is ready; the story never changes stars.
- No pressure to return: no streaks, no "Lumi misses you".
- Young kids see a few ready concepts; older learners see a concept map.
- Invented characters only, no real people.
- Expand subjects **in order of verifiability**: middle-school math → high-school math and formula physics → college topics only where answers can be checked automatically or content is expert-written. Older learners need an older tone.

## Do / don't
**Do:** keep Teach Lumi the hero; deterministic math and state; short, recoverable interactions; voice optional; measure transfer and return; keep the no-key path working; test with children only with consent.

**Don't:** become a chatbot; copy competitor features; make kids watch long AI explanations; reward speed, streaks or taps; let an LLM decide math, reveals, mastery or flow; let it praise wrong reasoning; call stars "mastery"; build hardware; add topics before the four concepts are solid; require a mic, camera or paid key; collect more data than needed.
