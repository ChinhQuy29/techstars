import { AnimatePresence, motion } from "framer-motion";
import type { SceneParts } from "../../api";

/**
 * Column addition / subtraction that fills in as Lumi explains (stage = caption line shown).
 * Display only: every digit, carried 1 and borrowed digit comes from the backend `parts`.
 */
export default function ColumnBoard({ parts, stage, lastStage, unit = "", theme = "register" }: {
  parts: SceneParts;
  stage: number;
  lastStage: number;
  unit?: string;
  theme?: "register" | "chalk" | "jar";
}) {
  const [a10, a1] = parts.a_digits ?? [0, 0];
  const [b10, b1] = parts.b_digits ?? [0, 0];
  const add = parts.op === "+";
  const regroup = !!parts.regroup;
  // Which caption line reveals what (matches teach.demo_steps order).
  const onesAt = 1;
  const markAt = add ? 2 : 1; // carry is written on its own line; borrowing is in the ones line
  const tensAt = add && regroup ? 3 : 2;
  const showOnes = stage >= onesAt;
  const showMark = regroup && stage >= markAt;
  const showTens = stage >= tensAt;
  const done = stage >= lastStage;

  const skin = {
    register: "bg-slate-900 text-emerald-300 ring-4 ring-slate-700",
    chalk: "bg-emerald-900 text-white ring-8 ring-amber-800",
    jar: "bg-sky-950 text-sky-100 ring-4 ring-sky-700",
  }[theme];

  const cell = "grid h-12 w-10 place-items-center sm:h-14 sm:w-12";
  const pop = { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { opacity: 0 } };

  return (
    <div className={`font-hand inline-flex flex-col items-end rounded-2xl px-5 py-3 text-4xl sm:text-5xl ${skin}`} aria-hidden>
      {/* marks row: carried 1, or the borrowed digits */}
      <div className="flex h-8 text-2xl sm:text-3xl">
        <span className={cell} />
        <span className={`${cell} text-amber-300`}>
          <AnimatePresence>{showMark && <motion.span key="t" {...pop}>{add ? "1" : parts.borrow_tens}</motion.span>}</AnimatePresence>
        </span>
        <span className={`${cell} text-amber-300`}>
          <AnimatePresence>{showMark && !add && <motion.span key="o" {...pop}>{parts.borrow_ones}</motion.span>}</AnimatePresence>
        </span>
      </div>
      <div className="flex">
        <span className={cell} />
        <span className={`${cell} relative`}>
          {a10}
          {showMark && !add && <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} className="absolute h-1 w-9 origin-left -rotate-12 rounded bg-rose-400" />}
        </span>
        <span className={`${cell} relative`}>
          {a1}
          {showMark && !add && <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} className="absolute h-1 w-9 origin-left -rotate-12 rounded bg-rose-400" />}
        </span>
      </div>
      <div className="flex">
        <span className={cell}>{add ? "+" : "−"}</span>
        <span className={cell}>{b10}</span>
        <span className={cell}>{b1}</span>
      </div>
      <div className="my-1 h-1 w-full rounded bg-current opacity-70" />
      <div className="flex">
        <span className={cell} />
        <span className={cell}>
          <AnimatePresence>{showTens && <motion.span key="tens" {...pop}>{parts.tens}</motion.span>}</AnimatePresence>
        </span>
        <span className={`${cell} ${stage === onesAt ? "rounded-xl bg-white/15" : ""}`}>
          <AnimatePresence>{showOnes && <motion.span key="ones" {...pop}>{parts.ones}</motion.span>}</AnimatePresence>
        </span>
      </div>
      <AnimatePresence>
        {done && (
          <motion.div key="total" {...pop} className="mt-1 rounded-xl bg-white/15 px-3 text-3xl font-bold sm:text-4xl">
            = {parts.answer}
            {unit}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
