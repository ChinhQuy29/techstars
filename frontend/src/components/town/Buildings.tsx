import type { ReactElement } from "react";
import type { Concept } from "../../api";
import { art, TownArt } from "./townArt";

/** The four places in Lumi's Town, drawn as simple storybook buildings (viewBox 200×200). */

function LemonadeStand() {
  return (
    <g>
      <rect x="30" y="96" width="140" height="78" rx="8" fill="#F5D7A1" stroke="#B7791F" strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={34 + i * 34} y="100" width="28" height="70" rx="4" fill="#EBC285" opacity="0.6" />
      ))}
      <rect x="38" y="60" width="8" height="40" fill="#B7791F" />
      <rect x="154" y="60" width="8" height="40" fill="#B7791F" />
      {/* striped awning */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M${24 + i * 22} 40 h22 v22 q-11 10 -22 0 z`} fill={i % 2 ? "#FFFFFF" : "#FACC15"} stroke="#CA8A04" strokeWidth="1.5" />
      ))}
      <rect x="62" y="12" width="76" height="26" rx="6" fill="#FFFFFF" stroke="#CA8A04" strokeWidth="2.5" />
      <text x="100" y="31" textAnchor="middle" fontSize="15" fontWeight="800" fill="#A16207" fontFamily="system-ui">LEMONADE</text>
      {/* pitcher + cups */}
      <path d="M70 78 h26 l-3 18 h-20 z" fill="#FEF08A" stroke="#CA8A04" strokeWidth="2" />
      <circle cx="84" cy="74" r="6" fill="#FDE047" stroke="#CA8A04" strokeWidth="1.5" />
      <rect x="112" y="80" width="12" height="16" rx="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
      <rect x="130" y="80" width="12" height="16" rx="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
    </g>
  );
}

function ChangeCounter() {
  return (
    <g>
      <rect x="34" y="70" width="132" height="104" rx="10" fill="#DBEAFE" stroke="#2563EB" strokeWidth="3" />
      <path d="M24 74 L100 24 L176 74 Z" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="100" cy="54" r="14" fill="#FDE68A" stroke="#B45309" strokeWidth="3" />
      <text x="100" y="60" textAnchor="middle" fontSize="16" fontWeight="900" fill="#92400E" fontFamily="system-ui">¢</text>
      <rect x="52" y="92" width="96" height="44" rx="6" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2.5" />
      <rect x="62" y="102" width="76" height="14" rx="3" fill="#0F2D3D" />
      <rect x="44" y="144" width="112" height="14" rx="4" fill="#93C5FD" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={78 + i * 22} cy="151" r="7" fill="#FCD34D" stroke="#B45309" strokeWidth="1.5" />
      ))}
    </g>
  );
}

function CoinJar() {
  return (
    <g>
      <rect x="66" y="22" width="68" height="18" rx="6" fill="#A3E635" stroke="#4D7C0F" strokeWidth="3" />
      <path d="M58 44 h84 q16 0 16 18 v94 q0 18 -18 18 h-80 q-18 0 -18 -18 v-94 q0 -18 16 -18 z" fill="#E0F2FE" stroke="#0284C7" strokeWidth="3" opacity="0.95" />
      {[
        [80, 150], [100, 152], [120, 150], [90, 138], [110, 138], [100, 125], [82, 126], [118, 126],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="11" ry="6" fill="#FCD34D" stroke="#B45309" strokeWidth="1.5" />
      ))}
      <rect x="72" y="74" width="56" height="26" rx="5" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2" />
      <text x="100" y="92" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0369A1" fontFamily="system-ui">COINS</text>
    </g>
  );
}

function Bakery() {
  return (
    <g>
      <rect x="36" y="76" width="128" height="98" rx="6" fill="#FFE4E6" stroke="#BE185D" strokeWidth="3" />
      <path d="M26 80 L100 30 L174 80 Z" fill="#F472B6" stroke="#9D174D" strokeWidth="3" strokeLinejoin="round" />
      <rect x="132" y="30" width="16" height="30" fill="#9D174D" />
      <circle cx="140" cy="20" r="7" fill="#E2E8F0" opacity="0.8" />
      <circle cx="148" cy="10" r="5" fill="#E2E8F0" opacity="0.6" />
      <rect x="84" y="116" width="32" height="58" rx="4" fill="#BE185D" />
      <circle cx="110" cy="146" r="2.5" fill="#FDE68A" />
      <rect x="48" y="100" width="28" height="26" rx="3" fill="#FFFFFF" stroke="#BE185D" strokeWidth="2" />
      <rect x="124" y="100" width="28" height="26" rx="3" fill="#FFFFFF" stroke="#BE185D" strokeWidth="2" />
      <circle cx="100" cy="64" r="14" fill="#D97706" stroke="#92400E" strokeWidth="2.5" />
      {[[95, 60], [104, 62], [99, 69]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill="#451A03" />
      ))}
    </g>
  );
}

export const BUILDING: Record<Concept, () => ReactElement> = {
  carry: LemonadeStand,
  borrow: ChangeCounter,
  off_by_one: CoinJar,
  mul: Bakery,
};

/** The code drawing of a place: the fallback when its illustration is missing. */
export function DrawnBuilding({ concept, open = true }: { concept: Concept; open?: boolean }) {
  const Art = BUILDING[concept];
  return (
    <svg viewBox="0 0 200 200" className="h-auto w-full overflow-visible" aria-hidden>
      <ellipse cx="100" cy="180" rx="84" ry="10" fill="#0F2D3D" opacity="0.12" />
      <g style={open ? undefined : { filter: "grayscale(1)", opacity: 0.55 }}>
        <Art />
      </g>
    </svg>
  );
}

/** A building tile for the map and scrapbook; closed places are dimmed with a sign + padlock on top. */
export function BuildingArt({ concept, open }: { concept: Concept; open: boolean }) {
  return (
    <div className="relative w-full">
      <TownArt
        name={art.shop(concept, open)}
        className="h-auto w-full drop-shadow-md"
        style={open ? undefined : { filter: "grayscale(0.6)", opacity: 0.8 }}
        fallback={<DrawnBuilding concept={concept} open={open} />}
      />
      {!open && (
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <rect x="52" y="108" width="96" height="30" rx="6" fill="#FFFFFF" stroke="#64748B" strokeWidth="3" transform="rotate(-6 100 123)" />
          <text x="100" y="129" textAnchor="middle" fontSize="18" fontWeight="900" fill="#475569" fontFamily="system-ui" transform="rotate(-6 100 123)">
            CLOSED
          </text>
          <rect x="88" y="146" width="24" height="20" rx="4" fill="#64748B" />
          <path d="M92 146 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="#64748B" strokeWidth="4" />
        </svg>
      )}
    </div>
  );
}
