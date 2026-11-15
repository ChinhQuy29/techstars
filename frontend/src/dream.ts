import { useSyncExternalStore } from "react";

/**
 * Lumi's dream (docs/12-dreams.md): the child picks what Lumi wants to be, and Teach problems get short stories
 * from that dream. The id is sent with each worksheet request; the server ignores unknown ids.
 * Add a dream here (and its art in public/assets/dreams/) once the backend has its stories.
 */
export type DreamId = "astronaut" | "baker" | "doctor";

export interface Dream {
  id: DreamId;
  emoji: string;
  /** Figma art ("Lumi" file, page "new"), background removed; w/h are the SVG's own size. */
  image: string;
  w: number;
  h: number;
}

export const DREAMS: Dream[] = [
  { id: "astronaut", emoji: "🚀", image: "/assets/dreams/astronaut.svg", w: 326, h: 428 },
  { id: "baker", emoji: "🧁", image: "/assets/dreams/baker.svg", w: 351, h: 499 },
  { id: "doctor", emoji: "🩺", image: "/assets/dreams/doctor.svg", w: 342, h: 405 },
];

const KEY = "lumi_dream";

export function getDream(): DreamId | null {
  try {
    const v = localStorage.getItem(KEY);
    return DREAMS.some((d) => d.id === v) ? (v as DreamId) : null;
  } catch {
    return null;
  }
}

export function dreamInfo(id: DreamId | null): Dream | null {
  return DREAMS.find((d) => d.id === id) ?? null;
}

// One shared value for the whole app, so every Lumi (header, Home, lessons, Help) changes outfit the moment the
// child picks another dream.
let current: DreamId | null = getDream();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function chooseDream(d: DreamId) {
  try {
    localStorage.setItem(KEY, d);
  } catch {
    /* private mode: keep it for this visit only */
  }
  current = d;
  listeners.forEach((fn) => fn());
}

/** The chosen dream, saved on this device (it holds no personal data). */
export function useDream(): [DreamId | null, (d: DreamId) => void] {
  return [useSyncExternalStore(subscribe, () => current), chooseDream];
}

/** The chosen dream's art, or null before the child has picked one (then Lumi wears no outfit). */
export function useDreamArt(): Dream | null {
  return dreamInfo(useSyncExternalStore(subscribe, () => current));
}
