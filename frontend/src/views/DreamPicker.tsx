import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Language } from "../api";
import { DREAMS, type DreamId } from "../dream";
import { t } from "../i18n";

/**
 * "Choose Lumi's dream" (docs/12-dreams.md, design: docs/assets/new_lumi_screen.png). One dream at a time with
 * arrows (or a swipe) to browse, and Select. The choice only changes the stories in Lumi's homework.
 */
export default function DreamPicker({ language, current, onSelect }: {
  language: Language;
  current: DreamId | null;
  onSelect: (d: DreamId) => void;
}) {
  const s = t(language);
  const [i, setI] = useState(() => Math.max(0, DREAMS.findIndex((d) => d.id === current)));
  const [dir, setDir] = useState(1);
  const dream = DREAMS[i];
  const info = s.dreams[dream.id];
  const many = DREAMS.length > 1;
  const go = (step: number) => {
    if (!many) return;
    setDir(step);
    setI((x) => (x + step + DREAMS.length) % DREAMS.length);
  };

  const arrow = (step: number, label: string) => (
    <button
      onClick={() => go(step)}
      disabled={!many}
      aria-label={label}
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#7FA8EE] text-2xl font-black text-white shadow-sm transition active:scale-95 disabled:opacity-40"
    >
      {step < 0 ? "‹" : "›"}
    </button>
  );

  return (
    <section className="flex min-h-full w-full flex-col items-center justify-center gap-4 px-3 py-6 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight text-[#202740] sm:text-4xl">{s.chooseDream}</h1>

      <div className="flex w-full max-w-xl items-center justify-between gap-2">
        {arrow(-1, s.prevDream)}
        <div className="relative flex min-w-0 flex-1 flex-col items-center">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={dream.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              drag={many ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, d) => d.offset.x < -60 ? go(1) : d.offset.x > 60 ? go(-1) : undefined}
              className="flex flex-col items-center"
            >
              <motion.img
                src={dream.image}
                alt=""
                width={496}
                height={592}
                draggable={false}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="h-auto w-52 select-none sm:w-64"
              />
              <p className="mt-2 text-2xl font-extrabold text-[#202740]">
                {dream.emoji} {info.name}
              </p>
              <p className="font-hand text-xl text-slate-600">“{info.line}”</p>
            </motion.div>
          </AnimatePresence>
        </div>
        {arrow(1, s.nextDream)}
      </div>

      {!many && <p className="text-sm text-slate-500">{s.moreDreamsSoon}</p>}
      <button className="btn-kid lumi-primary px-12 text-xl" onClick={() => onSelect(dream.id)}>
        {s.selectDream}
      </button>
    </section>
  );
}
