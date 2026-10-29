import { AnimatePresence, motion } from "framer-motion";
import type { TownScene } from "../../api";
import type { Strings } from "../../i18n";
import LumiMascot from "../mascot/LumiMascot";
import { BUILDING } from "./Buildings";
import ColumnBoard from "./ColumnBoard";
import Critter, { critterFor } from "./Critter";
import { art, artUrl, TownArt } from "./townArt";

/** Sky + ground backdrop, tinted per place. */
function Backdrop({ ground, sky }: { ground: string; sky: string }) {
  return (
    <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`sky-${sky}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky} />
          <stop offset="1" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill={`url(#sky-${sky})`} />
      <circle cx="690" cy="70" r="38" fill="#FDE68A" />
      {[[120, 70], [330, 50], [520, 95]].map(([x, y], i) => (
        <g key={i} fill="#FFFFFF" opacity="0.9">
          <ellipse cx={x} cy={y} rx="46" ry="16" />
          <ellipse cx={x + 26} cy={y - 10} rx="26" ry="14" />
        </g>
      ))}
      <path d="M0 330 Q200 300 400 325 T800 315 V450 H0 Z" fill={ground} />
      <rect y="380" width="800" height="70" fill="#E2E8F0" />
      <rect y="410" width="800" height="6" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
}

function Coin({ delay, from, to, label }: { delay: number; from: number; to: number; label?: string }) {
  return (
    <motion.div
      className="absolute bottom-[34%] grid h-5 w-5 place-items-center sm:h-9 sm:w-9"
      initial={{ left: `${from}%`, opacity: 0, y: 0 }}
      animate={{ left: `${to}%`, opacity: [0, 1, 1, 0.9], y: [0, -40, 0] }}
      transition={{ duration: 1.1, delay }}
    >
      <TownArt
        name={art.prop.coin}
        className="absolute inset-0 h-full w-full drop-shadow"
        fallback={<span className="absolute inset-0 rounded-full bg-amber-300 shadow ring-2 ring-amber-600" />}
      />
      <span className="relative text-[8px] font-black text-amber-900 sm:text-xs">{label ?? "¢"}</span>
    </motion.div>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-hand flex items-center gap-1 rounded-lg bg-white px-1.5 py-0.5 text-sm text-slate-800 shadow-md ring-2 ring-amber-300 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-1 sm:text-3xl ${className}`}>
      {children}
    </div>
  );
}

/** A small item picture for a price tag, or its emoji when the picture is missing. */
function Item({ name, emoji }: { name: string; emoji: string }) {
  return <TownArt name={name} className="h-[1.2em] w-auto" fallback={<span aria-hidden>{emoji}</span>} />;
}

const THEME = {
  carry: { sky: "#BAE6FD", ground: "#86EFAC", board: "register" as const, unit: "¢" },
  borrow: { sky: "#C7D2FE", ground: "#A7F3D0", board: "register" as const, unit: "¢" },
  off_by_one: { sky: "#BFDBFE", ground: "#BBF7D0", board: "jar" as const, unit: "" },
  mul: { sky: "#FBCFE8", ground: "#FDE68A", board: "chalk" as const, unit: "" },
};

/**
 * One illustrated skill scene. `stage` = how many caption lines are showing (1 … lines.length).
 * The picture, the board and the captions all follow the same stage, so they never disagree.
 */
export default function SkillScene({ scene, stage, talking, s }: {
  scene: TownScene;
  stage: number;
  talking: boolean;
  s: Strings;
}) {
  const p = scene.parts!;
  const theme = THEME[scene.concept];
  const last = scene.lines.length - 1;
  const step = stage - 1; // index of the current caption line
  const done = step >= last;
  const kind = critterFor(scene.problem ?? scene.title);
  const Building = BUILDING[scene.concept];
  const coinArt = !!artUrl(art.prop.coin);
  const trayUrl = artUrl(art.prop.tray);
  const jarArt = artUrl(art.shop("off_by_one", true));

  return (
    <div className="flex flex-col gap-4">
      {/* the picture */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl ring-4 ring-white shadow-xl">
        <TownArt
          name={art.sceneBackground(scene.concept)}
          className="absolute inset-0 h-full w-full object-cover"
          fallback={<Backdrop sky={theme.sky} ground={theme.ground} />}
        />

        {/* the place itself */}
        {scene.concept !== "off_by_one" && scene.concept !== "mul" && (
          <div className="absolute bottom-[6%] left-1/2 h-[70%] -translate-x-1/2">
            <TownArt
              name={art.shop(scene.concept, true)}
              className="h-full w-auto max-w-none drop-shadow-lg"
              fallback={<svg viewBox="0 0 200 200" className="h-full" aria-hidden><Building /></svg>}
            />
          </div>
        )}
        {scene.concept === "mul" && (
          <div className="absolute bottom-[6%] left-[22%] h-[34%] opacity-90">
            <TownArt
              name={art.shop(scene.concept, true)}
              className="h-full w-auto max-w-none"
              fallback={<svg viewBox="0 0 200 200" className="h-full" aria-hidden><Building /></svg>}
            />
          </div>
        )}

        {/* Coin Jar: a big jar that fills (or empties) as Lumi counts */}
        {scene.concept === "off_by_one" && (
          <div className={`absolute left-1/2 -translate-x-1/2 ${jarArt ? "bottom-[6%] h-[72%]" : "bottom-[8%] h-[66%] w-[26%]"}`}>
            {jarArt ? (
              <>
                {/* the illustrated jar shop; the count is a tag drawn in code */}
                <img src={jarArt} alt="" aria-hidden draggable={false} className="pointer-events-none h-full w-auto max-w-none select-none drop-shadow-lg" />
                <div className="absolute inset-x-0 top-[2%] text-center">
                  <Tag className="inline-flex"><Item name={art.prop.coin} emoji="🪙" /> {done ? p.answer : p.a}</Tag>
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-x-[8%] top-0 h-[9%] rounded-lg bg-lime-400 ring-4 ring-lime-700" />
                <div className="absolute inset-x-0 bottom-0 top-[8%] overflow-hidden rounded-[30%] bg-sky-100/80 ring-4 ring-sky-600">
                  <motion.div
                    className="absolute inset-x-0 bottom-0 bg-amber-300"
                    initial={{ height: "35%" }}
                    animate={{ height: done ? (p.op === "+" ? "70%" : "20%") : "35%" }}
                    transition={{ duration: 1.2 }}
                  />
                  <div className="absolute inset-x-0 top-[38%] text-center">
                    <span className="font-hand rounded-lg bg-white px-2 text-2xl text-sky-800 sm:text-3xl">{done ? p.answer : p.a}</span>
                  </div>
                </div>
              </>
            )}
            {step >= 1 &&
              Array.from({ length: Math.min(p.b, 8) }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute left-1/2 -translate-x-1/2 ${coinArt ? "h-7 w-7" : "h-5 w-8 rounded-full bg-amber-300 ring-2 ring-amber-700"}`}
                  initial={p.op === "+" ? { top: "-30%", opacity: 0 } : { top: "40%", opacity: 1 }}
                  animate={p.op === "+" ? { top: "45%", opacity: [0, 1, 0] } : { top: "-30%", x: 80 + i * 6, opacity: [1, 1, 0] }}
                  transition={{ duration: 0.8, delay: i * 0.18 }}
                >
                  {coinArt && <TownArt name={art.prop.coin} className="h-full w-full" />}
                </motion.div>
              ))}
          </div>
        )}

        {/* Bakery: trays of cookies appear one by one with the skip-count */}
        {scene.concept === "mul" && (
          <div className="absolute bottom-[44%] left-[22%] right-[22%] top-[20%] flex flex-wrap content-center items-end justify-center gap-2 sm:gap-3">
            {p.seq!.map((total, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: -12 }}
                animate={step >= 1 ? { opacity: 1, y: 0 } : { opacity: 0 }}
                transition={{ delay: step >= 1 ? i * 0.35 : 0 }}
              >
                <div
                  className={`grid grid-cols-3 gap-1 p-1.5 sm:p-2 ${trayUrl ? "bg-center bg-no-repeat" : "rounded-lg bg-slate-300 shadow ring-2 ring-slate-500"}`}
                  style={trayUrl ? { backgroundImage: `url(${trayUrl})`, backgroundSize: "100% 100%" } : undefined}
                >
                  {Array.from({ length: p.b }).map((__, j) => (
                    <TownArt
                      key={j}
                      name={art.prop.cookie}
                      className="h-3 w-3 sm:h-5 sm:w-5"
                      fallback={<span className="h-3 w-3 rounded-full bg-amber-600 ring-1 ring-amber-800 sm:h-5 sm:w-5" />}
                    />
                  ))}
                </div>
                <span className="font-hand rounded-md bg-white/80 px-1.5 text-lg font-bold text-pink-800 sm:text-2xl">{total}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Lumi */}
        <div className="absolute bottom-[4%] left-[3%] w-[20%]">
          <TownArt
            name={art.lumi(done ? "happy" : "thinking")}
            className="h-auto w-full drop-shadow-lg"
            fallback={<LumiMascot expression={done ? "happy" : "thinking"} pose="threeQuarter" talking={talking} label="auto" className="w-full" />}
          />
        </div>

        {/* the customer */}
        <div className="absolute bottom-[4%] right-[4%] w-[16%]">
          <motion.div animate={done ? { y: [0, -10, 0] } : { y: 0 }} transition={{ duration: 0.6, repeat: done ? 2 : 0 }}>
            <TownArt
              name={art.customer(kind, done)}
              className="h-auto w-full drop-shadow-lg"
              fallback={<Critter kind={kind} happy={done} className="w-full" label={`${kind}`} />}
            />
          </motion.div>
          <AnimatePresence>
            {done && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-[40%] right-0 whitespace-nowrap rounded-xl bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-800 shadow ring-1 ring-slate-200 sm:-top-[46%] sm:rounded-2xl sm:px-3 sm:py-1 sm:text-base"
              >
                {s.thankYouLumi}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* what the customer brings / pays */}
        {scene.concept === "carry" && (
          <div className="absolute right-[21%] top-[8%] flex flex-col gap-1 sm:top-[14%] sm:gap-2">
            <Tag><Item name={art.prop.cup} emoji="🍋" /> {p.a}¢</Tag>
            <Tag><Item name={art.prop.cookie} emoji="🍪" /> {p.b}¢</Tag>
          </div>
        )}
        {scene.concept === "borrow" && (
          <div className="absolute right-[21%] top-[8%] flex flex-col gap-1 sm:top-[14%] sm:gap-2">
            <Tag>💰 {s.paid} {p.a}¢</Tag>
            <Tag>🍬 {s.costs} {p.b}¢</Tag>
          </div>
        )}
        {scene.concept === "mul" && (
          <div className="absolute right-[21%] top-[8%] sm:top-[14%]">
            <Tag>{p.a} × {p.b} <Item name={art.prop.cookie} emoji="🍪" /></Tag>
          </div>
        )}

        {/* the transaction */}
        {done && scene.concept === "carry" && [0, 1, 2].map((i) => <Coin key={i} delay={i * 0.2} from={80} to={20} />)}
        {done && scene.concept === "borrow" && [0, 1].map((i) => <Coin key={i} delay={i * 0.25} from={20} to={80} />)}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute left-1/2 top-[6%] -translate-x-1/2 rounded-2xl bg-green-500 px-4 py-1 text-xl font-extrabold text-white shadow-lg sm:text-3xl"
            >
              {p.answer}
              {theme.unit} ✓
              {[[-22, -12], [-18, 62], [42, -42]].map(([x, y], i) => (
                <motion.span
                  key={i}
                  className="absolute h-5 w-5 sm:h-8 sm:w-8"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: [0, 1.2, 1], rotate: 0 }}
                  transition={{ delay: 0.7 + i * 0.15 }}
                >
                  <TownArt name={art.prop.sparkle} className="h-full w-full" fallback={<span aria-hidden>✨</span>} />
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the math, filling in as Lumi explains */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center sm:gap-6">
        {p.op === "*" ? (
          <div className="font-hand rounded-2xl bg-emerald-900 px-5 py-3 text-3xl text-white ring-8 ring-amber-800 sm:text-4xl" aria-hidden>
            <div>{p.a} × {p.b}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-2xl text-amber-200 sm:text-3xl">
              {step >= 1 && p.seq!.map((n, i) => (
                <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.35 }}>{n}</motion.span>
              ))}
            </div>
            {done && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-1 font-bold">= {p.answer}</motion.div>}
          </div>
        ) : (
          <ColumnBoard parts={p} stage={step} lastStage={last} unit={theme.unit} theme={theme.board} />
        )}

        {/* captions: what Lumi is saying, so readers and non-readers both follow */}
        <ol className="flex w-full max-w-md flex-col gap-2" aria-live="polite">
          {scene.lines.slice(0, stage).map((line, i) => (
            <motion.li
              key={`${scene.problem}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-2xl px-4 py-2 text-lg ${i === last ? "bg-green-50 font-bold text-green-800 ring-1 ring-green-200" : i === step ? "bg-white ring-2 ring-sky-300" : "bg-white/70"}`}
            >
              {line}
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}
