import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { Language } from "../api";
import { publicAsset } from "../assets";
import { OUTFIT_SIZE } from "../components/mascot/lumiAssets";
import { DREAMS, type DreamId } from "../dream";
import { t } from "../i18n";

const pickerArt = (layer: DreamId | "lumi") => publicAsset(`assets/dreams/picker/${layer}.svg`);

/**
 * "Choose Lumi's dream" (docs/12-dreams.md, design: docs/assets/new_lumi_screen.png). One dream at a time with
 * arrows (or a swipe) to browse, and Select. The choice only changes the stories in Lumi's homework.
 */
export default function DreamPicker({ language, current, onSelect, onBack }: {
  language: Language;
  current: DreamId | null;
  onSelect: (d: DreamId) => void;
  onBack?: () => void;
}) {
  const s = t(language);
  const reduceMotion = useReducedMotion();
  const [{ index, direction }, setBrowse] = useState(() => ({
    index: Math.max(0, DREAMS.findIndex((d) => d.id === current)),
    direction: 0,
  }));
  const dream = DREAMS[index];
  const info = s.dreams[dream.id];
  const many = DREAMS.length > 1;
  const go = (step: number) => {
    if (!many) return;
    setBrowse(({ index }) => ({
      index: (index + step + DREAMS.length) % DREAMS.length,
      direction: step,
    }));
  };

  const arrow = (step: number, label: string) => (
    <button
      onClick={() => go(step)}
      disabled={!many}
      aria-label={label}
      className={`z-10 row-start-1 grid size-14 place-items-center rounded-full bg-[#7FA8EE] text-2xl font-black text-white shadow-sm transition active:scale-95 disabled:opacity-40 ${step < 0 ? "col-start-1 justify-self-start" : "col-start-3 justify-self-end"}`}
    >
      {step < 0 ? "‹" : "›"}
    </button>
  );

  return (
    <section className={`lumi-dream-picker relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 overflow-hidden px-3 pb-4 text-center ${onBack ? "pt-20" : "pt-4"}`}>
      {onBack && <button type="button" onClick={onBack} className="btn-kid absolute top-3 left-3 z-20 bg-white !px-3 text-base text-slate-700">← {s.back}</button>}
      <h1 className="shrink-0 text-[clamp(1.35rem,6vw,1.875rem)] font-extrabold tracking-tight text-[#202740] sm:text-4xl">{s.chooseDream}</h1>

      <div className="grid min-h-0 w-full max-w-4xl flex-1 grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] grid-rows-[minmax(0,1fr)_auto] items-center gap-x-2">
        {arrow(-1, s.prevDream)}
        <motion.div
          onPanEnd={(_, { offset }) => {
            if (Math.abs(offset.x) > Math.max(60, Math.abs(offset.y))) go(offset.x < 0 ? 1 : -1);
          }}
          className="col-span-3 col-start-1 row-start-1 h-full max-h-[21rem] min-h-0 min-w-0 touch-none sm:col-span-1 sm:col-start-2 sm:max-h-[31rem]"
        >
          <div className="grid h-full w-full select-none grid-cols-1 grid-rows-1 overflow-hidden" aria-hidden="true">
            {/* Keep every outfit loaded on the same canvas. Only the selected overlay moves. */}
            <img
              src={pickerArt("lumi")}
              alt=""
              width={OUTFIT_SIZE.w}
              height={OUTFIT_SIZE.h}
              draggable={false}
              className="pointer-events-none col-start-1 row-start-1 h-full min-w-0 w-full object-contain"
            />
            {DREAMS.map(({ id }) => {
              const active = id === dream.id;
              const slideIn = active && direction !== 0 && !reduceMotion;
              return (
                <motion.img
                  key={id}
                  src={pickerArt(id)}
                  alt=""
                  width={OUTFIT_SIZE.w}
                  height={OUTFIT_SIZE.h}
                  draggable={false}
                  initial={false}
                  animate={slideIn ? { x: [direction * 44, 0], opacity: [0, 1] } : { x: 0, opacity: 1 }}
                  transition={{ duration: slideIn ? 0.28 : 0, ease: "easeOut" }}
                  className={`pointer-events-none col-start-1 row-start-1 h-full min-w-0 w-full object-contain ${active ? "" : "invisible"}`}
                />
              );
            })}
          </div>
        </motion.div>
        {arrow(1, s.nextDream)}
        <div aria-live="polite" aria-atomic="true" className="col-span-3 row-start-2 mx-auto">
          <p className="mt-2 text-2xl font-extrabold text-[#202740]">{dream.emoji} {info.name}</p>
          <p className="font-hand flex min-h-[3.5rem] max-w-xs items-start justify-center text-xl leading-7 text-slate-600">“{info.line}”</p>
        </div>
      </div>

      {!many && <p className="text-sm text-slate-500">{s.moreDreamsSoon}</p>}
      <button className="btn-kid lumi-primary shrink-0 px-12 text-xl" onClick={() => onSelect(dream.id)}>
        {s.selectDream}
      </button>
    </section>
  );
}
