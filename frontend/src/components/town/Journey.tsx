import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import * as api from "../../api";
import type { Journey as JourneyData, Language, StoryScene, StoryVersion } from "../../api";
import { CONCEPT_EMOJI, type Strings } from "../../i18n";
import type { useSpeech } from "../../robot/useSpeech";
import LumiMascot from "../mascot/LumiMascot";
import { expressionFor } from "../mascot/lumiAssets";
import { TownArt } from "./townArt";

const LINE_MS = 2600;
const ACT_SKY = ["from-sky-200 to-amber-100", "from-indigo-200 to-sky-100", "from-violet-300 to-indigo-100", "from-slate-800 to-indigo-900"];

/**
 * Lumi's Journey to the moon (docs/03-lumis-town.md). Three acts, four versions each; a version opens when
 * both of its concepts are taught, in any order. Mystery cards show only the concepts already taught.
 * Opening an open version of the current act chooses it. Read-only: the story never changes stars.
 */
export default function Journey({ sessionId, language, speech, startKey, s }: {
  sessionId: string;
  language: Language;
  speech: ReturnType<typeof useSpeech>;
  startKey: string | null;
  s: Strings;
}) {
  const [info, setInfo] = useState<JourneyData | null>(null);
  const [scene, setScene] = useState<StoryScene | null>(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState(false);
  const { speak, stopSpeaking } = speech;

  const load = useCallback(async () => {
    try {
      setError(false);
      const j = await api.journey(sessionId, language);
      setInfo(j);
      void speak(j.say);
    } catch {
      setError(true);
    }
  }, [sessionId, language, speak]);

  const play = useCallback(
    async (key: string) => {
      stopSpeaking();
      try {
        setError(false);
        const sc = await api.storyScene(sessionId, language, key);
        setScene(sc);
        setShown(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError(true);
      }
    },
    [sessionId, language, stopSpeaking],
  );

  useEffect(() => {
    if (startKey) void play(startKey);
    else void load();
    return () => stopSpeaking();
    // open once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One line at a time, spoken, like a picture book.
  useEffect(() => {
    if (!scene || shown < 1) return;
    void speak(scene.lines[shown - 1].text);
    if (shown >= scene.lines.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), LINE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, shown]);

  const back = () => {
    stopSpeaking();
    setScene(null);
    void load();
  };

  if (scene) {
    const line = scene.lines[Math.max(0, shown - 1)];
    const done = shown >= scene.lines.length;
    return (
      <div className="card p-3 sm:p-5">
        <div className={`relative grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-3xl bg-gradient-to-b ring-4 ring-white shadow-xl ${ACT_SKY[scene.act - 1]}`}>
          <TownArt
            name={`story_${scene.key}`}
            className="absolute inset-0 h-full w-full object-cover"
            fallback={<span className="text-[7rem] drop-shadow-lg sm:text-[10rem]" aria-hidden>{scene.emoji}</span>}
          />
          {scene.what_if && (
            <span className="absolute left-3 top-3 rounded-full bg-violet-600 px-3 py-1 text-sm font-extrabold text-white shadow">
              {scene.what_if_label}
            </span>
          )}
          <div className="absolute bottom-[4%] left-[3%] w-[18%]">
            <LumiMascot expression={expressionFor(line.emotion)} pose="threeQuarter" talking={speech.speaking} label="auto" className="w-full" />
          </div>
        </div>
        <h3 className="mt-4 text-2xl font-extrabold text-indigo-800">{scene.emoji} {scene.title}</h3>
        <ol className="mt-2 flex flex-col gap-2" aria-live="polite">
          {scene.lines.slice(0, shown).map((ln, i) => (
            <motion.li
              key={`${scene.key}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-2xl px-4 py-2 text-lg ${i === shown - 1 ? "bg-white ring-2 ring-indigo-200" : "bg-white/70"}`}
            >
              {ln.text}
            </motion.li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {!done && (
            <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" onClick={() => setShown((n) => n + 1)}>
              {s.nextScene} ➜
            </button>
          )}
          <button className="btn-kid bg-indigo-500 text-white" onClick={back}>
            🌙 {s.journey}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 p-3 text-rose-800 ring-1 ring-rose-200">
          😵 {s.oopsError}
          <button className="btn-small bg-white" onClick={load}>🔁 {s.tryAgain}</button>
        </div>
      )}
      {info && (
        <div className="card flex items-center gap-3 p-3 sm:p-4">
          <LumiMascot expression={info.started ? "happy" : "curious"} pose="front" talking={speech.speaking} label="auto" className="w-16 shrink-0 sm:w-20" />
          <p className="rounded-2xl bg-indigo-50 px-4 py-3 text-lg font-semibold text-indigo-900 ring-1 ring-indigo-100">{info.say}</p>
        </div>
      )}
      {info?.started &&
        info.acts.map((a) => (
          <section key={a.act} className={`card p-3 sm:p-4 ${a.act > info.current_act ? "opacity-70" : ""}`}>
            <h3 className="mb-3 text-xl font-extrabold text-slate-800">
              {s.act} {a.act} · {a.title}
            </h3>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {a.versions.map((v) => (
                <li key={v.key}>
                  <VersionCard v={v} s={s} onPlay={() => play(v.key)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      {info?.started && (
        <section className={`card overflow-hidden p-0 ${info.ending ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-4 bg-gradient-to-r from-slate-800 to-indigo-900 p-4 text-white">
            <span className="text-5xl" aria-hidden>🌙</span>
            <div className="flex-1">
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-200">{s.act} 4</p>
              <p className="text-2xl font-extrabold">{info.ending ? info.ending.title : s.toTheMoon}</p>
            </div>
            {info.ending && (
              <button className="btn-kid bg-sun text-slate-900" onClick={() => play(info.ending!.key)}>
                {info.ending.seen ? `🔁 ${s.replay}` : `✨ ${s.watch}`}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function VersionCard({ v, s, onPlay }: { v: StoryVersion; s: Strings; onPlay: () => void }) {
  const open = v.state === "available" || v.state === "chosen" || v.state === "what_if";
  const style: Record<string, string> = {
    chosen: "bg-green-50 ring-green-400",
    available: "bg-amber-50 ring-amber-400 shadow-lg",
    what_if: "bg-violet-50 ring-violet-300",
    partial: "bg-white ring-sky-300",
    locked: "bg-slate-50 ring-slate-200",
    later: "bg-slate-50 ring-slate-200",
  };
  const clue = (
    <span className="flex items-center gap-1 text-2xl" aria-label={v.concept_labels.join(", ")}>
      {v.concepts.map((c) => <span key={c}>{CONCEPT_EMOJI[c]}</span>)}
      {!open && v.concepts.length < 2 && <span className="text-slate-300">{v.concepts.length ? "+ ❔" : "❔ + ❔"}</span>}
    </span>
  );
  return (
    <motion.button
      whileTap={open ? { scale: 0.97 } : undefined}
      animate={v.state === "available" ? { y: [0, -3, 0] } : {}}
      transition={v.state === "available" ? { duration: 1.6, repeat: Infinity } : {}}
      disabled={!open}
      onClick={onPlay}
      className={`flex h-full min-h-36 w-full flex-col items-center justify-center gap-1 rounded-2xl p-3 text-center ring-2 ${style[v.state]}`}
    >
      <span className="text-4xl" aria-hidden>{v.emoji}</span>
      <span className="font-extrabold leading-tight text-slate-800">{v.title}</span>
      {clue}
      <span className="text-xs font-bold text-slate-500">
          {v.state === "chosen" && `✅ ${s.replay}`}
          {v.state === "available" && `✨ ${s.watch}`}
          {v.state === "what_if" && `🔮 ${s.watch}`}
          {v.state === "partial" && s.teachToOpen}
          {v.state === "locked" && s.teachToOpen}
          {v.state === "later" && s.comingLater}
      </span>
    </motion.button>
  );
}
