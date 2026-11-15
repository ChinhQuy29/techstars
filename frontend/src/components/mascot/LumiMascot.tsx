import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import {
  ARTWORK_EXTRAS, ARTWORK_SIZE, EXPRESSIONS, OUTFIT_SIZE, LUMI_COLORS as C, RASTER_ASSETS, resolveExpression, type LumiExpression, type LumiPose,
} from "./lumiAssets";
import { useDreamArt } from "../../dream";

const SIZES = { xs: "w-10", sm: "w-20", md: "w-32", lg: "w-44", hero: "w-60" } as const;

interface Props {
  expression?: LumiExpression | string;
  pose?: LumiPose;
  /** Fixed width preset; use `className` for responsive widths instead. Height follows the 200×250 box. */
  size?: keyof typeof SIZES;
  /** Blink / wave / bounce. Off automatically when the user prefers reduced motion. */
  animated?: boolean;
  /** One gentle wave when shown (welcome). */
  wave?: boolean;
  /** Mouth moves while text-to-speech is speaking. */
  talking?: boolean;
  /** Accessible label; omit for decorative use (then aria-hidden). Pass "auto" to describe the expression. */
  label?: string;
  className?: string;
}

/**
 * Lumi, the robot learning companion. Every appearance of the mascot goes through this component.
 * Original vector artwork drawn from the design reference (rounded white body, navy face screen,
 * cyan eyes, teal ears + chest light, orange antenna tip). Visual only — never a source of truth.
 */
export default function LumiMascot({
  expression: rawExpression, pose = "front", size, animated = true, wave = false, talking = false, label, className = "",
}: Props) {
  const expression = resolveExpression(rawExpression);
  const spec = EXPRESSIONS[expression];
  const reduce = useReducedMotion();
  const moving = animated && !reduce;
  const id = useId().replace(/:/g, "");
  // Once the child picks a dream, every Lumi wears that outfit in every mood (docs/12-dreams.md): the same poses,
  // dressed by scripts/dream_outfits.py into /assets/mascot/<dream>/. No dream yet, or a file fails: the plain pose.
  const outfit = useDreamArt();
  const [failedRaster, setFailedRaster] = useState<string>();
  const plain = RASTER_ASSETS[expression];
  const dressed = outfit && plain ? plain.replace("/assets/mascot/", `/assets/mascot/${outfit.id}/`) : undefined;
  const wearing = dressed !== undefined && failedRaster !== dressed;
  const raster = wearing ? dressed : plain;
  const useArtwork = raster !== undefined && failedRaster !== raster;
  const box = wearing ? OUTFIT_SIZE : ARTWORK_SIZE;
  const [blink, setBlink] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const ariaLabel = label === "auto" ? spec.label : label;
  const sizeClass = size ? SIZES[size] : "";

  // Brief, infrequent blink (only for open-eye states).
  useEffect(() => {
    if (useArtwork || !moving || ["arc", "closed"].includes(spec.eyes)) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 130);
        loop();
      }, 3000 + Math.random() * 3500);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [moving, spec.eyes, useArtwork]);

  useEffect(() => {
    if (useArtwork || !talking || reduce) return setMouthOpen(false);
    const iv = window.setInterval(() => setMouthOpen((o) => !o), 150);
    return () => window.clearInterval(iv);
  }, [talking, reduce, useArtwork]);

  if (useArtwork) {
    const extras = ARTWORK_EXTRAS[expression] ?? [];
    return (
      <span
        className={`relative inline-block select-none align-bottom [container-type:inline-size] ${sizeClass} ${className}`}
        style={{ aspectRatio: `${box.w} / ${box.h}` }}
        role={ariaLabel ? "img" : undefined}
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
      >
        {/* One box per look (plain poses 342×353; outfits are taller for hats), with the feet at the same spot in
            every pose, so Lumi never jumps when the mood changes. */}
        <motion.img
          key={raster}
          src={raster}
          width={box.w}
          height={box.h}
          onError={() => setFailedRaster(raster)}
          initial={moving ? { opacity: 0.6, scale: 0.97 } : false}
          animate={moving && expression === "celebrate" ? { opacity: 1, scale: 1, y: [0, -8, 0] } : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          alt=""
          className="block h-full w-full object-contain object-bottom"
          draggable={false}
        />
        {/* The "?", "hmm" and "Z z" from the Figma page sit beside Lumi's head (sizes scale with Lumi). */}
        {extras.map((text, i) => (
          <motion.span
            key={`${expression}-${i}`}
            aria-hidden
            className="pointer-events-none absolute font-display font-extrabold leading-none text-[#212A42]"
            style={{ right: `${2 + i * 9}%`, top: `${(wearing ? 16 : -4) + i * 13}%`, fontSize: `${(text.length > 1 ? 11 : 20) - i * 5}cqw` }}
            initial={{ opacity: 0, y: 4 }}
            animate={
              !moving ? { opacity: 1, y: 0 }
                : expression === "sleeping" ? { opacity: [0, 1, 1, 0], y: [6, 0, -6, -12] }
                  : { opacity: 1, y: [0, -3, 0], rotate: text === "?" ? [0, 8, 0] : 0 }
            }
            transition={moving ? { duration: expression === "sleeping" ? 2.6 : 1.6, repeat: Infinity, delay: i * 0.6, ease: "easeInOut" } : { duration: 0.2 }}
          >
            {text}
          </motion.span>
        ))}
      </span>
    );
  }

  const q = pose === "threeQuarter";
  const fx = q ? 8 : 0; // face / chest shift for the three-quarter turn
  const eyeL = 80 + fx;
  const eyeR = 120 + fx;
  const ease = { duration: 0.3, ease: "easeOut" } as const;
  const rightArm = wave && moving ? [spec.arms[1], -150, -172, -142, -168, spec.arms[1]] : spec.arms[1];

  return (
    <motion.svg
      viewBox="0 0 200 250"
      className={`h-auto select-none overflow-visible ${sizeClass} ${className}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <defs>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`shell-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor={C.bodyShade} />
        </linearGradient>
      </defs>

      {/* floor shadow (stays put while the body tilts) */}
      <ellipse cx="100" cy="238" rx="44" ry="7" fill={C.screen} opacity="0.1" />

      <motion.g
        key={moving && expression === "celebrate" ? "celebrate" : "body"}
        animate={{
          rotate: spec.tilt,
          y: moving && expression === "celebrate" ? [0, -10, 0, -6, 0] : 0,
        }}
        transition={moving && expression === "celebrate" ? { duration: 0.9 } : ease}
      >
        {/* legs + feet */}
        {[84, 116].map((x) => (
          <g key={x}>
            <rect x={x - 8} y="196" width="16" height="26" rx="8" fill={`url(#shell-${id})`} stroke={C.outline} strokeWidth="2" />
            <ellipse cx={x} cy="225" rx="13" ry="7" fill={`url(#shell-${id})`} stroke={C.outline} strokeWidth="2" />
            <rect x={x - 7} y="227" width="14" height="3" rx="1.5" fill={C.primary} />
          </g>
        ))}

        {/* body + chest light */}
        <rect x="64" y="136" width="72" height="68" rx="28" fill={`url(#shell-${id})`} stroke={C.outline} strokeWidth="2" />
        <circle cx={100 + fx * 0.7} cy="168" r="10" fill={C.primary} />
        <circle cx={97 + fx * 0.7} cy="165" r="3" fill="#FFFFFF" opacity="0.7" />

        {/* antenna */}
        <line x1={100 + fx / 2} y1="38" x2={100 + fx / 2} y2="20" stroke={C.outline} strokeWidth="4" strokeLinecap="round" />
        <circle cx={100 + fx / 2} cy="15" r="7" fill={C.accent} />
        <circle cx={98 + fx / 2} cy="13" r="2" fill="#FFFFFF" opacity="0.8" />

        {/* ear panels (the far ear narrows in the three-quarter pose) */}
        <rect x={q ? 22 : 26} y="70" width={q ? 18 : 16} height="40" rx="8" fill={C.primary} />
        <rect x={q ? 160 : 158} y="70" width={q ? 10 : 16} height="40" rx="6" fill={C.primary} />

        {/* head */}
        <rect x="36" y="34" width="128" height="108" rx="50" fill={`url(#shell-${id})`} stroke={C.outline} strokeWidth="2" />

        {/* face screen */}
        <rect x={52 + fx} y="50" width="96" height="78" rx="34" fill={C.screen} />
        <ellipse cx={74 + fx} cy="62" rx="14" ry="5" fill="#FFFFFF" opacity="0.08" />

        {/* eyes */}
        <motion.g
          filter={`url(#glow-${id})`}
          animate={{ scaleY: blink ? 0.1 : 1 }}
          transition={{ duration: 0.08 }}
        >
          <Eyes kind={spec.eyes} l={eyeL} r={eyeR} />
        </motion.g>

        {/* mouth */}
        <g filter={`url(#glow-${id})`}>
          <Mouth kind={talking && mouthOpen ? "open" : spec.mouth} cx={100 + fx} />
        </g>

        {/* arms, drawn in front so waves, hand-on-chin and cheers read clearly; the invisible circle centers each arm's box on its shoulder */}
        {(
          [
            [60, spec.arms[0]],
            [140, rightArm],
          ] as const
        ).map(([sx, angle], i) => (
          <g key={i} transform={`translate(${sx} 150)`}>
            <motion.g initial={false} animate={{ rotate: angle }} transition={Array.isArray(angle) ? { duration: 1.6 } : ease}>
              <circle r="56" fill="none" />
              <rect x="-7" y="0" width="14" height="38" rx="7" fill={`url(#shell-${id})`} stroke={C.outline} strokeWidth="2" />
              <circle cx="0" cy="42" r="9" fill={`url(#shell-${id})`} stroke={C.outline} strokeWidth="2" />
            </motion.g>
          </g>
        ))}

        <Accessory kind={spec.accessory} moving={moving} />
      </motion.g>
    </motion.svg>
  );
}

function Eyes({ kind, l, r }: { kind: string; l: number; r: number }) {
  const c = C.eye;
  const oval = (x: number, y: number, rx: number, ry: number) => (
    <g key={`${x}-${y}`}>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={c} />
      <circle cx={x - rx * 0.35} cy={y - ry * 0.4} r={Math.max(2, rx * 0.28)} fill="#FFFFFF" opacity="0.9" />
    </g>
  );
  const arc = (x: number) => (
    <path key={x} d={`M${x - 10} 92 Q${x} 76 ${x + 10} 92`} fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" />
  );
  switch (kind) {
    case "arc":
      return <>{[l, r].map(arc)}</>;
    case "wide":
      return <>{oval(l, 88, 11, 14)}{oval(r, 88, 11, 14)}</>;
    case "uneven":
      return (
        <>
          {oval(l, 89, 10, 12)}
          {oval(r, 90, 8, 9)}
          <path d={`M${l - 9} 70 L${l + 7} 73`} stroke={c} strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M${r - 7} 75 L${r + 9} 69`} stroke={c} strokeWidth="3.5" strokeLinecap="round" />
        </>
      );
    case "lookUp":
      return <>{oval(l + 3, 84, 10, 12)}{oval(r + 3, 84, 10, 12)}</>;
    case "soft":
      return (
        <>
          {[l, r].map((x) => (
            <path key={x} d={`M${x - 10} 88 Q${x} 74 ${x + 10} 88 Q${x} 98 ${x - 10} 88 Z`} fill={c} />
          ))}
        </>
      );
    case "closed":
      return (
        <>
          {[l, r].map((x) => (
            <path key={x} d={`M${x - 9} 90 Q${x} 96 ${x + 9} 90`} fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" />
          ))}
        </>
      );
    default:
      return <>{oval(l, 88, 10, 12)}{oval(r, 88, 10, 12)}</>;
  }
}

function Mouth({ kind, cx }: { kind: string; cx: number }) {
  const c = C.eye;
  const stroke = { fill: "none", stroke: c, strokeWidth: 4, strokeLinecap: "round" as const };
  switch (kind) {
    case "bigSmile":
      return <path d={`M${cx - 15} 106 Q${cx} 121 ${cx + 15} 106`} {...stroke} />;
    case "open":
      return <path d={`M${cx - 14} 104 Q${cx} 124 ${cx + 14} 104 Z`} fill={c} />;
    case "small":
      return <path d={`M${cx - 7} 109 Q${cx} 114 ${cx + 7} 109`} {...stroke} />;
    case "wavy":
      return <path d={`M${cx - 12} 111 Q${cx - 6} 106 ${cx} 111 Q${cx + 6} 116 ${cx + 12} 111`} {...stroke} />;
    case "o":
      return <circle cx={cx + 2} cy="111" r="4.5" {...stroke} strokeWidth={3.5} />;
    case "soft":
      return <path d={`M${cx - 11} 108 Q${cx} 116 ${cx + 11} 108`} {...stroke} />;
    case "tiny":
      return <path d={`M${cx - 5} 111 Q${cx} 113 ${cx + 5} 111`} {...stroke} strokeWidth={3} />;
    default:
      return <path d={`M${cx - 12} 107 Q${cx} 117 ${cx + 12} 107`} {...stroke} />;
  }
}

function Accessory({ kind, moving }: { kind: string | null; moving: boolean }) {
  switch (kind) {
    case "question":
      return (
        <text x="168" y="44" fill={C.accent} fontSize="30" fontWeight="800" fontFamily="system-ui, sans-serif">
          ?
        </text>
      );
    case "dots":
      return (
        <g fill={C.primary}>
          {[
            [152, 40, 3.5],
            [163, 29, 4.5],
            [176, 17, 5.5],
          ].map(([x, y, r], i) => (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              animate={moving ? { opacity: [0.35, 1, 0.35] } : { opacity: 1 }}
              transition={moving ? { duration: 1.4, repeat: Infinity, delay: i * 0.25 } : undefined}
            />
          ))}
        </g>
      );
    case "sparkles":
      return (
        <g fill={C.accent}>
          {[
            [30, 46, 1],
            [172, 38, 1.2],
            [180, 100, 0.8],
            [22, 112, 0.7],
          ].map(([x, y, s], i) => (
            <motion.path
              key={i}
              d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z"
              transform={`translate(${x} ${y}) scale(${s})`}
              initial={moving ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.3 }}
            />
          ))}
        </g>
      );
    case "waves":
      return (
        <g fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round" opacity="0.8">
          <path d="M178 80 Q186 90 178 100" />
          <path d="M186 74 Q198 90 186 106" />
        </g>
      );
    case "zzz":
      return (
        <text x="160" y="40" fill={C.outline} fontSize="22" fontWeight="800" fontFamily="system-ui, sans-serif">
          z
        </text>
      );
    default:
      return null;
  }
}
