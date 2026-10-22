import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { report, type Language, type ReportResponse } from "../api";

const pretty = (p: string) => p.replace(/\*/g, "×").replace(/\//g, "÷");

/** Parent / teacher session summary. All numbers come from the backend session log (not the LLM). */
export default function ParentReport({ sessionId, language, onClose }: { sessionId: string; language: Language; onClose: () => void }) {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    report(sessionId, language).then(setData).catch((e: Error) => setError(e.message));
  }, [sessionId, language]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-8 text-slate-900 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold">Session report</h2>
            <p className="text-sm text-slate-500">for parents &amp; teachers · session {sessionId}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-200">
            ✕
          </button>
        </div>
        {error && <p className="text-red-600">Could not load report: {error}</p>}
        {!data && !error && <p className="text-slate-500">Loading…</p>}
        {data && (
          <div className="space-y-6">
            {(data.total > 0 || !data.teach) && (<>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Score", `${data.score}%`],
                ["Correct", `${data.correct}/${data.total}`],
                ["Fixed after hints", data.fixed],
                ["Hints used", data.hints_used],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-slate-100 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
                  <div className="text-2xl font-bold">{v}</div>
                </div>
              ))}
            </div>
            <p className="text-lg leading-relaxed">{data.summary}</p>
            <div>
              <h3 className="mb-2 font-bold">Concepts to practice</h3>
              {data.concepts.length ? (
                <ul className="flex flex-wrap gap-2">
                  {data.concepts.map((c) => (
                    <li key={c} className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">No tricky spots this time.</p>
              )}
            </div>
            </>)}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-bold">3 practice problems</h3>
                <button className="text-sm text-sky-700 underline" onClick={() => setShowAnswers((s) => !s)}>
                  {showAnswers ? "Hide" : "Show"} answers
                </button>
              </div>
              <ol className="grid gap-2 sm:grid-cols-3">
                {data.practice_problems.map((p) => (
                  <li key={p.problem} className="rounded-2xl border-2 border-slate-200 p-4 text-center text-2xl font-semibold">
                    {pretty(p.problem)} = {showAnswers ? <span className="text-green-700">{p.answer}</span> : "___"}
                  </li>
                ))}
              </ol>
            </div>
            {data.teach && (
              <div className="rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-100">
                <h3 className="mb-2 text-xl font-bold text-violet-800">🧑‍🏫 Your child taught Lumi</h3>
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  {[
                    ["Mistakes found", `${data.teach.caught}/${data.teach.planted}`],
                    ["Missed", data.teach.missed],
                    ["False alarms", data.teach.false_alarms],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
                      <div className="text-2xl font-bold">{v}</div>
                    </div>
                  ))}
                </div>
                {data.teach.taught.length > 0 && (
                  <ul className="mb-3 flex flex-wrap gap-2">
                    {data.teach.taught.map((c) => (
                      <li key={c.concept} className="rounded-full bg-white px-3 py-1 text-violet-900 ring-1 ring-violet-200">
                        {c.label} · {"★".repeat(Math.floor(c.stars))}{c.stars % 1 ? "½" : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {data.teach.quotes.length > 0 && (
                  <div className="mb-3 space-y-1">
                    <p className="text-sm font-semibold text-slate-600">In their own words:</p>
                    {data.teach.quotes.map((q) => (
                      <blockquote key={q.concept} className="border-l-4 border-violet-300 pl-3 italic">
                        “{q.text}” <span className="not-italic text-slate-500">({q.label})</span>
                      </blockquote>
                    ))}
                  </div>
                )}
                <p className="text-sm text-slate-600">
                  Explanations: {data.teach.explanations.concept ?? 0} with the reason why, {data.teach.explanations.procedure ?? 0} with the steps,{" "}
                  {(data.teach.explanations.vague ?? 0) + (data.teach.explanations.incorrect ?? 0)} needing help.
                </p>
                <p className="mt-2 text-sm text-slate-500">{data.teach.note}</p>
              </div>
            )}
            <button onClick={() => window.print()} className="rounded-xl bg-slate-900 px-4 py-2 text-white">
              Print
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
