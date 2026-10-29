import { motion } from "framer-motion";
import type { LumiProblem, TeachOutcome, TeachStep } from "../api";
import type { Strings } from "../i18n";
import MathVisual from "./MathVisual";
import ProblemText, { isSentence } from "./ProblemText";

export interface RowMark { mark: "circle" | "check"; correction?: string }

interface Props {
  problems: LumiProblem[];
  marks: Record<number, RowMark>;
  step: TeachStep;
  outcomes: Record<number, TeachOutcome>;
  focusId: number | null;
  highlightIds: number[];
  editingId: number | null;
  onMark: (id: number, mark: RowMark["mark"]) => void;
  onEdit: (id: number) => void;
  onPick: (id: number) => void;
  s: Strings;
}

const BADGE: Partial<Record<TeachOutcome, [string, string]>> = {
  caught_fixed: ["bg-green-100 text-green-800 ring-green-300", "found"],
  caught_unfixed: ["bg-green-100 text-green-800 ring-green-300", "found"],
  missed: ["bg-orange-100 text-orange-800 ring-orange-300", "missed"],
  false_alarm: ["bg-sky-100 text-sky-800 ring-sky-300", "hmm"],
  confirmed_ok: ["bg-slate-100 text-slate-600 ring-slate-200", "ok"],
};

/** Lumi's notebook page: one row per problem, ✓ / ✗ toggles while marking, outcome badges after. */
export default function LumiHomework(p: Props) {
  const marking = p.step === "mark";
  const finding = p.step === "find";
  return (
    <div className="notebook overflow-hidden rounded-3xl shadow-inner ring-1 ring-amber-200">
      <ol>
        {p.problems.map((pr) => {
          const m = p.marks[pr.id];
          const outcome = p.outcomes[pr.id];
          const focused = p.focusId === pr.id;
          const glowing = p.highlightIds.includes(pr.id);
          const badge = outcome ? BADGE[outcome] : undefined;
          const crossed = m?.mark === "circle";
          // Sentence problems (newer concepts) wrap and may carry a picture; sums stay on one line.
          const sentence = isSentence(pr.problem);
          const answer = (
            <span className="whitespace-nowrap">
              <span className={`relative ${crossed ? "text-slate-400" : "text-indigo-700"}`}>
                {pr.lumi_answer}
                {crossed && <span className="absolute left-[-4px] right-[-4px] top-1/2 h-1 -rotate-6 rounded bg-rose-500" />}
              </span>
              {crossed && m?.correction && <span className="ml-1.5 text-rose-600">{m.correction}</span>}
            </span>
          );
          return (
            <motion.li
              key={pr.id}
              layout
              animate={glowing ? { backgroundColor: ["rgba(251,191,36,0.0)", "rgba(251,191,36,0.35)", "rgba(251,191,36,0.0)"] } : {}}
              transition={glowing ? { duration: 1.4, repeat: Infinity } : {}}
              className={`relative flex items-center gap-3 pr-3 ${sentence ? "min-h-16 py-2" : "h-16"} ${focused ? "bg-yellow-100/80" : ""}`}
            >
              <span className="w-[54px] shrink-0 self-start pt-3 text-center text-xl font-bold text-rose-400">{pr.id}</span>
              <button
                disabled={!finding}
                onClick={() => p.onPick(pr.id)}
                className={`font-hand flex min-w-0 flex-1 flex-col items-start gap-1 rounded-xl px-1 text-left text-slate-800 sm:px-2 ${
                  finding ? "cursor-pointer hover:bg-amber-100" : "cursor-default"
                }`}
              >
                <span
                  className={
                    sentence
                      ? "text-xl leading-snug sm:text-3xl"
                      : "flex items-baseline gap-1.5 overflow-hidden whitespace-nowrap text-[1.6rem] sm:gap-3 sm:text-4xl"
                  }
                >
                  <ProblemText problem={pr.problem} answer={answer} />
                  {focused && !marking && <span className="ml-2 hidden text-3xl sm:inline">👈</span>}
                </span>
                {pr.visual && <MathVisual visual={pr.visual} className="mt-1" />}
              </button>

              {marking ? (
                <div className="flex shrink-0 gap-2 self-center">
                  <button
                    onClick={() => p.onMark(pr.id, "check")}
                    aria-pressed={m?.mark === "check"}
                    className={`btn-kid h-12 !min-h-12 !px-3 ${m?.mark === "check" ? "bg-green-500 text-white" : "bg-white text-green-700 ring-2 ring-green-300"}`}
                  >
                    ✓ <span className="hidden sm:inline">{p.s.right}</span>
                  </button>
                  <button
                    onClick={() => (m?.mark === "circle" ? p.onEdit(pr.id) : p.onMark(pr.id, "circle"))}
                    aria-pressed={m?.mark === "circle"}
                    className={`btn-kid h-12 !min-h-12 !px-3 ${
                      m?.mark === "circle" ? "bg-orange-500 text-white" : "bg-white text-orange-700 ring-2 ring-orange-300"
                    } ${p.editingId === pr.id ? "ring-4 ring-sky-400" : ""}`}
                  >
                    ✗ <span className="hidden sm:inline">{p.s.oops}</span>
                  </button>
                </div>
              ) : (
                badge && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ring-2 ${badge[0]}`}
                  >
                    {p.s[badge[1] as "found" | "missed" | "hmm" | "ok"]}
                  </motion.span>
                )
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
