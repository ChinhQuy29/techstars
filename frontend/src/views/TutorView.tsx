import { motion } from "framer-motion";
import type { Emotion, GradeResponse, Language } from "../api";
import MistakeOverlay from "../components/MistakeOverlay";
import { pretty, t } from "../i18n";
import Face from "../robot/Face";
import { EXPRESSIONS } from "../robot/emotions";

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

/** Help mode: the robot face + speech bubble, and the captured still with mistake circles. */
export default function TutorView(p: Props) {
  const s = t(p.language);
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="card flex flex-col items-center gap-4 p-5 lg:col-span-5">
        <div className="flex w-full items-center justify-between text-sm">
          <span className="rounded-full bg-sky-100 px-3 py-1 font-bold text-sky-800">
            {s.status[p.phase as keyof typeof s.status] ?? p.phase}
          </span>
          <span className="font-semibold" style={{ color: EXPRESSIONS[p.emotion].glow }}>
            {EXPRESSIONS[p.emotion].label}
          </span>
        </div>
        <Face emotion={p.emotion} talking={p.talking} />
        {p.bubble && (
          <motion.div
            key={p.bubble}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative w-full rounded-3xl bg-sky-50 px-5 py-4 text-xl leading-snug text-slate-900 ring-2 ring-sky-200"
          >
            {p.bubble}
          </motion.div>
        )}
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
              <div className="mb-2 text-6xl">📄✏️</div>
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
                  className={`btn-kid !min-h-12 !px-4 !py-2 text-lg ${p.focusId === pr.id ? "ring-4 ring-lamp" : ""} ${
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
