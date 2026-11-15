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
    <section className="flex min-h-full w-full flex-col items-center justify-center gap-3 px-3 py-4 text-center">
      {onBack && <button type="button" onClick={onBack} className="btn-kid self-start bg-white !px-3 text-base text-slate-700">← {s.back}</button>}
      <h1 className="text-3xl font-extrabold tracking-tight text-[#202740] sm:text-4xl">{s.chooseDream}</h1>

      <div className="grid w-full max-w-4xl grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-2 sm:-mt-8">
        {arrow(-1, s.prevDream)}
        <motion.div
          onPanEnd={(_, { offset }) => {
            if (Math.abs(offset.x) > Math.max(60, Math.abs(offset.y))) go(offset.x < 0 ? 1 : -1);
          }}
          className="col-span-3 col-start-1 row-start-1 min-w-0 touch-pan-y sm:col-span-1 sm:col-start-2"
        >
          <div className="grid h-[clamp(16rem,39dvh,21rem)] w-full select-none grid-cols-1 grid-rows-1 overflow-hidden sm:h-[clamp(20.5rem,min(54dvh,100dvh-25rem),31rem)]" aria-hidden="true">
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
      <button className="btn-kid lumi-primary px-12 text-xl" onClick={() => onSelect(dream.id)}>
        {s.selectDream}
      </button>
    </section>
  );
}
