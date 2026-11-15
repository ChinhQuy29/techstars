import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { Concept, Language, TeachConceptInfo, TownInfo, TownScene } from "../api";
import { BuildingArt } from "../components/town/Buildings";
import Journey from "../components/town/Journey";
import SkillScene from "../components/town/SkillScene";
import StudyTown from "../components/town/StudyTown";
import { t } from "../i18n";
import type { useSpeech } from "../robot/useSpeech";

const STEP_MS = 1800;
/** `startStory` value that opens the Journey tab without playing a scene. */
export const JOURNEY_TAB = "*";

interface Props {
  sessionId: string;
  language: Language;
  speech: ReturnType<typeof useSpeech>;
  /** Go straight into this place (from the "new place" banner). */
  startConcept?: Concept | null;
  /** Go straight into this story scene (from a "new story scene" notification). */
  startStory?: string | null;
  onBackToHomework: () => void;
  onLearn: (concept: TeachConceptInfo | null) => void;
  /** Phone layout (docs/10-mobile-ui.md): Town and Journey are bottom tabs, so the header only switches Town/Scrapbook. */
  phone?: boolean;
  /** Show "Back to homework" (phone: only while a lesson is paused). Default true. */
  showBack?: boolean;
}

/**
 * Lumi's Town page (docs/03-lumis-town.md): a walkable map, and one illustrated scene per skill
 * the child has taught. Read-only: places open from Lumi's stars; every number comes from the backend.
 */
export default function TownPage({
  sessionId, language, speech, startConcept = null, startStory = null, onBackToHomework, onLearn, phone = false, showBack = true,
}: Props) {
  const s = t(language);
  const [info, setInfo] = useState<TownInfo | null>(null);
  const [scene, setScene] = useState<TownScene | null>(null);
  const [stage, setStage] = useState(0);
  const [tab, setTab] = useState<"town" | "scrapbook" | "journey">(startStory ? "journey" : "town");
  const [bubble, setBubble] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { speak, stopSpeaking } = speech;

  const load = useCallback(async () => {
    try {
      setError(false);
      const i = await api.town(sessionId, language);
      setInfo(i);
      setBubble(i.dream);
    } catch {
      setError(true);
    }
  }, [sessionId, language]);

  const visit = useCallback(
    async (concept: Concept) => {
      stopSpeaking();
      try {
        setError(false);
        const sc = await api.townScene(sessionId, language, concept);
        if (!sc.unlocked) {
          setBubble(sc.say); // closed: Lumi explains why it needs a teacher
          void speak(sc.say);
          return;
        }
        setScene(sc);
        setStage(1);
        void speak(sc.say);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError(true);
      }
    },
    [sessionId, language, speak, stopSpeaking],
  );

  useEffect(() => {
    if (startStory) return; // the Journey tab loads itself
    load();
    if (startConcept) visit(startConcept);
    return () => stopSpeaking();
    // open once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play the scene one caption line at a time (picture + board follow the same stage).
  useEffect(() => {
    if (!scene || stage >= scene.lines.length) return;
    const id = window.setTimeout(() => setStage((n) => n + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [scene, stage]);

  const sceneDone = !!scene && stage >= scene.lines.length;
  const backToTown = () => {
    stopSpeaking();
    setScene(null);
    load();
  };

  if (!scene && tab === "town") {
    return (
      <StudyTown sessionId={sessionId} language={language} onLearn={onLearn}
        notice={bubble !== info?.dream ? bubble : null}
        actions={
          <>
            <button type="button" onClick={() => setTab("scrapbook")}>📔 {s.scrapbook}</button>
            {!phone && <button type="button" onClick={() => setTab("journey")}>🌙 {s.journey}</button>}
            {showBack && (
              <button type="button" onClick={() => { stopSpeaking(); onBackToHomework(); }}>📒 {s.backToHomework}</button>
            )}
          </>
        }
      />
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label={s.town}>
      {/* header */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <h2 className={`font-extrabold text-teal-700 ${phone ? "text-2xl" : "text-3xl"}`}>
          {scene ? `🏘️ ${scene.title}` : phone && tab === "journey" ? `🌙 ${s.journey}` : `🏘️ ${s.town}`}
        </h2>
        <div className="flex flex-wrap gap-2">
          {scene ? (
            <button className="btn-kid !min-h-12 bg-white !py-2 text-base text-slate-700 ring-2 ring-slate-200" onClick={backToTown}>
              🗺️ {s.town}
            </button>
          ) : phone && tab === "journey" ? null : (
            <>
              <button
                className="btn-small bg-white text-slate-700 ring-1 ring-slate-200"
                onClick={() => setTab("town")}
              >
                🗺️ {s.town}
              </button>
              <button
                className={`btn-small ${tab === "scrapbook" ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                onClick={() => setTab("scrapbook")}
                aria-pressed={tab === "scrapbook"}
              >
                📔 {s.scrapbook}
              </button>
              {!phone && (
                <button
                  className={`btn-small ${tab === "journey" ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                  onClick={() => setTab("journey")}
                  aria-pressed={tab === "journey"}
                >
                  🌙 {s.journey}
                </button>
              )}
            </>
          )}
          {showBack && (
            <button className="btn-kid !min-h-12 bg-violet-500 !py-2 text-base text-white" onClick={() => { stopSpeaking(); onBackToHomework(); }}>
              📒 {s.backToHomework}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 p-3 text-rose-800 ring-1 ring-rose-200">
          😵 {s.oopsError}
          <button className="btn-small bg-white" onClick={() => (scene ? visit(scene.concept) : load())}>
            🔁 {s.tryAgain}
          </button>
        </div>
      )}

      {/* one skill's scene */}
      {scene && (
        <div className="card p-3 sm:p-5">
          <SkillScene scene={scene} stage={Math.max(1, stage)} talking={speech.speaking} s={s} />
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button className="btn-kid bg-sun text-xl text-slate-900" disabled={!sceneDone} onClick={() => visit(scene.concept)}>
              🔄 {s.anotherCustomer}
            </button>
            <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" onClick={backToTown}>
              🗺️ {s.town}
            </button>
          </div>
        </div>
      )}

      {/* Lumi's Journey to the moon */}
      {!scene && tab === "journey" && (
        <Journey sessionId={sessionId} language={language} speech={speech} startKey={startStory === JOURNEY_TAB ? null : startStory} s={s} />
      )}

      {/* the scrapbook */}
      {!scene && tab === "scrapbook" && info && (
        <section className="notebook card p-4 sm:p-6">
          <h3 className="mb-3 pl-14 text-2xl font-extrabold text-violet-700">📔 {s.scrapbook}</h3>
          {info.scrapbook.length === 0 && <p className="pl-14 text-lg text-slate-500">{s.scrapbookEmpty}</p>}
          <ul className="flex flex-col gap-3 pl-14">
            {info.scrapbook.map((e) => {
              const place = info.places.find((p) => p.concept === e.concept);
              return (
                <li key={e.concept} className="flex items-center gap-4 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-violet-100">
                  <div className="w-20 shrink-0"><BuildingArt concept={e.concept} open /></div>
                  <div>
                    <p className="text-lg font-extrabold text-slate-800">
                      {place?.emoji} {s.concepts[e.concept]} ·{" "}
                      <span className="text-amber-500">{"★".repeat(Math.floor(e.stars))}{e.stars % 1 ? "½" : ""}</span>
                    </p>
                    <p className="text-slate-500">{s.youTaughtMe}</p>
                    <p className="font-hand text-2xl text-indigo-700">“{e.quote}”</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}
