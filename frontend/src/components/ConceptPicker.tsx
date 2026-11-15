import { motion } from "framer-motion";
import type { TeachConceptInfo } from "../api";
import { CONCEPT_EMOJI, type Strings, type TeachConcept } from "../i18n";

/**
 * "What do you want to teach Lumi today?" The child picks any skill, in any order.
 * Each skill opens a choice between teaching and Help.
 */
export default function ConceptPicker({ concepts, busy, onPick, onLumiPicks, s }: {
  concepts: TeachConceptInfo[];
  busy: boolean;
  onPick: (c: TeachConceptInfo) => void;
  onLumiPicks: () => void;
  s: Strings;
}) {
  return (
    <div className="lumi-skill-picker flex flex-col gap-4">
      <div>
        <h3 className="text-2xl font-extrabold text-slate-800">{s.chooseTitle}</h3>
        <p className="text-slate-600">{s.chooseSub}</p>
      </div>
      {concepts.length === 0 && (
        <p className="animate-pulse self-center py-6 text-4xl tracking-widest text-slate-300" aria-label="loading">
          • • •
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {concepts.map((c, i) => (
          <motion.li key={c.concept} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <button
              disabled={busy}
              onClick={() => onPick(c)}
              className={`flex h-full min-h-28 w-full flex-col items-center justify-center gap-1 rounded-2xl p-3 text-center shadow-sm ring-2 transition active:translate-y-0.5 ${
                c.ready ? "bg-indigo-50 ring-indigo-300 hover:bg-indigo-100" : "bg-white ring-indigo-100 hover:bg-indigo-50"
              }`}
            >
              <span className="text-4xl" aria-hidden>{CONCEPT_EMOJI[c.concept]}</span>
              <span className="text-lg font-extrabold leading-tight text-slate-800">{s.concepts[c.concept as TeachConcept] ?? c.label}</span>
              <span className="text-amber-500" aria-label={`${c.stars} of 3 stars`}>
                {"★".repeat(Math.floor(c.stars))}{c.stars % 1 ? "½" : ""}
                <span className="text-slate-200">{"★".repeat(3 - Math.ceil(c.stars))}</span>
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
      {concepts.length > 0 && (
        <button className="btn-kid self-center bg-white text-slate-700 ring-2 ring-slate-200" disabled={busy} onClick={onLumiPicks}>
          🎲 {s.lumiPicks}
        </button>
      )}
    </div>
  );
}
