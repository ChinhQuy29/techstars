import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import * as api from "../api";
import type { Language, TeachConceptInfo } from "../api";
import LumiMascot from "../components/mascot/LumiMascot";
import type { Dream } from "../dream";
import { CONCEPT_EMOJI, t, type TeachConcept } from "../i18n";

/** How brightly a skill light glows: dim until taught, brighter with each star (Lumi's cyan, `#6FE7EC`). */
function glow(stars: number): string {
  if (stars <= 0) return "none";
  const a = Math.min(1, 0.25 + stars * 0.25);
  return `0 0 ${6 + stars * 6}px rgba(111,231,236,${a}), inset 0 0 0 2px rgba(111,231,236,${a})`;
}

/**
 * Phone home (docs/10-mobile-ui.md): Lumi's Brain. Lumi sits on top of its brain screen; every skill is a light the
 * child can tap, in any order. A light glows brighter as Lumi earns stars. No track and no suggested next skill: the
 * child chooses. The usual gates (quick warm-up, Help practice) still apply once a skill is picked.
 */
export default function PhoneHome({ sessionId, language, remembered, onStart, dream, onChangeDream }: {
  sessionId: string;
  language: Language;
  remembered: number;
  /** null = let Lumi pick. */
  onStart: (c: TeachConceptInfo | null) => void;
  /** Lumi's dream (docs/12-dreams.md): Lumi wears its outfit; tapping Lumi opens the dream picker. */
  dream?: Dream | null;
  onChangeDream?: () => void;
}) {
  const s = t(language);
  const [menu, setMenu] = useState<TeachConceptInfo[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    api.teachConcepts(sessionId, language).then(setMenu).catch(() => setFailed(true));
  };
  useEffect(load, [sessionId, language]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-full flex-col gap-2 px-3 pb-4">
      <section className="flex items-end gap-2">
        {dream ? (
          <button onClick={onChangeDream} aria-label={s.changeDream} className="relative w-20 shrink-0 rounded-2xl active:scale-95">
            <img src={dream.image} alt="" width={496} height={592} className="h-auto w-full select-none" draggable={false} />
            <span className="absolute -right-1 bottom-0 grid h-7 w-7 place-items-center rounded-full bg-white text-sm shadow ring-1 ring-indigo-200" aria-hidden>
              ✏️
            </span>
          </button>
        ) : (
          <LumiMascot expression="default" pose="threeQuarter" wave label={s.welcomeHi} className="w-20 shrink-0" />
        )}
        <div className="relative mb-3 flex-1 rounded-2xl bg-white px-3 py-2 text-base leading-snug text-slate-800 shadow-sm ring-2 ring-sky-200">
          {dream && (
            <button onClick={onChangeDream} className="mb-1 rounded-full bg-indigo-50 px-2 py-0.5 text-sm font-bold text-indigo-900 ring-1 ring-indigo-200">
              {dream.emoji} {s.dreams[dream.id].name}
            </button>
          )}
          <span className="block font-extrabold">{s.brainAsk}</span>
          {remembered > 0 && (
            <span className="mt-0.5 block text-sm text-teal-700">
              👋 {remembered === 1 ? s.welcomeBackOne : s.welcomeBack.replace("{n}", String(remembered))}
            </span>
          )}
        </div>
      </section>

      {/* Lumi's Brain: the robot's face-screen navy, with one light per skill. */}
      <section aria-label={s.lumisBrain} className="rounded-[2rem] bg-[#0F2D3D] p-3 shadow-lg ring-4 ring-[#C7D6DE]">
        <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-extrabold uppercase tracking-wide text-[#6FE7EC]">
          <span>🧠 {s.lumisBrain}</span>
          <span className="font-hand text-base normal-case tracking-normal text-[#6FE7EC]/80">{s.pickAny}</span>
        </h2>

        {failed ? (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 p-4 text-center">
            <p className="text-lg font-bold text-white">😵 {s.oopsError}</p>
            <button className="btn-kid bg-white text-slate-800" onClick={load}>
              🔁 {s.tryAgain}
            </button>
          </div>
        ) : !menu ? (
          <p className="animate-pulse py-16 text-center text-4xl tracking-widest text-[#6FE7EC]/50" aria-label="loading">• • •</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {menu.map((c, i) => {
              const name = s.concepts[c.concept as TeachConcept] ?? c.label;
              return (
                <motion.li key={c.concept} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}>
                  <button
                    onClick={() => onStart(c)}
                    aria-label={`${name}, ${c.stars} of 3 stars`}
                    style={{ boxShadow: glow(c.stars) }}
                    className={`relative flex h-full min-h-[5.5rem] w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 text-center transition active:scale-95 ${
                      c.stars > 0 ? "bg-[#14425A]" : "bg-white/5 ring-1 ring-white/15"
                    }`}
                  >
                    <span aria-hidden className={`text-3xl ${c.stars > 0 ? "" : "opacity-70"}`}>{CONCEPT_EMOJI[c.concept]}</span>
                    <span className="text-[0.8rem] font-extrabold leading-tight text-white">{name}</span>
                    <span aria-hidden className="flex gap-1 pt-0.5">
                      {[0, 1, 2].map((k) => (
                        <span
                          key={k}
                          className={`h-2 w-2 rounded-full ${
                            c.stars >= k + 1 ? "bg-[#6FE7EC]" : c.stars > k ? "bg-[#6FE7EC]/50" : "bg-white/20"
                          }`}
                        />
                      ))}
                    </span>
                    {!c.ready && (
                      <span aria-hidden className="absolute top-1 right-1 text-xs">{c.gate === "warmup" ? "🏃" : "🙋"}</span>
                    )}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      <button className="btn-kid self-center bg-white text-slate-700 ring-2 ring-slate-200" disabled={!menu} onClick={() => onStart(null)}>
        🎲 {s.lumiPicks}
      </button>
    </div>
  );
}
