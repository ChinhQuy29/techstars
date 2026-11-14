import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { Concept, Language, TownInfo, TownScene } from "../api";
import LumiMascot from "../components/mascot/LumiMascot";
import { BuildingArt } from "../components/town/Buildings";
import Journey from "../components/town/Journey";
import SkillScene from "../components/town/SkillScene";
import { art, artUrl, TownArt } from "../components/town/townArt";
import { t } from "../i18n";
import type { useSpeech } from "../robot/useSpeech";

const STEP_MS = 1800;
/** `startStory` value that opens the Journey tab without playing a scene. */
export const JOURNEY_TAB = "*";

type Spot = { left: number; bottom: number; width: number };

/** Where each place stands on the map (percent of the map box): on the four plots of the illustrated
 * background, or on the code-drawn hills when that image is missing. */
const SPOT_ART: Record<Concept, Spot> = {
  carry: { left: 4, bottom: 36, width: 21 },
  borrow: { left: 28, bottom: 36, width: 20 },
  off_by_one: { left: 52, bottom: 36, width: 19 },
  mul: { left: 75, bottom: 36, width: 21 },
};
const SPOT_DRAWN: Record<Concept, Spot> = {
  carry: { left: 3, bottom: 14, width: 23 },
  borrow: { left: 27, bottom: 24, width: 19 },
  off_by_one: { left: 55, bottom: 24, width: 17 },
  mul: { left: 74, bottom: 14, width: 23 },
};
const SPOT = artUrl(art.townBackground) ? SPOT_ART : SPOT_DRAWN;

interface Props {
  sessionId: string;
  language: Language;
  speech: ReturnType<typeof useSpeech>;
  /** Go straight into this place (from the "new place" banner). */
  startConcept?: Concept | null;
  /** Go straight into this story scene (from a "new story scene" notification). */
  startStory?: string | null;
  onBackToHomework: () => void;
  /** Phone layout (docs/10-mobile-ui.md): Town and Journey are bottom tabs, so the header only switches Town/Scrapbook. */
  phone?: boolean;
  /** Show "Back to homework" (phone: only while a lesson is paused). Default true. */
  showBack?: boolean;
}

/**
 * Lumi's Town page (docs/03-lumis-town.md): an illustrated map, and one illustrated scene per skill
 * the child has taught. Read-only: places open from Lumi's stars; every number comes from the backend.
 */
export default function TownPage({
  sessionId, language, speech, startConcept = null, startStory = null, onBackToHomework, phone = false, showBack = true,
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
                className={`btn-small ${tab === "town" ? "bg-teal-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                onClick={() => setTab("town")}
                aria-pressed={tab === "town"}
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

      {/* the map */}
      {!scene && tab === "town" && info && (
        <>
          <div className="card overflow-hidden p-2 sm:p-3">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
              <TownArt
                name={art.townBackground}
                className="absolute inset-0 h-full w-full object-cover"
                fallback={
                  <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
                    <defs>
                      <linearGradient id="town-sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#93C5FD" />
                        <stop offset="1" stopColor="#E0F2FE" />
                      </linearGradient>
                    </defs>
                    <rect width="800" height="450" fill="url(#town-sky)" />
                    <circle cx="700" cy="70" r="40" fill="#FDE68A" />
                    {[[110, 70], [300, 45], [520, 90]].map(([x, y], i) => (
                      <g key={i} fill="#FFFFFF" opacity="0.9">
                        <ellipse cx={x} cy={y} rx="50" ry="17" />
                        <ellipse cx={x + 28} cy={y - 11} rx="28" ry="15" />
                      </g>
                    ))}
                    <path d="M0 250 Q150 200 300 240 T600 230 T800 245 V450 H0 Z" fill="#86EFAC" />
                    <path d="M0 300 Q200 270 400 295 T800 285 V450 H0 Z" fill="#4ADE80" />
                    {/* the road */}
                    <path d="M0 400 Q400 360 800 400 V450 H0 Z" fill="#CBD5E1" />
                    {[60, 200, 340, 480, 620, 760].map((x) => (
                      <rect key={x} x={x} y="410" width="50" height="6" rx="3" fill="#FFFFFF" />
                    ))}
                    {/* trees */}
                    {[[250, 300], [520, 300], [790, 290]].map(([x, y], i) => (
                      <g key={i}>
                        <rect x={x - 5} y={y} width="10" height="40" fill="#92400E" />
                        <circle cx={x} cy={y - 10} r="26" fill="#22C55E" />
                      </g>
                    ))}
                  </svg>
                }
              />

              {info.places.map((pl) => {
                const spot = SPOT[pl.concept];
                return (
                  <motion.button
                    key={pl.concept}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => visit(pl.concept)}
                    className="absolute flex flex-col items-center rounded-2xl focus-visible:outline-4"
                    style={{ left: `${spot.left}%`, bottom: `${spot.bottom}%`, width: `${spot.width}%` }}
                    aria-label={`${pl.name}: ${pl.unlocked ? s.visit : pl.need}`}
                  >
                    <BuildingArt concept={pl.concept} open={pl.unlocked} />
                    <span
                      className={`-mt-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold shadow sm:text-sm ${
                        pl.unlocked ? "bg-amber-300 text-amber-900" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {pl.unlocked ? pl.emoji : "🔒"}
                      {/* names only from sm up: on phones they'd cover the shops (the button row below names them) */}
                      <span className="hidden sm:inline"> {pl.name}</span>
                    </span>
                  </motion.button>
                );
              })}

              {/* Lumi in town, with what it's thinking about */}
              <div className="absolute bottom-[6%] left-1/2 w-[11%] -translate-x-1/2">
                <TownArt
                  name={art.lumi(bubble && info && bubble !== info.dream ? "confused" : "waving")}
                  className="h-auto w-full drop-shadow-lg"
                  fallback={
                    <LumiMascot
                      expression={bubble && info && bubble !== info.dream ? "confused" : "happy"}
                      pose="front"
                      talking={speech.speaking}
                      label="auto"
                      className="w-full"
                    />
                  }
                />
              </div>
              <AnimatePresence mode="popLayout">
                {bubble && (
                  <motion.div
                    key={bubble}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-1/2 top-[2%] w-[72%] -translate-x-1/2 rounded-xl bg-white/95 px-2 py-1 text-center text-[11px] font-semibold leading-snug text-slate-700 shadow-lg ring-1 ring-sky-100 sm:top-[3%] sm:w-[64%] sm:rounded-2xl sm:px-3 sm:py-2 sm:text-lg"
                  >
                    {bubble}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* the same places as big buttons: easy on small screens and for screen readers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {info.places.map((pl) => (
              <button
                key={pl.concept}
                onClick={() => visit(pl.concept)}
                className={`card flex items-center gap-3 p-3 text-left ${pl.unlocked ? "ring-2 ring-amber-300" : "opacity-80"}`}
              >
                <span className={`text-4xl ${pl.unlocked ? "" : "grayscale"}`} aria-hidden>{pl.emoji}</span>
                <span>
                  <span className="block text-lg font-extrabold text-slate-800">{pl.name}</span>
                  <span className="block text-sm text-slate-600">
                    {pl.unlocked ? `${"★".repeat(Math.floor(pl.stars))}${pl.stars % 1 ? "½" : ""} · 👋 ${s.visit}` : `🔒 ${pl.need}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
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
