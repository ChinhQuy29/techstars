import type { Emotion } from "../api";

export interface Expression {
  /** Eye openness 0..1 (scaleY). */
  eyeOpen: number;
  /** Pupil offset in px (look direction). */
  look: [number, number];
  pupil: number;
  /** Brow vertical offset and tilt (deg, + = inner ends up = worried/curious). */
  brow: { y: number; tilt: number };
  /** Closed mouth shape: two quadratic curves (same command structure so Framer can morph). */
  mouth: string;
  /** Mouth while talking (open). */
  talk: string;
  glow: string;
  label: string;
}

const m = (x1: number, y1: number, cu: number, cl: number, x2 = 400 - x1, y2 = y1) =>
  `M${x1} ${y1} Q200 ${cu} ${x2} ${y2} Q200 ${cl} ${x1} ${y1}`;

export const EXPRESSIONS: Record<Emotion, Expression> = {
  sleeping: { eyeOpen: 0.06, look: [0, 6], pupil: 14, brow: { y: 8, tilt: 0 }, mouth: m(180, 214, 216, 220), talk: m(180, 214, 216, 220), glow: "#334155", label: "Sleeping" },
  idle: { eyeOpen: 1, look: [0, 0], pupil: 16, brow: { y: 0, tilt: 0 }, mouth: m(165, 208, 222, 228), talk: m(165, 206, 214, 246), glow: "#facc15", label: "Watching" },
  listening: { eyeOpen: 1, look: [0, -2], pupil: 18, brow: { y: -6, tilt: 4 }, mouth: m(180, 210, 214, 222), talk: m(180, 208, 212, 236), glow: "#38bdf8", label: "Listening" },
  thinking: { eyeOpen: 0.85, look: [10, -12], pupil: 14, brow: { y: -4, tilt: -8 }, mouth: m(178, 214, 210, 216, 226, 206), talk: m(178, 212, 208, 230, 226, 206), glow: "#22d3ee", label: "Thinking" },
  happy: { eyeOpen: 0.6, look: [0, 0], pupil: 16, brow: { y: -6, tilt: 0 }, mouth: m(155, 198, 218, 252), talk: m(155, 198, 214, 262), glow: "#facc15", label: "Happy" },
  celebrating: { eyeOpen: 0.45, look: [0, -4], pupil: 17, brow: { y: -12, tilt: 0 }, mouth: m(148, 192, 206, 268), talk: m(148, 192, 204, 276), glow: "#f472b6", label: "Celebrating" },
  encouraging: { eyeOpen: 0.9, look: [0, 2], pupil: 17, brow: { y: -4, tilt: 6 }, mouth: m(162, 204, 220, 236), talk: m(162, 204, 214, 252), glow: "#4ade80", label: "Encouraging" },
  curious: { eyeOpen: 1.1, look: [-6, 0], pupil: 20, brow: { y: -10, tilt: 10 }, mouth: m(186, 212, 202, 230), talk: m(186, 210, 198, 242), glow: "#a78bfa", label: "Curious" },
  confused: { eyeOpen: 0.95, look: [6, 4], pupil: 14, brow: { y: -2, tilt: 14 }, mouth: m(168, 218, 204, 214, 232, 210), talk: m(168, 216, 202, 232, 232, 210), glow: "#fb923c", label: "Hmm?" },
};
