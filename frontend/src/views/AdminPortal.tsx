import { useCallback, useEffect, useState } from "react";
import { BACKEND, type Language, type MathVisualData } from "../api";
import MathVisual from "../components/MathVisual";
import { CONCEPT_EMOJI, TEACHABLE } from "../i18n";

/**
 * Developer admin portal (/?admin=1): set Lumi's stars, readiness and story choices directly, and preview any
 * concept problem or story scene, so features can be tested without teaching. Grown-up/dev tool, English only.
 * The backend only answers when it runs with LUMI_ADMIN=1. It edits this tab's session (the app opens in the
 * same tab, so changes show up there).
 */

interface ConceptRow { concept: string; label: string; stars: number; ready: boolean; quote: string | null; gate: "help" | "warmup" }
interface State {
  session_id: string;
  profile_attached: boolean;
  concepts: ConceptRow[];
  story: { started: boolean; current_act: number; chosen: Record<string, string>; seen: string[]; ending: string | null };
  acts: Record<string, string[]>;
}
interface Problem { problem: string; answer: string; planted: string; kind: string; visual: MathVisualData | null; steps: string[] }
interface ScenePreview { title: string; emoji: string; act: number; lines: { emotion: string; text: string }[] }

const SESSION_KEY = "lumi-session";
const PRESETS: { id: string; label: string; hint: string }[] = [
  { id: "fresh", label: "Fresh start", hint: "nothing taught, nothing ready" },
  { id: "town_open", label: "Town open", hint: "4 original skills at 1★, journey started" },
  { id: "all_ready", label: "All skills ready", hint: "every skill teachable, no stars (skip warm-ups)" },
  { id: "all_taught", label: "All taught", hint: "every skill 1★ + quotes, all of Act 1 open" },
  { id: "act2", label: "At Act 2", hint: "Act 1 chosen (savings)" },
  { id: "act3", label: "At Act 3", hint: "Acts 1–2 chosen, on the path below" },
  { id: "ending", label: "At the moon", hint: "Acts 1–3 chosen, ending ready" },
];
const PATHS = ["engineer", "musician", "scientist", "pilot"];

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BACKEND}/api/admin/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(r.status === 404 ? "off" : `${r.status} ${await r.text()}`);
  return r.json();
}

function readSession(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function AdminPortal() {
  const [sid, setSid] = useState(() => readSession() || `admin${Math.random().toString(36).slice(2, 6)}`);
  const [on, setOn] = useState<boolean | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [path, setPath] = useState("engineer");
  const [msg, setMsg] = useState("");
  const [lang, setLang] = useState<Language>("en");
  const [pConcept, setPConcept] = useState("time");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sceneKey, setSceneKey] = useState("trouble");
  const [scene, setScene] = useState<ScenePreview | null>(null);

  const run = useCallback(async (label: string, fn: () => Promise<State>) => {
    try {
      setState(await fn());
      setMsg(`✓ ${label}`);
    } catch (e) {
      setMsg(`✗ ${label}: ${(e as Error).message}`);
    }
  }, []);

  const refresh = useCallback(() => run("Loaded", () => call<State>("state", { session_id: sid })), [run, sid]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, sid); // the app (same tab) uses this session
    } catch {
      /* storage blocked */
    }
    call<{ enabled: boolean }>("status").then(() => { setOn(true); void refresh(); }).catch(() => setOn(false));
  }, [sid, refresh]);

  const patch = (label: string, body: object) => run(label, () => call<State>("patch", { session_id: sid, ...body }));
  const setStars = (c: string, stars: number) => patch(`${c} → ${stars}★`, { concepts: [{ concept: c, stars }] });

  if (on === false) {
    return (
      <Shell>
        <div className="card p-6">
          <h2 className="text-xl font-extrabold text-rose-700">The admin API is off</h2>
          <p className="mt-2 text-slate-700">
            Start the backend with <code className="rounded bg-slate-100 px-1">LUMI_ADMIN=1</code> (the dev launch config does this),
            then reload. Never enable it on a deployed server.
          </p>
        </div>
      </Shell>
    );
  }

  const chosen = state?.story.chosen ?? {};
  return (
    <Shell>
      {/* session + open the app */}
      <section className="card flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col text-sm font-semibold text-slate-600">
          Test session
          <input value={sid} onChange={(e) => setSid(e.target.value.replace(/\W/g, ""))} className="mt-1 rounded-lg px-2 py-1 font-mono ring-1 ring-slate-300" />
        </label>
        <button className="btn-small bg-slate-100" onClick={() => setSid(`admin${Math.random().toString(36).slice(2, 6)}`)}>New session</button>
        <button className="btn-small bg-slate-100" onClick={refresh}>Reload state</button>
        <span className="mx-2 h-6 w-px bg-slate-200" />
        <span className="text-sm font-semibold text-slate-600">Open the app here:</span>
        {[["teach", "Teach Lumi"], ["town", "Lumi's Town"], ["journey", "Lumi's Journey"], ["demo", "Demo worksheet"]].map(([go, label]) => (
          <a key={go} href={`/?go=${go}`} className="btn-small bg-violet-100 text-violet-800">{label} ↗</a>
        ))}
        {state?.profile_attached && <span className="text-xs text-amber-700">⚠ attached to saved progress: changes are saved</span>}
        <p className="w-full text-sm text-slate-500" role="status">{msg}</p>
      </section>

      {/* presets */}
      <section className="card p-4">
        <h2 className="mb-3 text-lg font-extrabold text-slate-800">Presets</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.id} title={p.hint} className="btn-small bg-amber-100 text-amber-900"
              onClick={() => run(`Preset: ${p.label}`, () => call<State>("preset", { session_id: sid, preset: p.id, path }))}>
              {p.label}
            </button>
          ))}
          <label className="ml-2 text-sm font-semibold text-slate-600">
            Path{" "}
            <select value={path} onChange={(e) => setPath(e.target.value)} className="rounded-lg px-2 py-1 ring-1 ring-slate-300">
              {PATHS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">{PRESETS.map((p) => `${p.label}: ${p.hint}`).join(" · ")}</p>
      </section>

      {/* skills */}
      {state && (
        <section className="card overflow-x-auto p-4">
          <h2 className="mb-3 text-lg font-extrabold text-slate-800">Skills</h2>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500">
              <tr><th className="py-1">Skill</th><th>Stars</th><th>Ready to teach</th><th>Best quote (scrapbook, ending)</th></tr>
            </thead>
            <tbody>
              {state.concepts.map((c) => (
                <tr key={c.concept} className="border-t border-slate-100">
                  <td className="py-1.5 font-semibold">{CONCEPT_EMOJI[c.concept]} {c.label}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-small bg-slate-100" disabled={c.stars <= 0} onClick={() => setStars(c.concept, Math.max(0, c.stars - 0.5))} aria-label={`fewer stars for ${c.label}`}>−</button>
                      <span className="w-10 text-center font-mono">{c.stars}</span>
                      <button className="btn-small bg-slate-100" disabled={c.stars >= 3} onClick={() => setStars(c.concept, Math.min(3, c.stars + 0.5))} aria-label={`more stars for ${c.label}`}>+</button>
                    </div>
                  </td>
                  <td>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={c.ready} onChange={(e) => patch(`${c.concept} ready=${e.target.checked}`, { concepts: [{ concept: c.concept, ready: e.target.checked }] })} />
                      <span className="text-xs text-slate-500">{c.gate === "warmup" ? "normally: warm-up" : "normally: Help mode"}</span>
                    </label>
                  </td>
                  <td>
                    <input
                      defaultValue={c.quote ?? ""}
                      key={`${c.concept}-${c.quote}`}
                      placeholder="(none)"
                      onBlur={(e) => e.target.value !== (c.quote ?? "") && patch(`${c.concept} quote`, { concepts: [{ concept: c.concept, quote: e.target.value }] })}
                      className="w-full rounded-lg px-2 py-1 ring-1 ring-slate-200"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-small bg-slate-100" onClick={() => patch("All 1★", { concepts: TEACHABLE.map((c) => ({ concept: c, stars: 1 })) })}>All 1★</button>
            <button className="btn-small bg-slate-100" onClick={() => patch("All 0★", { concepts: TEACHABLE.map((c) => ({ concept: c, stars: 0 })) })}>All 0★</button>
            <button className="btn-small bg-slate-100" onClick={() => patch("All ready", { concepts: TEACHABLE.map((c) => ({ concept: c, ready: true })) })}>All ready</button>
          </div>
        </section>
      )}

      {/* story */}
      {state && (
        <section className="card p-4">
          <h2 className="mb-1 text-lg font-extrabold text-slate-800">Lumi's Journey</h2>
          <p className="mb-3 text-sm text-slate-600">
            {state.story.started ? `Started · current act ${state.story.current_act}` : "Not started (needs 2 Town shops at 1★)"}
            {state.story.ending && ` · ending ready: ${state.story.ending}`} · seen: {state.story.seen.join(", ") || "none"}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {Object.entries(state.acts).map(([act, versions]) => (
              <label key={act} className="flex flex-col text-sm font-semibold text-slate-600">
                Act {act}
                <select
                  value={chosen[act] ?? ""}
                  onChange={(e) => {
                    const next: Record<string, string | null> = { ...chosen, [act]: e.target.value || null };
                    // clearing an act clears the later ones (acts go in order)
                    for (const a of Object.keys(next)) if (Number(a) > Number(act) && !e.target.value) next[a] = null;
                    void patch(`Act ${act} → ${e.target.value || "none"}`, { story_chosen: next });
                  }}
                  className="mt-1 rounded-lg px-2 py-1 ring-1 ring-slate-300"
                >
                  <option value="">(not chosen)</option>
                  {versions.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
            ))}
            <button className="btn-small bg-slate-100" onClick={() => patch("Story reset", { story_chosen: {}, clear_seen: true })}>Reset story</button>
            <button className="btn-small bg-slate-100" onClick={() => patch("Seen cleared (scenes will be announced again)", { clear_seen: true })}>Clear "seen"</button>
          </div>
        </section>
      )}

      {/* previews */}
      {on && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-2 text-lg font-extrabold text-slate-800">Preview a problem</h2>
            <div className="flex flex-wrap gap-2">
              <select value={pConcept} onChange={(e) => setPConcept(e.target.value)} className="rounded-lg px-2 py-1 ring-1 ring-slate-300">
                {TEACHABLE.map((c) => <option key={c} value={c}>{CONCEPT_EMOJI[c]} {c}</option>)}
              </select>
              <LangPick lang={lang} setLang={setLang} />
              <button className="btn-small bg-sky-100 text-sky-900" onClick={() => call<Problem>("problem", { concept: pConcept, language: lang }).then(setProblem).catch((e) => setMsg(`✗ ${e.message}`))}>
                New problem
              </button>
            </div>
            {problem && (
              <div className="mt-3 space-y-1 text-sm">
                <p className="font-hand text-2xl">{problem.problem}</p>
                {problem.visual && <MathVisual visual={problem.visual} />}
                <p>Answer: <b className="text-green-700">{problem.answer}</b> · Lumi's planted mistake: <b className="text-rose-700">{problem.planted}</b> · keypad: {problem.kind}</p>
                <ol className="list-decimal pl-5 text-slate-600">{problem.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
              </div>
            )}
          </div>
          <div className="card p-4">
            <h2 className="mb-2 text-lg font-extrabold text-slate-800">Preview a story scene</h2>
            <div className="flex flex-wrap gap-2">
              <select value={sceneKey} onChange={(e) => setSceneKey(e.target.value)} className="rounded-lg px-2 py-1 ring-1 ring-slate-300">
                {state && [...Object.values(state.acts).flat(), ...PATHS.map((p) => `moon_${p}`)].map((k) => <option key={k}>{k}</option>)}
              </select>
              <LangPick lang={lang} setLang={setLang} />
              <button className="btn-small bg-indigo-100 text-indigo-900" onClick={() => call<ScenePreview>("scene", { session_id: sid, key: sceneKey, language: lang }).then(setScene).catch((e) => setMsg(`✗ ${e.message}`))}>
                Show
              </button>
            </div>
            {scene && (
              <div className="mt-3 text-sm">
                <p className="text-lg font-bold">{scene.emoji} {scene.title} <span className="text-xs text-slate-500">act {scene.act}</span></p>
                <ol className="mt-1 space-y-1">{scene.lines.map((l, i) => <li key={i}><span className="mr-1 rounded bg-slate-100 px-1 font-mono text-xs">{l.emotion}</span>{l.text}</li>)}</ol>
              </div>
            )}
          </div>
        </section>
      )}
    </Shell>
  );
}

function LangPick({ lang, setLang }: { lang: Language; setLang: (l: Language) => void }) {
  return (
    <select value={lang} onChange={(e) => setLang(e.target.value as Language)} className="rounded-lg px-2 py-1 ring-1 ring-slate-300" aria-label="language">
      <option value="en">English</option><option value="es">Español</option><option value="vi">Tiếng Việt</option>
    </select>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-800">🛠 Lumi admin <span className="text-sm font-semibold text-rose-600">dev only</span></h1>
        <a href="/" className="btn-small bg-white ring-1 ring-slate-200">← Back to the app</a>
      </header>
      {children}
    </main>
  );
}
