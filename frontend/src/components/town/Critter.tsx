import { motion } from "framer-motion";

/** Friendly animal customers for Lumi's Town. Simple shapes, readable at small sizes. */
export type CritterKind = "bunny" | "bear" | "cat" | "duck";

const LOOK: Record<CritterKind, { body: string; belly: string; accent: string }> = {
  bunny: { body: "#F3E8FF", belly: "#FFFFFF", accent: "#F9A8D4" },
  bear: { body: "#D6A77A", belly: "#F3D9B8", accent: "#8B5E3C" },
  cat: { body: "#FDBA74", belly: "#FFEDD5", accent: "#EA580C" },
  duck: { body: "#FDE047", belly: "#FEF9C3", accent: "#F97316" },
};

export const CRITTERS: CritterKind[] = ["bunny", "bear", "cat", "duck"];

export default function Critter({ kind, happy = false, className = "", label }: {
  kind: CritterKind;
  happy?: boolean;
  className?: string;
  label?: string;
}) {
  const c = LOOK[kind];
  const stroke = { stroke: "#7C5C3B", strokeWidth: 2.5, strokeLinecap: "round" as const, fill: "none" };
  return (
    <motion.svg
      viewBox="0 0 120 150"
      className={`h-auto overflow-visible ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      animate={happy ? { y: [0, -8, 0] } : { y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ellipse cx="60" cy="144" rx="34" ry="5" fill="#0F2D3D" opacity="0.12" />
      {/* ears */}
      {kind === "bunny" && (
        <g>
          <rect x="34" y="2" width="16" height="44" rx="8" fill={c.body} stroke="#C4B5FD" strokeWidth="2" />
          <rect x="70" y="2" width="16" height="44" rx="8" fill={c.body} stroke="#C4B5FD" strokeWidth="2" />
          <rect x="39" y="9" width="6" height="30" rx="3" fill={c.accent} />
          <rect x="75" y="9" width="6" height="30" rx="3" fill={c.accent} />
        </g>
      )}
      {kind === "bear" && (
        <g fill={c.body}>
          <circle cx="32" cy="30" r="12" />
          <circle cx="88" cy="30" r="12" />
          <circle cx="32" cy="30" r="6" fill={c.belly} />
          <circle cx="88" cy="30" r="6" fill={c.belly} />
        </g>
      )}
      {kind === "cat" && (
        <g fill={c.body}>
          <path d="M26 46 L34 14 L50 34 Z" />
          <path d="M94 46 L86 14 L70 34 Z" />
        </g>
      )}
      {/* body + head */}
      <ellipse cx="60" cy="112" rx="32" ry="30" fill={c.body} />
      <ellipse cx="60" cy="118" rx="20" ry="20" fill={c.belly} />
      <circle cx="60" cy="58" r="32" fill={c.body} />
      {kind === "duck" && <ellipse cx="60" cy="68" rx="14" ry="7" fill={c.accent} />}
      {/* face */}
      {happy ? (
        <g {...stroke}>
          <path d="M44 54 Q49 48 54 54" />
          <path d="M66 54 Q71 48 76 54" />
        </g>
      ) : (
        <g fill="#3F2A1D">
          <circle cx="49" cy="54" r="4" />
          <circle cx="71" cy="54" r="4" />
          <circle cx="50.5" cy="52.5" r="1.3" fill="#fff" />
          <circle cx="72.5" cy="52.5" r="1.3" fill="#fff" />
        </g>
      )}
      {kind !== "duck" && (
        <g>
          <ellipse cx="60" cy="64" rx="4" ry="3" fill="#3F2A1D" />
          <path d={happy ? "M50 70 Q60 80 70 70" : "M53 71 Q60 75 67 71"} {...stroke} />
        </g>
      )}
      <circle cx="40" cy="66" r="5" fill={c.accent} opacity="0.35" />
      <circle cx="80" cy="66" r="5" fill={c.accent} opacity="0.35" />
      {/* arms */}
      <ellipse cx="30" cy="104" rx="8" ry="14" fill={c.body} transform="rotate(20 30 104)" />
      <ellipse cx="90" cy="104" rx="8" ry="14" fill={c.body} transform="rotate(-20 90 104)" />
    </motion.svg>
  );
}

/** Same customer for the same problem (visual only; no math here). */
export function critterFor(seed: string): CritterKind {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CRITTERS[h % CRITTERS.length];
}
