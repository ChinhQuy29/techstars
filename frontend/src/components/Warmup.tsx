import { useState } from "react";
import type { Warmup as WarmupData, WarmupResult } from "../api";
import type { Strings } from "../i18n";
import KidKeypad from "./KidKeypad";
import MathVisual from "./MathVisual";
import ProblemText from "./ProblemText";

/**
 * The quick warm-up before teaching a newer skill the first time: the child solves two problems.
 * The backend checks them (the answers never come to the browser).
 */
export default function Warmup({ warmup, result, busy, onCheck, onRetry, onTeach, s }: {
  warmup: WarmupData;
  result: WarmupResult | null;
  busy: boolean;
  onCheck: (answers: string[]) => void;
  onRetry: () => void;
  onTeach: () => void;
  s: Strings;
}) {
  const [answers, setAnswers] = useState<string[]>(warmup.problems.map(() => ""));
  const [active, setActive] = useState(0);
  const pr = warmup.problems[active];
  const blank = (i: number) => (
    <span
      className={`mx-1 inline-block min-w-12 border-b-4 text-center ${i === active && !result ? "border-sky-400 text-rose-600" : "border-slate-300 text-indigo-700"}`}
    >
      {answers[i] || " "}
    </span>
  );
  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-2xl font-extrabold text-sky-800">🏃 {s.warmupTitle}</h3>
      <ol className="notebook w-full overflow-hidden rounded-3xl ring-1 ring-amber-200">
        {warmup.problems.map((p, i) => (
          <li key={p.id}>
            <button
              onClick={() => setActive(i)}
              disabled={!!result}
              className={`font-hand flex min-h-16 w-full flex-col items-start gap-1 px-4 py-2 text-left text-2xl text-slate-800 sm:text-3xl ${i === active && !result ? "bg-sky-50" : ""}`}
            >
              <span className="flex items-center gap-2">
                <span className="font-display text-xl font-bold text-rose-400">{i + 1}</span>
                <span><ProblemText problem={p.problem} answer={blank(i)} /></span>
                {result && <span className="font-display text-2xl" aria-label={result.results[i] ? "right" : "not yet"}>{result.results[i] ? "✅" : "🔁"}</span>}
              </span>
              {p.visual && <MathVisual visual={p.visual} />}
            </button>
          </li>
        ))}
      </ol>

      {!result && (
        <>
          <KidKeypad
            kind={pr.kind}
            value={answers[active]}
            onChange={(v) => setAnswers((a) => a.map((x, i) => (i === active ? v : x)))}
            onSubmit={() => setActive((i) => Math.min(i + 1, warmup.problems.length - 1))}
          />
          <button className="btn-kid bg-green-500 px-8 text-white" disabled={busy || answers.some((a) => !a)} onClick={() => onCheck(answers)}>
            ✅ {s.warmupCheck}
          </button>
        </>
      )}
      {result?.passed && (
        <button className="btn-kid bg-sun px-8 text-2xl text-slate-900" disabled={busy} onClick={onTeach}>
          🧑‍🏫 {s.warmupGo}
        </button>
      )}
      {result && !result.passed && (
        <button className="btn-kid bg-sky-500 px-8 text-white" disabled={busy} onClick={onRetry}>
          🔁 {s.warmupRetry}
        </button>
      )}
    </div>
  );
}
