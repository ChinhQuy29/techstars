import { motion } from "framer-motion";
import { isNativeApp } from "../platform";
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import type {
  Concept, Emotion, Language, TeachConceptInfo, TeachOutcome, TeachTurn, TeachUnlock, TeachWorksheet, Warmup as WarmupData, WarmupResult,
} from "../api";
import ConceptPicker from "../components/ConceptPicker";
import ExplainChips from "../components/ExplainChips";
import HoldButton from "../components/HoldButton";
import KidKeypad from "../components/KidKeypad";
import LumiBrain from "../components/LumiBrain";
import LumiHomework, { type RowMark } from "../components/LumiHomework";
import MathVisual from "../components/MathVisual";
import ProblemText from "../components/ProblemText";
import Warmup from "../components/Warmup";
import { CONCEPT_EMOJI, t, type TeachConcept } from "../i18n";
import LumiMascot from "../components/mascot/LumiMascot";
import { expressionFor } from "../components/mascot/lumiAssets";
import { celebrate, sounds } from "../robot/sounds";
import type { useSpeech } from "../robot/useSpeech";

interface Props {
  sessionId: string;
  language: Language;
  speech: ReturnType<typeof useSpeech>;
  onPracticeFirst: () => void;
  onShowReport: () => void;
  /** Open Lumi's Town page (optionally straight into one place's scene). */
  onOpenTown: (concept: Concept | null, story?: string | null) => void;
  /** Start with the fixed canonical demo worksheet (adult action from Grown-up settings). */
  demo?: boolean;
}

/**
 * Teach Lumi mode (docs/02-learning-design.md). The backend drives the conversation: this view renders
 * whatever `turn.step` comes back and sends the child's action. It never decides correctness.
 */
export default function TeachView({ sessionId, language, speech, onPracticeFirst, onShowReport, onOpenTown, demo = false }: Props) {
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
  const [typed, setTyped] = useState("");

  const seq = useRef(0);
  const wsRef = useRef<TeachWorksheet | null>(null);
  const loadedFor = useRef<string | null>(null);
  const applyRef = useRef<(tn: TeachTurn) => Promise<void>>(async () => {});
  const loadRef = useRef<(force?: boolean, demoSheet?: boolean) => Promise<void>>(async () => {});
  const lastAction = useRef<(() => Promise<unknown>) | null>(null);
  // The child chooses what to teach (any order); newer skills unlock with a quick warm-up.
  const [phase, setPhase] = useState<"pick" | "warmup" | "teach">(demo ? "teach" : "pick");
  const [menu, setMenu] = useState<TeachConceptInfo[]>([]);
  const chosen = useRef<string | null>(null);
  const [warmup, setWarmup] = useState<WarmupData | null>(null);
  const [warmResult, setWarmResult] = useState<WarmupResult | null>(null);
  // Something the child's teaching just opened (a Town place now, story scenes later): the backend says so.
  const [newUnlock, setNewUnlock] = useState<TeachUnlock | null>(null);
  const { speak, listen, stopSpeaking, canListen, listening } = speech;

  const send = useCallback(
    async (
      action: Parameters<typeof api.teachTurn>[0]["action"],
      extra: Partial<Parameters<typeof api.teachTurn>[0]> = {},
    ): Promise<TeachTurn | null> => {
      const w = wsRef.current;
      if (!w?.worksheet_id) return null;
      lastAction.current = () => send(action, extra);
      setBusy(true);
      stopSpeaking();
      setEmotion("thinking"); // show we're working right away
      try {
        const tn = await api.teachTurn({ session_id: sessionId, language, worksheet_id: w.worksheet_id, action, ...extra });
        void applyRef.current(tn);
        return tn;
      } catch (e) {
        if (e instanceof api.ApiError && e.status === 409) {
          console.info("teach: stale worksheet, starting a new one"); // expected after a restart; handled
          void loadRef.current();
        } else {
          console.error(e);
          setEmotion("confused");
          setError(s.oopsError);
        }
        return null;
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, language, stopSpeaking],
  );

  /** Show + speak a turn. After a "why?" question, open the mic automatically (docs/02-learning-design.md). */
  const apply = useCallback(
    async (tn: TeachTurn) => {
      const mine = ++seq.current;
      setTurn(tn);
      setEmotion(tn.emotion);
      setBubble(tn.say);
      setEntry("");
      setError(null);
      if (tn.step === "fix" && tn.focus_problem_id !== null) setFound((f) => new Set(f).add(tn.focus_problem_id!));
      setNewUnlock(tn.unlocks?.[0] ?? null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speak, listen, canListen, send],
  );
  applyRef.current = apply;

  const load = useCallback(
    async (force = false, demoSheet = false) => {
      lastAction.current = () => load(force, demoSheet);
      setBusy(true);
      setError(null);
      try {
        const w = await api.teachWorksheet(sessionId, language, force, demoSheet, demoSheet ? null : chosen.current);
        wsRef.current = w;
        setWs(w);
        setMarks({});
        setEditing(null);
        setFound(new Set());
        apply(w.turn);
      } catch (e) {
        console.error(e);
        setEmotion("confused");
        setError(s.oopsError);
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, language, apply],
  );
  loadRef.current = load;

  /** "What do you want to teach Lumi today?" */
  const openPicker = useCallback(async () => {
    lastAction.current = () => openPicker();
    stopSpeaking();
    seq.current++;
    setPhase("pick");
    setWs(null);
    wsRef.current = null;
    setTurn(null);
    setWarmup(null);
    setError(null);
    setEmotion("curious");
    setBubble(s.chooseTitle);
    try {
      setMenu(await api.teachConcepts(sessionId, language));
      void speak(s.chooseTitle);
    } catch (e) {
      console.error(e);
      setError(s.oopsError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, language, speak, stopSpeaking]);

  const teachConcept = (concept: string | null) => {
    chosen.current = concept;
    setPhase("teach");
    void load();
  };

  const startWarmup = async (concept: string) => {
    lastAction.current = () => startWarmup(concept);
    chosen.current = concept;
    setBusy(true);
    setError(null);
    stopSpeaking();
    try {
      const w = await api.startWarmup(sessionId, language, concept);
      setWarmup(w);
      setWarmResult(null);
      setPhase("warmup");
      setEmotion("curious");
      setBubble(w.say);
      void speak(w.say);
    } catch (e) {
      console.error(e);
      setError(s.oopsError);
    } finally {
      setBusy(false);
    }
  };

  const checkWarmup = async (answers: string[]) => {
    if (!warmup) return;
    lastAction.current = () => checkWarmup(answers);
    setBusy(true);
    setEmotion("thinking");
    try {
      const r = await api.checkWarmup(sessionId, language, warmup.warmup_id, answers);
      setWarmResult(r);
      setEmotion(r.emotion);
      setBubble(r.say);
      if (r.passed) celebrate();
      else sounds.hint();
      void speak(r.say);
    } catch (e) {
      console.error(e);
      if (e instanceof api.ApiError && e.status === 409) void startWarmup(warmup.concept);
      else setError(s.oopsError);
    } finally {
      setBusy(false);
    }
  };

  const pick = (c: TeachConceptInfo) => {
    // Ready, or an original skill (the backend explains Help-mode practice): straight to Lumi's homework.
    if (c.ready || c.gate === "help") teachConcept(c.concept);
    else void startWarmup(c.concept);
  };

  useEffect(() => {
    if (loadedFor.current === sessionId) return; // StrictMode runs effects twice; start once per session
    loadedFor.current = sessionId;
    if (demo) load(false, true);
    else void openPicker();
  }, [sessionId, load, demo, openPicker]);

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

  const step = phase === "teach" ? turn?.step : undefined;
  const problems = ws?.problems ?? [];
  const focusKind = problems.find((p) => p.id === turn?.focus_problem_id)?.kind ?? "number";

  // Lumi looks "thinking" while its demo steps are still appearing, then the backend's emotion
  // (happy) once the answer is shown. Purely visual: the steps/answer come from the server.
  const [demoShown, setDemoShown] = useState(true);
  const demoSteps = turn?.step === "demo" ? turn.demo?.steps.length ?? 0 : 0;
  useEffect(() => {
    if (!demoSteps) return setDemoShown(true);
    setDemoShown(false);
    const id = window.setTimeout(() => setDemoShown(true), (0.6 + (demoSteps - 1) * 1.6) * 1000);
    return () => window.clearTimeout(id);
  }, [turn, demoSteps]);
  const mascotExpression = busy ? "thinking" : step === "demo" && !demoShown ? "thinking" : expressionFor(emotion);
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
      <section className="card flex flex-col items-center gap-4 p-4 sm:p-5 lg:col-span-5">
        {/* On narrow screens Lumi shrinks and sits beside the bubble, so the math stays near the top. */}
        <div className="flex w-full flex-row items-center gap-3 lg:flex-col lg:gap-4">
          <LumiMascot
            expression={mascotExpression}
            pose="threeQuarter"
            talking={speech.speaking}
            label="auto"
            className="w-20 shrink-0 sm:w-28 lg:w-44"
          />
          {bubble && (
            <motion.div
              key={bubble}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              aria-live="polite"
              className="relative w-full rounded-3xl bg-sky-50 px-4 py-3 text-lg leading-snug text-slate-900 ring-2 ring-sky-200 sm:px-5 sm:py-4 sm:text-xl"
            >
              {bubble}
            </motion.div>
          )}
        </div>
        <div className="hidden w-full lg:block">
          <LumiBrain mastery={turn?.mastery ?? {}} popConcept={turn?.mastery_up ?? null} s={s} />
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-3 sm:p-5 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-extrabold text-amber-700">
            📒 {s.lumisHomework}
            {phase !== "pick" && chosen.current && (
              <span className="ml-2 rounded-full bg-amber-100 px-3 py-1 align-middle text-base text-amber-800">
                {CONCEPT_EMOJI[chosen.current]} {s.concepts[chosen.current as TeachConcept]}
              </span>
            )}
          </h2>
          <button
            className="btn-kid !min-h-12 bg-teal-500 !py-2 text-base text-white"
            onClick={() => { stopSpeaking(); onOpenTown(null); }}
          >
            🏘️ {s.town}
          </button>
        </div>

        {phase === "pick" ? (
          <ConceptPicker concepts={menu} busy={busy} onPick={pick} onLumiPicks={() => teachConcept(null)} s={s} />
        ) : phase === "warmup" && warmup ? (
          <Warmup
            key={warmup.warmup_id}
            warmup={warmup}
            result={warmResult}
            busy={busy}
            onCheck={checkWarmup}
            onRetry={() => startWarmup(warmup.concept)}
            onTeach={() => teachConcept(warmup.concept)}
            s={s}
          />
        ) : ws?.ready ? (
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

        {error && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-3xl bg-rose-50 p-4 text-center ring-2 ring-rose-200">
            <p className="text-lg font-bold text-rose-800">😵 {error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn-kid bg-white text-slate-800 ring-2 ring-slate-200" disabled={busy} onClick={() => lastAction.current?.()}>
                🔁 {s.tryAgain}
              </button>
              <button className="btn-kid bg-sun text-slate-900" disabled={busy} onClick={() => (phase === "teach" ? load() : openPicker())}>
                📚 {s.startOver}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          {step === "mark" && (
            <>
              {editing !== null && (
                <div className="flex flex-col items-center gap-2 rounded-3xl bg-sky-50 p-4 ring-2 ring-sky-200">
                  <p className="font-bold text-sky-800">
                    #{editing} <ProblemText problem={problems.find((p) => p.id === editing)?.problem ?? ""} answer="?" /> · {s.typeAnswer}
                  </p>
                  <KidKeypad
                    kind={problems.find((p) => p.id === editing)?.kind ?? "number"}
                    value={marks[editing]?.correction ?? ""}
                    onChange={(v) => setMarks((m) => ({ ...m, [editing]: { mark: "circle", correction: v } }))}
                    onSubmit={() => setEditing(null)}
                  />
                </div>
              )}
              <button className="btn-kid bg-sun px-8 text-2xl text-slate-900" disabled={!allMarked || busy} onClick={doneChecking}>
                📝 {s.doneChecking}
              </button>
              {!allMarked && <p className="text-slate-500">{s.markAll}</p>}
            </>
          )}

          {(step === "fix" || step === "help") && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-lg font-bold text-sky-800">{s.typeAnswer}</p>
              <KidKeypad kind={focusKind} value={entry} onChange={setEntry} onSubmit={busy ? undefined : submitFix} />
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
              {!isNativeApp && (
                <button
                  onClick={talkWhy}
                  disabled={!canListen || listening || busy}
                  className={`btn-kid relative bg-sky-500 px-8 text-2xl text-white ${listening ? "animate-pulse ring-8 ring-sky-200" : ""}`}
                >
                  🎤 {speech.micBlocked ? s.micOff : listening ? s.listening : s.talkWhy}
                </button>
              )}
              {turn?.chips.length ? (
                <>
                  {!isNativeApp && <p className="text-slate-500">{s.orTap}</p>}
                  <ExplainChips chips={turn.chips} disabled={busy} onPick={(id) => send("explain", { chip_id: id })} />
                </>
              ) : null}
              {/* Typed reason: same rating as speech, for kids who can write and when there's no mic. */}
              <form
                className="flex w-full max-w-lg gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = typed.trim();
                  if (!text) return;
                  setTyped("");
                  send("explain", { child_said: text });
                }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={`✍️ ${s.typeReason}`}
                  aria-label={s.typeReason}
                  maxLength={200}
                  className="min-h-12 flex-1 rounded-2xl bg-white px-4 text-lg ring-2 ring-sky-200 focus:outline-none focus:ring-sky-400"
                />
                <button type="submit" className="btn-kid !min-h-12 bg-sky-500 !py-2 text-white" disabled={busy || !typed.trim()}>
                  ➜
                </button>
              </form>
              <button className="btn-small bg-slate-100 text-slate-600" disabled={busy} onClick={() => send("explain", { child_said: "" })}>
                🤷 {s.notSure}
              </button>
            </div>
          )}

          {step === "demo" && turn?.demo && (
            <div className="w-full rounded-3xl bg-violet-50 p-5 ring-2 ring-violet-200">
              <p className="mb-1 text-sm font-bold uppercase tracking-wide text-violet-500">🤖 {s.newTry}</p>
              <p className={`font-hand mb-3 text-slate-800 ${turn.demo.problem.includes("?") ? "text-3xl sm:text-4xl" : "text-5xl"}`}>
                <ProblemText
                  problem={turn.demo.problem}
                  answer={
                    <motion.span
                      key={turn.demo.problem}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + (turn.demo.steps.length - 1) * 1.6 }}
                      className="inline-block text-indigo-700"
                    >
                      {turn.demo.answer}
                    </motion.span>
                  }
                />
              </p>
              {turn.demo.visual && <MathVisual visual={turn.demo.visual} className="mb-3" />}
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

          {step === "next" && newUnlock && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex w-full flex-wrap items-center justify-center gap-3 rounded-3xl bg-teal-50 p-4 text-center ring-2 ring-teal-200"
            >
              <span className="text-4xl" aria-hidden>{newUnlock.emoji}</span>
              <p className="text-xl font-extrabold text-teal-800" role="status">
                🎉 {newUnlock.kind === "story" ? s.newScene : s.newPlace} {newUnlock.title}
              </p>
              <button
                className="btn-kid bg-teal-500 text-white"
                onClick={() => {
                  stopSpeaking();
                  if (newUnlock.kind === "place") onOpenTown(newUnlock.key as Concept);
                  else onOpenTown(null, newUnlock.key);
                }}
              >
                👋 {s.visit}
              </button>
            </motion.div>
          )}

          {step === "next" && (
            <button className="btn-kid bg-sun px-10 text-2xl text-slate-900" disabled={busy} onClick={() => send("next")}>
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
                <button className="btn-kid bg-sun text-slate-900" disabled={busy} onClick={() => load()}>
                  📚 {s.moreHomework}
                </button>
                <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" disabled={busy} onClick={openPicker}>
                  🔀 {s.teachSomethingElse}
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
              <HoldButton
                label={s.tryAnyway}
                holdLabel={s.holdForGrownups}
                disabled={busy}
                onConfirm={() => { chosen.current = null; void load(true); }}
              />
              <button className="btn-small bg-white text-slate-600 ring-1 ring-slate-200" onClick={openPicker}>
                🔀 {s.teachSomethingElse}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Narrow screens: Lumi's Brain goes below the worksheet so the math stays on top. */}
      <div className="lg:hidden">
        <LumiBrain mastery={turn?.mastery ?? {}} popConcept={turn?.mastery_up ?? null} s={s} />
      </div>
    </div>
  );
}
