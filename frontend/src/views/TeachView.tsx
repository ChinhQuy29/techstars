import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { Emotion, Language, TeachOutcome, TeachTurn, TeachWorksheet } from "../api";
import ExplainChips from "../components/ExplainChips";
import KidKeypad from "../components/KidKeypad";
import LumiBrain from "../components/LumiBrain";
import LumiHomework, { type RowMark } from "../components/LumiHomework";
import { pretty, t } from "../i18n";
import Face from "../robot/Face";
import { celebrate, sounds } from "../robot/sounds";
import type { useSpeech } from "../robot/useSpeech";

interface Props {
  sessionId: string;
  language: Language;
  speech: ReturnType<typeof useSpeech>;
  onPracticeFirst: () => void;
  onShowReport: () => void;
}

/**
 * Teach Lumi mode (teach-lumi-spec.md). The backend drives the conversation: this view renders
 * whatever `turn.step` comes back and sends the child's action. It never decides correctness.
 */
export default function TeachView({ sessionId, language, speech, onPracticeFirst, onShowReport }: Props) {
  const s = t(language);
  const [ws, setWs] = useState<TeachWorksheet | null>(null);
  const [turn, setTurn] = useState<TeachTurn | null>(null);
  const [marks, setMarks] = useState<Record<number, RowMark>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [entry, setEntry] = useState("");
  const [emotion, setEmotion] = useState<Emotion>("happy");
  const [bubble, setBubble] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const seq = useRef(0);
  const wsRef = useRef<TeachWorksheet | null>(null);
  const loadedFor = useRef<string | null>(null);
  const applyRef = useRef<(tn: TeachTurn) => Promise<void>>(async () => {});
  const loadRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const { speak, listen, stopSpeaking, canListen, listening } = speech;

  const send = useCallback(
    async (
      action: Parameters<typeof api.teachTurn>[0]["action"],
      extra: Partial<Parameters<typeof api.teachTurn>[0]> = {},
    ): Promise<TeachTurn | null> => {
      const w = wsRef.current;
      if (!w?.worksheet_id) return null;
      setBusy(true);
      stopSpeaking();
      try {
        const tn = await api.teachTurn({ session_id: sessionId, language, worksheet_id: w.worksheet_id, action, ...extra });
        void applyRef.current(tn);
        return tn;
      } catch (e) {
        console.error(e);
        if (String(e).startsWith("Error: 409")) void loadRef.current(); // stale worksheet: start fresh
        else setError(String(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, language, stopSpeaking],
  );

  /** Show + speak a turn. After a "why?" question, open the mic automatically (spec §3.5). */
  const apply = useCallback(
    async (tn: TeachTurn) => {
      const mine = ++seq.current;
      setTurn(tn);
      setEmotion(tn.emotion);
      setBubble(tn.say);
      setEntry("");
      setError(null);
      if (tn.step === "fix" && tn.focus_problem_id !== null) setFound((f) => new Set(f).add(tn.focus_problem_id!));
      if (tn.mastery_up || tn.emotion === "celebrating") celebrate();
      else if (tn.emotion === "happy") sounds.correct();
      else sounds.hint();
      await speak(tn.say);
      if (mine !== seq.current || tn.step !== "explain" || !canListen) return;
      setEmotion("listening");
      const heard = await listen();
      if (mine !== seq.current) return;
      if (heard) await send("explain", { child_said: heard });
      else setEmotion(tn.emotion);
    },
    [speak, listen, canListen, send],
  );
  applyRef.current = apply;

  const load = useCallback(
    async (force = false) => {
      setBusy(true);
      setError(null);
      try {
        const w = await api.teachWorksheet(sessionId, language, force);
        wsRef.current = w;
        setWs(w);
        setMarks({});
        setEditing(null);
        setFound(new Set());
        apply(w.turn);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [sessionId, language, apply],
  );
  loadRef.current = load;

  useEffect(() => {
    if (loadedFor.current === sessionId) return; // StrictMode runs effects twice; generate once per session
    loadedFor.current = sessionId;
    load();
  }, [sessionId, load]);

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  const talkWhy = async () => {
    stopSpeaking();
    const mine = ++seq.current;
    setEmotion("listening");
    const heard = await listen();
    if (mine !== seq.current) return;
    if (heard) await send("explain", { child_said: heard });
    else setEmotion(turn?.emotion ?? "curious");
  };

  const step = turn?.step;
  const problems = ws?.problems ?? [];
  const allMarked = problems.length > 0 && problems.every((p) => marks[p.id]);
  const outcomes: Record<number, TeachOutcome> = {};
  for (const o of turn?.outcomes ?? []) {
    // Don't give away the child's misses (or which rows were right) before they are found.
    if (o.outcome === "missed" && !found.has(o.id) && step !== "done") continue;
    if (o.outcome === "confirmed_ok" && step !== "done") continue;
    outcomes[o.id] = o.outcome;
  }

  const setMark = (id: number, mark: RowMark["mark"]) => {
    setMarks((m) => ({ ...m, [id]: mark === "circle" ? { mark, correction: m[id]?.correction ?? "" } : { mark } }));
    if (mark === "circle") setEditing(id);
    else setEditing((e) => (e === id ? null : e));
  };

  const submitFix = async () => {
    const pid = turn?.focus_problem_id;
    const answer = entry;
    const tn = await send("fix", { answer });
    // Show the child's fix in red pen once SymPy accepted it (the next step is "explain").
    if (tn?.step === "explain" && pid != null) setMarks((m) => ({ ...m, [pid]: { mark: "circle", correction: answer } }));
  };

  const doneChecking = () =>
    send("check", {
      marks: problems.map((p) => ({ id: p.id, mark: marks[p.id]?.mark ?? "none", correction: marks[p.id]?.correction || null })),
    });

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="card flex flex-col items-center gap-4 p-5 lg:col-span-5">
        <Face emotion={emotion} talking={speech.speaking} />
        {bubble && (
          <motion.div
            key={bubble}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative w-full rounded-3xl bg-sky-50 px-5 py-4 text-xl leading-snug text-slate-900 ring-2 ring-sky-200"
          >
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-sky-50 ring-2 ring-sky-200 [clip-path:polygon(0_0,100%_0,0_100%)]" />
            {bubble}
          </motion.div>
        )}
        <LumiBrain mastery={turn?.mastery ?? {}} popConcept={turn?.mastery_up ?? null} s={s} />
      </section>

      <section className="card flex flex-col gap-4 p-5 lg:col-span-7">
        <h2 className="text-2xl font-extrabold text-amber-700">📒 {s.lumisHomework}</h2>

        {ws?.ready ? (
          <LumiHomework
            problems={problems}
            marks={marks}
            step={step ?? "mark"}
            outcomes={outcomes}
            focusId={turn?.focus_problem_id ?? null}
            highlightIds={turn?.highlight_ids ?? []}
            editingId={editing}
            onMark={setMark}
            onEdit={setEditing}
            onPick={(id) => send("find", { problem_id: id })}
            s={s}
          />
        ) : (
          <div className="grid h-72 place-items-center rounded-3xl border-4 border-dashed border-amber-200 bg-amber-50 text-7xl">📚</div>
        )}

        {error && <p className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}

        <div className="flex flex-col items-center gap-4">
          {step === "mark" && (
            <>
              {editing !== null && (
                <div className="flex flex-col items-center gap-2 rounded-3xl bg-sky-50 p-4 ring-2 ring-sky-200">
                  <p className="font-bold text-sky-800">
                    #{editing} {pretty(problems.find((p) => p.id === editing)?.problem ?? "")} = ? · {s.typeAnswer}
                  </p>
                  <KidKeypad
                    value={marks[editing]?.correction ?? ""}
                    onChange={(v) => setMarks((m) => ({ ...m, [editing]: { mark: "circle", correction: v } }))}
                    onSubmit={() => setEditing(null)}
                  />
                </div>
              )}
              <button className="btn-kid bg-lamp px-8 text-2xl text-slate-900" disabled={!allMarked || busy} onClick={doneChecking}>
                📝 {s.doneChecking}
              </button>
              {!allMarked && <p className="text-slate-500">{s.markAll}</p>}
            </>
          )}

          {(step === "fix" || step === "help") && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-lg font-bold text-sky-800">{s.typeAnswer}</p>
              <KidKeypad value={entry} onChange={setEntry} onSubmit={busy ? undefined : submitFix} />
              <button className="btn-kid bg-green-500 px-8 text-white" disabled={!entry || busy} onClick={submitFix}>
                ✅ {s.tellLumi}
              </button>
            </div>
          )}

          {step === "find" && (
            <motion.p
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="rounded-2xl bg-amber-100 px-5 py-3 text-xl font-bold text-amber-900"
            >
              👆 {s.tapMistake}
            </motion.p>
          )}

          {step === "explain" && (
            <div className="flex w-full flex-col items-center gap-3">
              <button
                onClick={talkWhy}
                disabled={!canListen || listening || busy}
                className={`btn-kid relative bg-sky-500 px-8 text-2xl text-white ${listening ? "animate-pulse ring-8 ring-sky-200" : ""}`}
              >
                🎤 {listening ? s.listening : s.talkWhy}
              </button>
              {turn?.chips.length ? (
                <>
                  <p className="text-slate-500">{s.orTap}</p>
                  <ExplainChips chips={turn.chips} disabled={busy} onPick={(id) => send("explain", { chip_id: id })} />
                </>
              ) : null}
              <button className="btn-small bg-slate-100 text-slate-600" disabled={busy} onClick={() => send("explain", { child_said: "" })}>
                🤷 {s.notSure}
              </button>
            </div>
          )}

          {step === "demo" && turn?.demo && (
            <div className="w-full rounded-3xl bg-violet-50 p-5 ring-2 ring-violet-200">
              <p className="mb-1 text-sm font-bold uppercase tracking-wide text-violet-500">🤖 {s.newTry}</p>
              <p className="font-hand mb-3 text-5xl text-slate-800">
                {pretty(turn.demo.problem)} ={" "}
                <motion.span
                  key={turn.demo.problem}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + (turn.demo.steps.length - 1) * 1.6 }}
                  className="inline-block text-indigo-700"
                >
                  {turn.demo.answer}
                </motion.span>
              </p>
              <ol className="space-y-2">
                {turn.demo.steps.map((line, i) => (
                  <motion.li
                    key={line + i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 1.6 }}
                    className="rounded-xl bg-white px-4 py-2 text-lg"
                  >
                    {line}
                  </motion.li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button className="btn-kid bg-green-500 text-white" disabled={busy} onClick={() => send("confirm", { agree: true })}>
                  👍 {s.yesGotIt}
                </button>
                <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" disabled={busy} onClick={() => send("confirm", { agree: false })}>
                  🤔 {s.notQuite}
                </button>
              </div>
            </div>
          )}

          {step === "sure" && (
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn-kid bg-green-500 text-white" disabled={busy} onClick={() => send("confirm", { agree: true })}>
                ✅ {s.youWereRight}
              </button>
              <button className="btn-kid bg-white text-rose-700 ring-2 ring-rose-200" disabled={busy} onClick={() => send("confirm", { agree: false })}>
                ❌ {s.stillWrong}
              </button>
            </div>
          )}

          {step === "next" && (
            <button className="btn-kid bg-lamp px-10 text-2xl text-slate-900" disabled={busy} onClick={() => send("next")}>
              {s.next} ➜
            </button>
          )}

          {step === "done" && turn?.stats && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3 text-center">
              <div className="text-7xl">🏆</div>
              <p className="text-3xl font-extrabold text-amber-700">
                {turn.stats.caught} / {turn.stats.planted} {s.foundStats}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button className="btn-kid bg-lamp text-slate-900" disabled={busy} onClick={() => load()}>
                  📚 {s.moreHomework}
                </button>
                <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" onClick={onShowReport}>
                  👪 {s.report}
                </button>
              </div>
            </motion.div>
          )}

          {step === "practice_first" && (
            <div className="flex flex-col items-center gap-3">
              <button className="btn-kid bg-sky-500 px-8 text-2xl text-white" onClick={onPracticeFirst}>
                🙋 {s.practice}
              </button>
              <button className="text-sm text-slate-500 underline" disabled={busy} onClick={() => load(true)}>
                {s.tryAnyway}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
