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
    demo: boolean;
  } | null;
}

/** HTTP error with the backend's machine-readable code when present ({detail: {code, message}}). */
export class ApiError extends Error {
  constructor(public status: number, public code: string | null, message: string) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let code: string | null = null;
    try {
      const detail = JSON.parse(text)?.detail;
      code = typeof detail === "object" && detail ? detail.code ?? null : null;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, code, `${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

/** fetch with a timeout, so a hung backend never strands the child (docs/02-learning-design.md). */
async function fetchT(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const id = window.setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    throw new ApiError(0, (e as Error).name === "AbortError" ? "timeout" : "network", String(e));
  } finally {
    window.clearTimeout(id);
  }
}

const TEACH_TIMEOUT_MS = 35_000; // > backend GEMINI_TIMEOUT (25 s) for the explanation-rating call

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

// ---------- Teach Lumi mode (docs/05-architecture-and-api.md) ----------

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
  demo: boolean;
  worksheet_id: string | null;
  problems: LumiProblem[];
  concepts: string[];
  turn: TeachTurn;
}

export interface TeachMark { id: number; mark: "circle" | "check" | "none"; correction?: string | null }

export async function teachWorksheet(sessionId: string, language: Language, force = false, demo = false): Promise<TeachWorksheet> {
  return json(await fetchT(`${BACKEND}/api/teach/worksheet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, language, force, demo }),
  }, TEACH_TIMEOUT_MS));
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
  return json(await fetchT(`${BACKEND}/api/teach/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, TEACH_TIMEOUT_MS));
}

// ---------- Lumi's Town (docs/03-lumis-town.md) ----------

export type Concept = "carry" | "borrow" | "off_by_one" | "mul";

export interface TownPlace {
  concept: Concept;
  name: string;
  emoji: string;
  stars: number;
  unlocked: boolean;
  need: string | null;
  teaser: string | null;
}

export interface TownInfo {
  dream: string;
  unlock_stars: number;
  places: TownPlace[];
  scrapbook: { concept: Concept; label: string; quote: string; stars: number }[];
}

export interface TownScene {
  concept: Concept;
  unlocked: boolean;
  title: string;
  problem: string | null;
  lines: string[];
  answer: string | null;
  say: string;
  /** Every digit the illustrated scene draws (from the backend; the browser does no arithmetic). */
  parts: SceneParts | null;
}

export interface SceneParts {
  op: "+" | "-" | "*";
  a: number;
  b: number;
  answer: number;
  a_digits: [number, number] | null;
  b_digits: [number, number] | null;
  regroup: boolean | null;
  ones: number | null;
  tens: number | null;
  seq: number[] | null;
  borrow_tens: number | null;
  borrow_ones: number | null;
}

export async function town(sessionId: string, language: Language): Promise<TownInfo> {
  return json(await fetchT(`${BACKEND}/api/teach/town`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, language }),
  }, TEACH_TIMEOUT_MS));
}

export async function townScene(sessionId: string, language: Language, concept: Concept): Promise<TownScene> {
  return json(await fetchT(`${BACKEND}/api/teach/scene`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, language, concept }),
  }, TEACH_TIMEOUT_MS));
}

// ---------- Saved progress (docs/06-privacy-and-safety.md) ----------

/** Must match backend store.CONSENT_VERSION; bump both when the consent text changes. */
export const CONSENT_VERSION = "2026-10-27";

export interface ProgressSummary { stars: Record<string, number>; skills_taught: number }
export interface ProfileInfo { profile_id: string; summary: ProgressSummary }

export async function createProfile(sessionId: string): Promise<ProfileInfo> {
  return json(await fetchT(`${BACKEND}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, consent: true, consent_version: CONSENT_VERSION }),
  }, TEACH_TIMEOUT_MS));
}

export async function attachProfile(sessionId: string, profileId: string): Promise<ProfileInfo> {
  return json(await fetchT(`${BACKEND}/api/profile/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, profile_id: profileId }),
  }, TEACH_TIMEOUT_MS));
}

export async function deleteProfile(profileId: string): Promise<{ deleted: boolean }> {
  return json(await fetchT(`${BACKEND}/api/profile/${profileId}`, { method: "DELETE" }, TEACH_TIMEOUT_MS));
}
