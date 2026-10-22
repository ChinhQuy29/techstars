export const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type Emotion =
  | "sleeping" | "idle" | "listening" | "thinking" | "happy"
  | "celebrating" | "encouraging" | "curious" | "confused";

export type Language = "en" | "es" | "vi";

/** Gemini format: [ymin, xmin, ymax, xmax] scaled 0-1000. */
export type BBox = [number, number, number, number];

export interface GradedProblem {
  id: number;
  problem: string;
  child_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  answered: boolean;
  bbox: BBox;
  answer_bbox: BBox | null;
  error_step: string | null;
  error_bbox: BBox | null;
  confidence: number;
  needs_confirmation: boolean;
}

export interface GradeResponse {
  session_id: string;
  hand_blocking: boolean;
  unreadable: boolean;
  problems: GradedProblem[];
  fixed_ids: number[];
  mock: boolean;
  llm_error: "timeout" | "quota" | "error" | null;
}

export interface ChatTurn { role: "child" | "robot"; text: string }

export interface TutorResponse {
  emotion: Emotion;
  say: string;
  focus_problem_id: number | null;
  hint_level: number;
  attempts: number;
  revealed: boolean;
  practice_problem: string | null;
}

export interface ReportResponse {
  session_id: string;
  score: number;
  total: number;
  correct: number;
  fixed: number;
  hints_used: number;
  concepts: string[];
  practice_problems: { problem: string; answer: string }[];
  summary: string;
  events: Record<string, unknown>[];
  teach: {
    taught: { concept: string; label: string; stars: number }[];
    quotes: { concept: string; label: string; text: string }[];
    caught: number;
    planted: number;
    missed: number;
    false_alarms: number;
    explanations: Record<string, number>;
    note: string;
  } | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const MAX_UPLOAD_SIDE = 1600;

/** Shrink big captures (webcam 1920px, phone 2400px) so Gemini has fewer image tokens to read.
 *  Images already small enough are sent untouched (mock mode matches sample photos byte-for-byte). */
async function shrinkForUpload(image: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(image);
    const scale = MAX_UPLOAD_SIDE / Math.max(bmp.width, bmp.height);
    if (scale >= 1) return image;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? image), "image/jpeg", 0.88));
  } catch {
    return image;
  }
}

export async function grade(image: Blob, sessionId: string): Promise<GradeResponse> {
  const form = new FormData();
  form.append("image", await shrinkForUpload(image), "capture.jpg");
  form.append("session_id", sessionId);
  return json(await fetch(`${BACKEND}/api/grade`, { method: "POST", body: form }));
}

export async function tutor(body: {
  session_id: string;
  language: Language;
  action: "react" | "hint" | "chat";
  problem_id?: number | null;
  child_said?: string;
  history?: ChatTurn[];
}): Promise<TutorResponse> {
  return json(await fetch(`${BACKEND}/api/tutor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function report(sessionId: string, language: Language): Promise<ReportResponse> {
  return json(await fetch(`${BACKEND}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, language }),
  }));
}

export async function health(): Promise<{ ok: boolean; mode: "gemini" | "mock"; model: string }> {
  return json(await fetch(`${BACKEND}/api/health`));
}

export async function samples(): Promise<{ name: string; url: string }[]> {
  return json(await fetch(`${BACKEND}/api/samples`));
}

export async function resetSession(sessionId: string): Promise<void> {
  await fetch(`${BACKEND}/api/session/${sessionId}/reset`, { method: "POST" });
}

/** Fire-and-forget LED status for the ESP32 lamp (no-op if LAMP_URL isn't set on the backend). */
export function setLamp(state: "off" | "idle" | "thinking" | "correct" | "hint" | "error"): void {
  fetch(`${BACKEND}/api/lamp/led?state=${state}`, { method: "POST" }).catch(() => {});
}

// ---------- Teach Lumi mode (teach-lumi-spec.md §7.2) ----------

export type TeachStep =
  | "practice_first" | "mark" | "fix" | "help" | "find" | "explain" | "demo" | "sure" | "next" | "done";
export type TeachOutcome = "caught_fixed" | "caught_unfixed" | "missed" | "false_alarm" | "confirmed_ok";

export interface LumiProblem { id: number; problem: string; lumi_answer: string }
export interface TeachChip { id: string; text: string }

export interface TeachTurn {
  emotion: Emotion;
  say: string;
  step: TeachStep;
  focus_problem_id: number | null;
  highlight_ids: number[];
  chips: TeachChip[];
  demo: { problem: string; steps: string[]; answer: string } | null;
  outcomes: { id: number; outcome: TeachOutcome }[];
  mastery: Record<string, number>;
  mastery_up: string | null;
  help_level: number;
  stats: { caught: number; planted: number; false_alarms: number } | null;
}

export interface TeachWorksheet {
  ready: boolean;
  worksheet_id: string | null;
  problems: LumiProblem[];
  concepts: string[];
  turn: TeachTurn;
}

export interface TeachMark { id: number; mark: "circle" | "check" | "none"; correction?: string | null }

export async function teachWorksheet(sessionId: string, language: Language, force = false): Promise<TeachWorksheet> {
  return json(await fetch(`${BACKEND}/api/teach/worksheet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, language, force }),
  }));
}

export async function teachTurn(body: {
  session_id: string;
  language: Language;
  worksheet_id: string;
  action: "check" | "fix" | "find" | "explain" | "confirm" | "next";
  marks?: TeachMark[];
  problem_id?: number;
  answer?: string;
  child_said?: string;
  chip_id?: string;
  agree?: boolean;
}): Promise<TeachTurn> {
  return json(await fetch(`${BACKEND}/api/teach/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}
