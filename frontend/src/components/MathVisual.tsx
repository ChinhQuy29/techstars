import type { ReactElement } from "react";
import type { MathVisualData } from "../api";

/**
 * Pictures for the newer concepts: a ruler, a 3D shape, fraction bars, a bar chart.
 * They only draw the numbers the backend sent; nothing here computes an answer.
 */
export default function MathVisual({ visual, className = "" }: { visual: MathVisualData; className?: string }) {
  switch (visual.type) {
    case "ruler":
      return <Ruler {...visual} className={className} />;
    case "shape":
      return <Shape shape={visual.shape} className={className} />;
    case "fractions":
      return <FractionBars a={visual.a} b={visual.b} className={className} />;
    case "bars":
      return <BarChart bars={visual.bars} max={visual.max} className={className} />;
  }
}

const ITEM_COLOR: Record<string, string> = { pencil: "#F59E0B", crayon: "#EF4444", key: "#94A3B8", leaf: "#22C55E", spoon: "#64748B" };

function Ruler({ start, end, max, item, className }: { start: number; end: number; max: number; item: string; className: string }) {
  const W = 320, pad = 12, unit = (W - 2 * pad) / max;
  const x = (cm: number) => pad + cm * unit;
  const color = ITEM_COLOR[item] ?? "#F59E0B";
  return (
    <svg viewBox={`0 0 ${W} 76`} className={`h-auto w-full max-w-sm ${className}`} aria-hidden>
      {/* the object, lying on the ruler from `start` to `end` */}
      <rect x={x(start)} y={6} width={x(end) - x(start)} height={18} rx={9} fill={color} stroke="#7C2D12" strokeWidth={1.5} />
      {item === "pencil" && <path d={`M${x(end)} 6 l12 9 l-12 9 z`} fill="#FDE68A" stroke="#7C2D12" strokeWidth={1.5} />}
      <rect x={pad - 6} y={30} width={W - 2 * pad + 12} height={40} rx={6} fill="#FEF3C7" stroke="#B45309" strokeWidth={2} />
      {Array.from({ length: max + 1 }).map((_, cm) => (
        <g key={cm}>
          <line x1={x(cm)} y1={30} x2={x(cm)} y2={cm % 5 === 0 ? 48 : 42} stroke="#78350F" strokeWidth={1.5} />
          <text x={x(cm)} y={63} textAnchor="middle" fontSize="11" fontWeight="700" fill="#78350F" fontFamily="system-ui">
            {cm}
          </text>
        </g>
      ))}
      <line x1={x(start)} y1={24} x2={x(start)} y2={34} stroke="#0F172A" strokeDasharray="2 2" />
      <line x1={x(end)} y1={24} x2={x(end)} y2={34} stroke="#0F172A" strokeDasharray="2 2" />
    </svg>
  );
}

/** Simple line drawings; dashed edges are the hidden ones at the back (a hint for "faces you can't see"). */
function Shape({ shape, className }: { shape: string; className: string }) {
  const front = { fill: "#BAE6FD", stroke: "#0369A1", strokeWidth: 2.5, strokeLinejoin: "round" as const };
  const side = { ...front, fill: "#7DD3FC" };
  const top = { ...front, fill: "#E0F2FE" };
  const hidden = { fill: "none", stroke: "#0369A1", strokeWidth: 1.5, strokeDasharray: "4 4" };
  const art: Record<string, ReactElement> = {
    cube: (
      <>
        <path d="M30 40 L70 40 L70 80 L30 80 Z" {...front} />
        <path d="M70 40 L90 25 L90 65 L70 80 Z" {...side} />
        <path d="M30 40 L50 25 L90 25 L70 40 Z" {...top} />
        <path d="M30 80 L50 65 L90 65 M50 65 L50 25" {...hidden} />
      </>
    ),
    box: (
      <>
        <path d="M15 45 L75 45 L75 80 L15 80 Z" {...front} />
        <path d="M75 45 L95 30 L95 65 L75 80 Z" {...side} />
        <path d="M15 45 L35 30 L95 30 L75 45 Z" {...top} />
        <path d="M15 80 L35 65 L95 65 M35 65 L35 30" {...hidden} />
      </>
    ),
    pyramid: (
      <>
        <path d="M60 12 L25 75 L65 85 Z" {...front} />
        <path d="M60 12 L65 85 L95 70 Z" {...side} />
        <path d="M25 75 L55 62 L95 70 M55 62 L60 12" {...hidden} />
      </>
    ),
    prism: (
      <>
        <path d="M20 80 L40 40 L60 80 Z" {...front} />
        <path d="M40 40 L85 30 L100 70 L60 80 Z" {...side} />
        <path d="M20 80 L65 70 L100 70 M65 70 L85 30" {...hidden} />
      </>
    ),
    tetra: (
      <>
        <path d="M55 12 L20 80 L70 85 Z" {...front} />
        <path d="M55 12 L70 85 L95 62 Z" {...side} />
        <path d="M20 80 L95 62" {...hidden} />
      </>
    ),
    pentaprism: (
      <>
        <path d="M30 18 L55 28 L50 52 L22 55 L15 32 Z" {...top} />
        <path d="M15 32 L22 55 L22 88 L15 65 Z" {...side} />
        <path d="M22 55 L50 52 L50 85 L22 88 Z" {...front} />
        <path d="M50 52 L55 28 L55 61 L50 85 Z" {...side} />
        <path d="M15 65 L30 51 L55 61 M30 51 L30 18" {...hidden} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 110 95" className={`h-auto w-32 sm:w-40 ${className}`} aria-hidden>
      {art[shape] ?? art.cube}
    </svg>
  );
}

function FractionBars({ a, b, className }: { a: number; b: number; className: string }) {
  const W = 300, x0 = 46, w = W - x0 - 6;
  const row = (n: number, y: number) => (
    <g key={`${n}-${y}`}>
      <text x={4} y={y + 17} fontSize="16" fontWeight="800" fill="#334155" fontFamily="system-ui">1/{n}</text>
      {Array.from({ length: n }).map((_, i) => (
        <rect key={i} x={x0 + (i * w) / n} y={y} width={w / n} height={24} fill={i === 0 ? "#FB923C" : "#FFF7ED"} stroke="#9A3412" strokeWidth={1.5} />
      ))}
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} 64`} className={`h-auto w-full max-w-sm ${className}`} aria-hidden>
      {row(a, 4)}
      {row(b, 36)}
    </svg>
  );
}

function BarChart({ bars, max, className }: { bars: { label: string; value: number }[]; max: number; className: string }) {
  const H = 130, top = 8, base = 108, x0 = 26, bw = 44, gap = 22;
  const y = (v: number) => base - ((base - top) * v) / max;
  const W = x0 + bars.length * (bw + gap) + 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-auto w-full max-w-xs ${className}`} aria-hidden>
      {/* a grid line at every number (so every bar ends on a line), labels on the even ones */}
      {Array.from({ length: max + 1 }).map((_, v) => (
        <g key={v}>
          <line x1={x0} y1={y(v)} x2={W - 4} y2={y(v)} stroke={v % 2 ? "#F1F5F9" : "#E2E8F0"} />
          {v % 2 === 0 && (
            <text x={x0 - 5} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#64748B" fontFamily="system-ui">{v}</text>
          )}
        </g>
      ))}
      {bars.map((bar, i) => {
        const bx = x0 + gap / 2 + i * (bw + gap);
        return (
          <g key={bar.label}>
            <rect x={bx} y={y(bar.value)} width={bw} height={base - y(bar.value)} rx={4} fill={["#60A5FA", "#F472B6", "#34D399"][i % 3]} />
            <text x={bx + bw / 2} y={H - 4} textAnchor="middle" fontSize="18">{bar.label}</text>
          </g>
        );
      })}
      <line x1={x0} y1={base} x2={W - 4} y2={base} stroke="#334155" strokeWidth={1.5} />
    </svg>
  );
}
