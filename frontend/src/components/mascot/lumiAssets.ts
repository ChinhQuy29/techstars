import type { Emotion } from "../../api";
import { publicAsset } from "../../assets";

/**
 * Lumi mascot: the single place that decides how each expression looks.
 * See ./README.md for the design rules (docs/04-character-ui-and-art.md).
 *
 * Visual state only: nothing here may feed back into correctness, mastery or session flow.
 */

export const MASCOT_NAME = "Lumi"; // working name; rename here (and in i18n/backend templates)

export type LumiExpression =
  | "default"
  | "happy"
  | "curious"
  | "confused"
  | "thinking"
  | "listening"
  | "celebrate"
  | "encourage"
  | "sleeping";

export type LumiPose = "front" | "threeQuarter";

/** Brand palette (from the design reference). */
export const LUMI_COLORS = {
  screen: "#0F2D3D", // face screen
  primary: "#4FC3C7", // teal accents: ears, chest
  body: "#F4F8FA",
  bodyShade: "#E8F1F5",
  outline: "#C7D6DE",
  accent: "#FFB347", // antenna tip, sparkles
  eye: "#6FE7EC", // glowing cyan eyes / mouth
} as const;

type Eyes = "oval" | "arc" | "wide" | "uneven" | "lookUp" | "soft" | "closed";
type Mouth = "smile" | "bigSmile" | "open" | "small" | "wavy" | "o" | "soft" | "tiny";
type Accessory = "question" | "dots" | "sparkles" | "waves" | "zzz" | null;

export interface ExpressionSpec {
  eyes: Eyes;
  mouth: Mouth;
  /** Arm angles in degrees (0 = hanging down; left + = outward, right − = outward). */
  arms: [number, number];
  accessory: Accessory;
  /** Whole-body tilt in degrees. */
  tilt: number;
  /** Short accessible description of the state. */
  label: string;
}

export const EXPRESSIONS: Record<LumiExpression, ExpressionSpec> = {
  default: { eyes: "oval", mouth: "smile", arms: [18, -18], accessory: null, tilt: 0, label: "Lumi is smiling" },
  happy: { eyes: "arc", mouth: "bigSmile", arms: [32, -32], accessory: null, tilt: 0, label: "Lumi is happy" },
  curious: { eyes: "wide", mouth: "small", arms: [18, -34], accessory: null, tilt: -4, label: "Lumi is curious" },
  confused: { eyes: "uneven", mouth: "wavy", arms: [16, -160], accessory: "question", tilt: 3, label: "Lumi is puzzled" },
  thinking: { eyes: "lookUp", mouth: "o", arms: [16, 118], accessory: "dots", tilt: -4, label: "Lumi is thinking" },
  listening: { eyes: "wide", mouth: "small", arms: [14, -14], accessory: "waves", tilt: 6, label: "Lumi is listening" },
  celebrate: { eyes: "arc", mouth: "open", arms: [128, -128], accessory: "sparkles", tilt: 0, label: "Lumi is celebrating" },
  encourage: { eyes: "soft", mouth: "soft", arms: [18, -60], accessory: null, tilt: 0, label: "Lumi is cheering you on" },
  sleeping: { eyes: "closed", mouth: "tiny", arms: [8, -8], accessory: "zzz", tilt: 0, label: "Lumi is resting" },
};

/**
 * Lumi's poses, exported as SVG from the Figma file "Lumi", page "new" (frames Character, excited, confused,
 * thinking, sleeping). Every file shares one 342×353 canvas with the foot shadow at the same spot, so switching
 * moods never moves Lumi. "sad" is left out on purpose: Lumi never makes a child feel they upset it.
 * Curious and listening have no pose of their own yet. The vector renderer is only a fallback if a file fails.
 */
const pose = (name: string) => publicAsset(`assets/mascot/lumi-${name}.svg`);
export const RASTER_ASSETS: Partial<Record<LumiExpression, string>> = {
  default: pose("waving"),
  listening: pose("waving"),
  happy: pose("excited"),
  celebrate: pose("excited"),
  encourage: pose("excited"),
  curious: pose("thinking"),
  thinking: pose("thinking"),
  confused: pose("confused"),
  sleeping: pose("sleeping"),
};
export const ARTWORK_SIZE = { w: 342, h: 353 } as const;
/** The same poses dressed in a dream outfit (scripts/dream_outfits.py): taller, so hats and helmets fit. */
export const OUTFIT_SIZE = { w: 372, h: 470 } as const;

/** The little extras drawn beside Lumi's head in Figma ("?", "hmm", "Z z"). */
export const ARTWORK_EXTRAS: Partial<Record<LumiExpression, string[]>> = {
  confused: ["?"],
  thinking: ["hmm"],
  sleeping: ["Z", "z"],
};

/** Unknown or missing expression → default (never a broken image). */
export function resolveExpression(x: string | null | undefined): LumiExpression {
  return x && x in EXPRESSIONS ? (x as LumiExpression) : "default";
}

/** App emotion (from the backend turn / Help flow) → mascot expression. */
const FROM_EMOTION: Record<Emotion, LumiExpression> = {
  idle: "default",
  sleeping: "sleeping",
  listening: "listening",
  thinking: "thinking",
  happy: "happy",
  celebrating: "celebrate",
  encouraging: "encourage",
  curious: "curious",
  confused: "confused",
};

export function expressionFor(emotion: Emotion | string | null | undefined): LumiExpression {
  return (emotion && FROM_EMOTION[emotion as Emotion]) || "default";
}
