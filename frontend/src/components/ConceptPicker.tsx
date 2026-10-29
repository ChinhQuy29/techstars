import { motion } from "framer-motion";
import type { TeachConceptInfo } from "../api";
import { CONCEPT_EMOJI, type Strings, type TeachConcept } from "../i18n";

/**
 * "What do you want to teach Lumi today?" The child picks any skill, in any order.
 * Ready skills go straight to Lumi's homework; others show how they unlock (Help mode or a quick warm-up).
 */
export default function ConceptPicker({ concepts, busy, onPick, onLumiPicks, s }: {
  concepts: TeachConceptInfo[];
  busy: boolean;
  onPick: (c: TeachConceptInfo) => void;
  onLumiPicks: () => void;
  s: Strings;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-2xl font-extrabold text-slate-800">{s.chooseTitle}</h3>
        <p className="text-slate-600">{s.chooseSub}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {concepts.map((c, i) => (
          <motion.li key={c.concept} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <button
              disabled={busy}
              onClick={() => onPick(c)}
              className={`flex h-full min-h-28 w-full flex-col items-center justify-center gap-1 rounded-2xl p-3 text-center shadow-sm ring-2 transition active:translate-y-0.5 ${
                c.ready ? "bg-white ring-amber-300 hover:bg-amber-50" : "bg-slate-50 ring-slate-200 hover:bg-white"
              }`}
            >
              <span className="text-4xl" aria-hidden>{CONCEPT_EMOJI[c.concept]}</span>
              <span className="text-lg font-extrabold leading-tight text-slate-800">{s.concepts[c.concept as TeachConcept] ?? c.label}</span>
              <span className="text-amber-500" aria-label={`${c.stars} of 3 stars`}>
                {"★".repeat(Math.floor(c.stars))}{c.stars % 1 ? "½" : ""}
                <span className="text-slate-200">{"★".repeat(3 - Math.ceil(c.stars))}</span>
              </span>
              <span className={`text-xs font-bold ${c.ready ? "text-green-700" : "text-slate-500"}`}>
                {c.ready ? `🧑‍🏫 ${s.teachThis}` : c.gate === "warmup" ? `🏃 ${s.needsWarmup}` : `🙋 ${s.needsHelp}`}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
      <button className="btn-kid self-center bg-white text-slate-700 ring-2 ring-slate-200" disabled={busy} onClick={onLumiPicks}>
        🎲 {s.lumiPicks}
      </button>
    </div>
  );
}
