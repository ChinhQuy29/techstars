import { motion } from "framer-motion";
import type { Emotion, GradeResponse, Language } from "../api";
import MistakeOverlay from "../components/MistakeOverlay";
import { pretty, t } from "../i18n";
import LumiMascot from "../components/mascot/LumiMascot";
import { expressionFor } from "../components/mascot/lumiAssets";

interface Props {
  emotion: Emotion;
  talking: boolean;
  bubble: string;
  phase: string;
  captureUrl: string | null;
  result: GradeResponse | null;
  focusId: number | null;
  language: Language;
  onSelectProblem: (id: number) => void;
  children?: React.ReactNode; // control buttons
}

/** Help mode: Lumi + speech bubble, and the captured worksheet photo with mistake circles. */
export default function TutorView(p: Props) {
  const s = t(p.language);
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="card flex flex-col items-center gap-4 p-4 sm:p-5 lg:col-span-5">
        <div className="flex w-full items-center text-sm">
          <span className="rounded-full bg-sky-100 px-3 py-1 font-bold text-sky-800">
            {s.status[p.phase as keyof typeof s.status] ?? p.phase}
          </span>
        </div>
        <div className="flex w-full flex-row items-center gap-3 lg:flex-col lg:gap-4">
          <LumiMascot
            expression={expressionFor(p.emotion)}
            pose="threeQuarter"
            talking={p.talking}
            label="auto"
            className="w-20 shrink-0 sm:w-28 lg:w-44"
          />
          {p.bubble && (
            <motion.div
              key={p.bubble}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              aria-live="polite"
              className="relative w-full rounded-3xl bg-sky-50 px-4 py-3 text-lg leading-snug text-slate-900 ring-2 ring-sky-200 sm:px-5 sm:py-4 sm:text-xl"
            >
              {p.bubble}
            </motion.div>
          )}
        </div>
        <div className="flex w-full flex-wrap justify-center gap-3">{p.children}</div>
      </section>

      <section className="card flex flex-col gap-4 p-5 lg:col-span-7">
        {p.captureUrl ? (
          <div className="flex justify-center">
            <MistakeOverlay
              imageUrl={p.captureUrl}
              problems={p.result?.problems ?? []}
              focusId={p.focusId}
              onSelect={p.onSelectProblem}
            />
          </div>
        ) : (
          <div className="grid h-72 place-items-center rounded-3xl border-4 border-dashed border-sky-200 bg-sky-50/60 p-6 text-center text-xl text-slate-500">
            <div>
              <div className="mb-2 text-6xl">📷✏️</div>
              {s.putWorksheet}
            </div>
          </div>
        )}
        {p.result && p.result.problems.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {p.result.problems.map((pr) => (
              <li key={pr.id}>
                <button
                  onClick={() => p.onSelectProblem(pr.id)}
                  className={`btn-kid !min-h-12 !px-4 !py-2 text-lg ${p.focusId === pr.id ? "ring-4 ring-sun" : ""} ${
                    pr.needs_confirmation
                      ? "bg-violet-100 text-violet-800"
                      : !pr.answered
                        ? "bg-slate-100 text-slate-600"
                        : pr.is_correct
                          ? "bg-green-100 text-green-800"
                          : "bg-rose-100 text-rose-800"
                  }`}
                >
                  <span className="font-extrabold">#{pr.id}</span> {pretty(pr.problem)} = {pr.child_answer ?? "?"}{" "}
                  {pr.needs_confirmation ? "❔" : pr.is_correct ? "✓" : pr.answered ? "✗" : "…"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
