import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";
import type { ChatTurn, Emotion, GradeResponse, Language } from "./api";
import { useCaptureTrigger } from "./camera/useCaptureTrigger";
import { useHandDetector } from "./camera/useHandDetector";
import { useRemoteCamera } from "./camera/useRemoteCamera";
import { useWebcam } from "./camera/useWebcam";
import { t } from "./i18n";
import { celebrate, sounds } from "./robot/sounds";
import { useSpeech } from "./robot/useSpeech";
import ParentReport from "./views/ParentReport";
import TeachView from "./views/TeachView";
import TutorView from "./views/TutorView";

/**
 * Two modes (big tabs): "Help me" (Lumi tutors the child's own worksheet) and "Teach Lumi"
 * (the child teaches Lumi — server-driven, see views/TeachView.tsx and teach-lumi-spec.md).
 *
 * Help-mode state machine:
 *   SLEEPING --hand appears--> WATCHING
 *   WATCHING --no hands + still 1.5s + page changed--> CAPTURING --> THINKING --> RESULT --> WATCHING
 *   any state --60s no activity--> SLEEPING
 */
type Phase = "SLEEPING" | "WATCHING" | "CAPTURING" | "THINKING" | "RESULT";
type Source = "webcam" | "remote";
type Mode = "teach" | "help";

const SLEEP_AFTER_MS = 60_000;

const LINES: Record<Language, Record<string, string>> = {
  en: {
    hello: "Hi, I'm Lumi! Put your worksheet under my light and I'll check it with you.",
    hand: "Move your hand so I can see!",
    unreadable: "Hmm, I can't read that. Can you hold the page still under the light?",
    empty: "I don't see any math problems yet. Show me your worksheet!",
    error: "Oops, my brain hiccupped. Let's try again!",
    wake: "Oh, hello! I'm awake.",
    slow: "Hmm, that took me too long. Let's try again!",
    quota: "I'm out of thinking power for today! A grown-up can check my settings.",
    look1: "Ooh, let me take a close look…",
    look2: "Hmm, let me check your work…",
    look3: "Let me see what you wrote…",
  },
  es: {
    hello: "¡Hola, soy Lumi! Pon tu hoja bajo mi luz y la revisamos juntos.",
    hand: "¡Mueve la mano para que pueda ver!",
    unreadable: "Mmm, no puedo leerlo. ¿Puedes dejar la hoja quieta bajo la luz?",
    empty: "Todavía no veo problemas de matemáticas. ¡Muéstrame tu hoja!",
    error: "¡Uy! Probemos otra vez.",
    wake: "¡Oh, hola! Ya estoy despierto.",
    slow: "Mmm, tardé demasiado. ¡Probemos otra vez!",
    quota: "¡Me quedé sin energía para pensar hoy! Un adulto puede revisar mi configuración.",
    look1: "¡Uy, déjame mirar de cerca…!",
    look2: "Mmm, déjame revisar tu trabajo…",
    look3: "A ver qué escribiste…",
  },
  vi: {
    hello: "Chào con, mình là Lumi! Đặt bài tập dưới đèn, mình cùng kiểm tra nhé.",
    hand: "Con bỏ tay ra để mình nhìn thấy nhé!",
    unreadable: "Ừm, mình chưa đọc được. Con giữ tờ giấy yên dưới đèn nhé?",
    empty: "Mình chưa thấy bài toán nào. Cho mình xem bài tập nhé!",
    error: "Ối, mình bị lỗi một chút. Thử lại nhé!",
    wake: "Ồ, chào con! Mình dậy rồi.",
    slow: "Ừm, mình nghĩ lâu quá. Thử lại nhé!",
    quota: "Hôm nay mình hết năng lượng suy nghĩ rồi! Nhờ người lớn kiểm tra cài đặt nhé.",
    look1: "Ồ, để mình xem kỹ nào…",
    look2: "Ừm, để mình kiểm tra bài nhé…",
    look3: "Để mình xem con viết gì nào…",
  },
};

const LANGS: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "vi", label: "Tiếng Việt" },
];

const newSessionId = () => Math.random().toString(36).slice(2, 8);

export default function App() {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [language, setLanguage] = useState<Language>("en");
  const [appMode, setAppMode] = useState<Mode>("help");
  const [source, setSource] = useState<Source>("webcam");
  const [cameraOn, setCameraOn] = useState(false);
  const [phase, setPhase] = useState<Phase>("WATCHING");
  const [emotion, setEmotion] = useState<Emotion>("idle");
  const [bubble, setBubble] = useState(LINES.en.hello);
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [voiceTrigger, setVoiceTrigger] = useState(false);
  const [mode, setMode] = useState<string>("…");
  const [samples, setSamples] = useState<{ name: string; url: string }[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [teachKey, setTeachKey] = useState(0);

  const busy = useRef(false);
  const lastActivity = useRef(Date.now());
  const fileInput = useRef<HTMLInputElement>(null);
  const markGraded = useRef<() => void>(() => {});
  const runGradeRef = useRef<(get: () => Promise<Blob>) => void>(() => {});

  const helping = appMode === "help";
  const speech = useSpeech(language);
  const webcam = useWebcam(helping && cameraOn && source === "webcam");
  const remote = useRemoteCamera(sessionId, helping && cameraOn && source === "remote");
  const cam = source === "webcam" ? webcam : remote;
  const hands = useHandDetector();
  const L = LINES[language];
  const s = t(language);
  const { startPhraseListener } = speech;
  const captureRef = useRef(cam.captureHighRes);
  captureRef.current = cam.captureHighRes;

  useEffect(() => {
    api.health().then((h) => setMode(h.mode === "mock" ? "mock mode" : h.model)).catch(() => setMode("backend offline"));
    api.samples().then(setSamples).catch(() => {});
  }, []);

  const say = useCallback(
    async (text: string, emo: Emotion) => {
      setEmotion(emo);
      setBubble(text);
      setHistory((h) => [...h.slice(-8), { role: "robot", text }]);
      await speech.speak(text);
    },
    [speech],
  );

  const afterTutor = useCallback(
    async (tr: api.TutorResponse) => {
      if (tr.focus_problem_id !== null) setFocusId(tr.focus_problem_id);
      if (tr.emotion === "celebrating") celebrate();
      else if (tr.emotion === "happy") sounds.correct();
      else sounds.hint();
      api.setLamp(tr.emotion === "celebrating" || tr.emotion === "happy" ? "correct" : "hint");
      await say(tr.say, tr.emotion);
    },
    [say],
  );

  /** CAPTURING → THINKING → RESULT → WATCHING */
  const runGrade = useCallback(
    async (getImage: () => Promise<Blob>) => {
      if (busy.current) return;
      busy.current = true;
      lastActivity.current = Date.now();
      try {
        setPhase("CAPTURING");
        sounds.shutter();
        const blob = await getImage();
        markGraded.current();
        setCaptureUrl((old) => {
          if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setResult(null);
        setFocusId(null);
        setPhase("THINKING");
        setEmotion("thinking");
        api.setLamp("thinking");
        sounds.thinking();

        // Speak a short filler while Gemini reads the page, so the wait feels natural.
        const filler = L[`look${1 + Math.floor(Math.random() * 3)}`];
        setBubble(filler);
        const [g] = await Promise.all([api.grade(blob, sessionId), speech.speak(filler)]);
        setEmotion("thinking");
        if (g.llm_error === "quota") {
          setMode("Gemini free quota used up");
          return void (await say(L.quota, "confused"));
        }
        if (g.llm_error) return void (await say(g.llm_error === "timeout" ? L.slow : L.error, "confused"));
        if (g.hand_blocking) return void (await say(L.hand, "confused"));
        if (g.unreadable) return void (await say(L.unreadable, "confused"));
        setResult(g);
        if (!g.problems.length) return void (await say(L.empty, "curious"));
        setPhase("RESULT");
        const tr = await api.tutor({ session_id: sessionId, language, action: "react", history });
        await afterTutor(tr);
      } catch (e) {
        console.error(e);
        await say(L.error, "confused");
      } finally {
        busy.current = false;
        lastActivity.current = Date.now();
        setPhase((p) => (p === "SLEEPING" ? p : "WATCHING"));
        api.setLamp("idle");
      }
    },
    [sessionId, language, history, L, say, afterTutor, speech],
  );
  runGradeRef.current = runGrade;

  const trigger = useCaptureTrigger({
    element: cam.element,
    enabled: helping && cameraOn && cam.ready,
    detectHands: hands.detect,
    onTrigger: () => runGradeRef.current(cam.captureHighRes),
    onActivity: (handsVisible) => {
      lastActivity.current = Date.now();
      if (handsVisible) {
        setPhase((p) => {
          if (p === "SLEEPING") {
            setEmotion("idle");
            setBubble(L.wake);
            return "WATCHING";
          }
          return p;
        });
      }
    },
  });

  markGraded.current = trigger.markGraded;

  // Sleep after ~60 s of no activity (Help mode only; only on the transition, so the lamp isn't spammed).
  useEffect(() => {
    if (phase === "SLEEPING" || !helping) return;
    const id = window.setInterval(() => {
      if (!busy.current && !speech.speaking && Date.now() - lastActivity.current > SLEEP_AFTER_MS) {
        setPhase("SLEEPING");
        setEmotion("sleeping");
        setBubble("");
        api.setLamp("off");
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [phase, speech.speaking, helping]);

  // Idle face whenever we're back to watching and not talking.
  useEffect(() => {
    if (phase === "WATCHING" && !speech.speaking && !busy.current) {
      const id = window.setTimeout(() => setEmotion((e) => (e === "listening" ? e : "idle")), 4000);
      return () => window.clearTimeout(id);
    }
  }, [phase, speech.speaking]);

  // Voice fallback trigger: "check my work".
  useEffect(() => {
    if (!voiceTrigger || !cameraOn || !helping) return;
    const phrases = { en: ["check my work", "check it"], es: ["revisa mi trabajo", "revisa"], vi: ["kiểm tra", "chấm bài"] }[language];
    return startPhraseListener(phrases, () => runGradeRef.current(captureRef.current));
  }, [voiceTrigger, cameraOn, helping, language, startPhraseListener]);

  const touch = () => {
    lastActivity.current = Date.now();
    if (phase === "SLEEPING") setPhase("WATCHING");
  };

  const askTutor = async (action: "hint" | "chat", child_said?: string, problemId?: number | null) => {
    touch();
    setEmotion("thinking");
    try {
      const tr = await api.tutor({
        session_id: sessionId, language, action, child_said, history,
        problem_id: problemId ?? focusId,
      });
      await afterTutor(tr);
    } catch {
      await say(L.error, "confused");
    }
  };

  const talk = async () => {
    touch();
    speech.stopSpeaking();
    setEmotion("listening");
    setBubble("🎤 …");
    const heard = await speech.listen();
    if (!heard) return setEmotion("idle");
    setHistory((h) => [...h.slice(-8), { role: "child", text: heard }]);
    if (/check (my )?work|revisa|kiểm tra/i.test(heard)) return runGrade(cam.captureHighRes);
    await askTutor(/hint|help|ayuda|gợi ý/i.test(heard) ? "hint" : "chat", heard);
  };

  const gradeSample = (url: string) => {
    touch();
    runGrade(() => fetch(`${api.BACKEND}${url}`).then((r) => r.blob()));
  };

  const switchMode = (m: Mode) => {
    if (m === appMode) return;
    speech.stopSpeaking();
    if (m === "help") {
      setEmotion("idle");
      setBubble(L.hello);
    } else {
      setTeachKey((k) => k + 1); // fresh Teach view (and worksheet) each time the tab is opened
    }
    setAppMode(m);
  };

  const newSession = async () => {
    const id = newSessionId();
    setSessionId(id);
    setResult(null);
    setCaptureUrl(null);
    setHistory([]);
    setFocusId(null);
    setEmotion("idle");
    setBubble(L.hello);
    setTeachKey((k) => k + 1);
  };

  const phoneUrl = `${location.origin}/?phone=${sessionId}`;
  const isLocalhost = /localhost|127\.0\.0\.1/.test(location.hostname);
  const tab = (m: Mode) =>
    `btn-kid px-6 text-xl ${appMode === m ? (m === "teach" ? "bg-violet-500 text-white" : "bg-sky-500 text-white") : "bg-white text-slate-600 ring-2 ring-slate-200"}`;

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/lamp.svg" alt="" className="h-12 w-12 drop-shadow" />
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">
            Lumi <span className="text-lg font-semibold text-amber-500">· Homework Lamp</span>
          </h1>
        </div>
        <nav className="flex flex-wrap gap-3" aria-label="Mode">
          <button className={tab("teach")} onClick={() => switchMode("teach")} aria-pressed={appMode === "teach"}>
            🧑‍🏫 {s.teachTab}
          </button>
          <button className={tab("help")} onClick={() => switchMode("help")} aria-pressed={appMode === "help"}>
            🙋 {s.helpTab}
          </button>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-2xl bg-white px-3 py-3 text-base font-semibold shadow ring-1 ring-sky-100"
            aria-label="Language"
          >
            {/* plain names: Windows renders flag emoji as letters */}
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <button className="btn-kid bg-white !min-h-12 !py-2 text-base text-slate-700 ring-1 ring-slate-200" onClick={() => setShowReport(true)}>
            👪 {s.grownups}
          </button>
        </div>
      </header>

      {appMode === "teach" ? (
        <TeachView
          key={`${sessionId}-${teachKey}-${language}`}
          sessionId={sessionId}
          language={language}
          speech={speech}
          onPracticeFirst={() => switchMode("help")}
          onShowReport={() => setShowReport(true)}
        />
      ) : (
        <>
          <TutorView
            emotion={emotion}
            talking={speech.speaking}
            bubble={bubble}
            phase={phase}
            captureUrl={captureUrl}
            result={result}
            focusId={focusId}
            language={language}
            onSelectProblem={(id) => {
              setFocusId(id);
              askTutor("hint", undefined, id);
            }}
          >
            <button className="btn-kid bg-lamp text-slate-900" disabled={!cam.ready || busy.current} onClick={() => runGrade(cam.captureHighRes)}>
              ✅ {s.checkWork}
            </button>
            <button className="btn-kid bg-violet-500 text-white" disabled={!result?.problems.length} onClick={() => askTutor("hint")}>
              💡 {s.hint}
            </button>
            <button className="btn-kid bg-sky-500 text-white" disabled={!speech.canListen || speech.listening} onClick={talk}>
              🎤 {s.talk}
            </button>
          </TutorView>

          <section className="grid gap-5 lg:grid-cols-12">
            <div className="card p-5 lg:col-span-7">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-xl font-extrabold">📷 {s.camera}</h2>
                <button
                  className={`btn-kid !min-h-12 !py-2 text-base ${cameraOn ? "bg-slate-200 text-slate-700" : "bg-lamp text-slate-900"}`}
                  onClick={() => { touch(); setCameraOn((c) => !c); }}
                >
                  {cameraOn ? s.cameraOff : s.cameraOn}
                </button>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-slate-900">
                {source === "webcam" ? (
                  <video ref={webcam.videoRef} playsInline muted className="aspect-video w-full object-contain" />
                ) : (
                  <RemoteCanvas canvas={remote.element as HTMLCanvasElement | null} />
                )}
                {!cameraOn && <div className="absolute inset-0 grid place-items-center text-xl text-slate-400">📷 {s.cameraIsOff}</div>}
                {cam.error && <div className="absolute inset-0 grid place-items-center p-4 text-center text-red-300">{cam.error}</div>}
              </div>
            </div>

            <div className="card flex flex-col gap-3 p-5 lg:col-span-5">
              <h2 className="text-xl font-extrabold">🧪 {s.trySample}</h2>
              <p className="text-slate-500">{s.trySampleHint}</p>
              <div className="flex flex-wrap gap-2">
                {samples.map((x) => (
                  <button key={x.name} className="btn-kid bg-amber-100 text-amber-900" onClick={() => gradeSample(x.url)}>
                    📄 {x.name}
                  </button>
                ))}
                <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" onClick={() => fileInput.current?.click()}>
                  ⬆️ {s.upload}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) runGrade(async () => f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </section>
        </>
      )}

      <details className="card p-4 text-sm text-slate-600">
        <summary className="cursor-pointer font-bold text-slate-700">🔧 {s.settings}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p>
            session <code>{sessionId}</code> · {mode}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={source} onChange={(e) => setSource(e.target.value as Source)} className="rounded-lg bg-slate-100 px-3 py-2">
              <option value="webcam">Webcam</option>
              <option value="remote">Phone / ESP32 lamp</option>
            </select>
            <button className="btn-small bg-slate-100" onClick={newSession}>
              {s.newSession}
            </button>
            <button className="btn-small bg-slate-100" onClick={() => setShowReport(true)}>
              {s.report}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge on={(trigger.status.hands ?? 0) > 0} label={trigger.status.hands === null ? `hands: ${hands.status}` : `hands: ${trigger.status.hands}`} />
            <Badge on={!trigger.status.moving} label={trigger.status.moving ? "moving" : "still"} />
            <Badge on={trigger.status.armed} label={trigger.status.armed ? "armed" : "waiting for hands"} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} /> trigger debug
          </label>
          {showDebug && (
            <pre className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300">
              {JSON.stringify({ ...trigger.status, stillMs: Math.round(trigger.status.stillMs), pageChange: trigger.status.pageChange.toFixed(4) }, null, 1)}
            </pre>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={voiceTrigger} onChange={(e) => setVoiceTrigger(e.target.checked)} disabled={!speech.canListen} />
            Voice trigger: say “check my work”
          </label>
          {source === "remote" && (
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <QRCodeSVG value={phoneUrl} size={140} />
              </div>
              <div>
                <p>Scan with the phone, allow the camera, and point it down at the worksheet.</p>
                <p className="mt-2">
                  Status: <span className={remote.connected ? "text-green-600" : "text-slate-400"}>{remote.connected ? "connected" : "waiting"}</span>
                </p>
                {isLocalhost && <p className="mt-2 text-amber-600">Phones can't open localhost — open this page via your ngrok / Cloudflare Tunnel HTTPS URL first.</p>}
                <p className="mt-2 text-xs">ESP32 lamp: POST JPEGs to /api/frame/{sessionId}</p>
              </div>
            </div>
          )}
        </div>
      </details>

      {showReport && <ParentReport sessionId={sessionId} language={language} onClose={() => setShowReport(false)} />}
    </div>
  );
}

function Badge({ on, label }: { on: boolean; label: string }) {
  return <span className={`rounded-full px-2 py-1 ${on ? "bg-green-500 text-white" : "bg-slate-200 text-slate-600"}`}>{label}</span>;
}

function RemoteCanvas({ canvas }: { canvas: HTMLCanvasElement | null }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canvas || !host.current) return;
    canvas.className = "w-full h-full object-contain";
    host.current.appendChild(canvas);
    return () => canvas.remove();
  }, [canvas]);
  return <div ref={host} className="grid aspect-video w-full place-items-center" />;
}
