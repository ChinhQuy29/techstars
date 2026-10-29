import { motion } from "framer-motion";
import { useState } from "react";
import { CONCEPT_EMOJI, TEACHABLE, type Strings } from "../i18n";

/** One star that can be empty, half or full. */
function Star({ fill, pop }: { fill: 0 | 0.5 | 1; pop: boolean }) {
  return (
    <motion.span
      className="relative inline-block text-3xl leading-none"
      animate={pop ? { scale: [1, 1.6, 1], rotate: [0, -15, 0] } : { scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <span className="text-slate-200">★</span>
      <span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fill * 100}%` }}>
        ★
      </span>
    </motion.span>
  );
}

/** "Lumi's Brain": per-concept stars that rise only from the child's teaching (docs/02-learning-design.md). */
export default function LumiBrain({ mastery, popConcept, s }: { mastery: Record<string, number>; popConcept: string | null; s: Strings }) {
  const [all, setAll] = useState(false);
  // Twelve skills is a lot for a small card: show what Lumi has learned (at least four rows), the rest on demand.
  const taught = TEACHABLE.filter((c) => (mastery[c] ?? 0) > 0 || c === popConcept);
  const shown = all ? TEACHABLE : taught.length >= 4 ? taught : [...taught, ...TEACHABLE.filter((c) => !taught.includes(c))].slice(0, 4);
  return (
    <div className="w-full rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 p-4 ring-1 ring-violet-100">
      <h3 className="mb-2 text-lg font-extrabold text-violet-700">
        🧠 {s.lumisBrain} <span className="text-sm font-semibold text-violet-400">· {s.thisSession}</span>
      </h3>
      <ul className="space-y-1">
        {shown.map((c) => {
          const v = mastery[c] ?? 0;
          return (
            <li key={c} className="flex items-center justify-between gap-2">
              <span className="text-base font-semibold text-slate-700">
                <span className="mr-1">{CONCEPT_EMOJI[c]}</span>
                {s.concepts[c]}
              </span>
              <span className="flex gap-0.5" aria-label={`${v} of 3 stars`}>
                {[0, 1, 2].map((i) => (
                  <Star key={i} fill={v >= i + 1 ? 1 : v >= i + 0.5 ? 0.5 : 0} pop={popConcept === c && v > i && v <= i + 1} />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {shown.length < TEACHABLE.length || all ? (
        <button className="btn-small mt-2 bg-white/70 text-violet-700" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? `▲ ${s.fewerSkills}` : `▼ ${s.allSkills}`}
        </button>
      ) : null}
    </div>
  );
}
