import { MotionConfig } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";
import type { ChatTurn, Concept, Emotion, GradeResponse, Language } from "./api";
import { useCaptureTrigger } from "./camera/useCaptureTrigger";
import { useHandDetector } from "./camera/useHandDetector";
import { useRemoteCamera } from "./camera/useRemoteCamera";
import { useWebcam } from "./camera/useWebcam";
import ServerSetting from "./components/ServerSetting";
import { App as NativeApp } from "@capacitor/app";
import { isNativeApp, useIsPhone } from "./platform";
import BottomSheet from "./components/phone/BottomSheet";
import PhoneTabBar, { type PhoneTab } from "./components/phone/PhoneTabBar";
import PhoneHome from "./views/PhoneHome";
import DreamPicker from "./views/DreamPicker";
import { dreamInfo, useDream, type DreamId } from "./dream";
import { pretty, t } from "./i18n";
import MistakeOverlay from "./components/MistakeOverlay";
import { expressionFor } from "./components/mascot/lumiAssets";
import { motion } from "framer-motion";
import { celebrate, sounds } from "./robot/sounds";
import { useSpeech } from "./robot/useSpeech";
import ParentReport from "./views/ParentReport";
import TeachView from "./views/TeachView";
import TownPage, { JOURNEY_TAB } from "./views/TownPage";
import TutorView from "./views/TutorView";
import WelcomeView from "./views/WelcomeView";
import SavedProgress from "./components/SavedProgress";
import LumiMascot from "./components/mascot/LumiMascot";

/**
 * Two modes (big tabs): "Help me" (Lumi tutors the child's own worksheet) and "Teach Lumi"
 * (the child teaches Lumi — server-driven, see views/TeachView.tsx and docs/02-learning-design.md).
 *
 * Help-mode state machine:
 *   SLEEPING --hand appears--> WATCHING
 *   WATCHING --no hands + still 1.5s + page changed--> CAPTURING --> THINKING --> RESULT --> WATCHING
 *   any state --60s no activity--> SLEEPING
 */
type Phase = "SLEEPING" | "WATCHING" | "CAPTURING" | "THINKING" | "RESULT";
type Source = "webcam" | "remote";
type Mode = "welcome" | "teach" | "help" | "town";

const SLEEP_AFTER_MS = 60_000;

const LINES: Record<Language, Record<string, string>> = {
  en: {
    hello: "Hi, I'm Lumi! Show me your worksheet and I'll check it with you.",
    hand: "Move your hand so I can see!",
    unreadable: "Hmm, I can't read that. Can you hold the page still and closer to the camera?",
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
    hello: "¡Hola, soy Lumi! Muéstrame tu hoja y la revisamos juntos.",
    hand: "¡Mueve la mano para que pueda ver!",
    unreadable: "Mmm, no puedo leerlo. ¿Puedes acercar la hoja a la cámara y dejarla quieta?",
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
    hello: "Chào con, mình là Lumi! Cho mình xem bài tập, mình cùng kiểm tra nhé.",
    hand: "Con bỏ tay ra để mình nhìn thấy nhé!",
    unreadable: "Ừm, mình chưa đọc được. Con giữ tờ giấy yên và gần camera hơn nhé?",
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

/** 128 random bits as 32 hex characters: the only key to this child's session, so it must be unguessable (docs/06). */
const newSessionId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
const VALID_SESSION_ID = /^[0-9a-f]{32}$/;
const SESSION_KEY = "lumi-session";

/** Keep the session across a page refresh (this tab only), so Help-mode progress and Lumi's stars survive. */
function initialSessionId(): string {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && VALID_SESSION_ID.test(saved)) return saved; // older short ids are replaced
  } catch {
    /* storage blocked: fall through */
  }
  const id = newSessionId();
  saveSessionId(id);
  return id;
}

const PROFILE_KEY = "lumi-profile"; // saved-progress id (only after a grown-up's consent)

function readProfileId(): string | null {
  try {
    return localStorage.getItem(PROFILE_KEY);
  } catch {
    return null;
  }
}

function writeProfileId(id: string | null) {
  try {
    if (id) localStorage.setItem(PROFILE_KEY, id);
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* storage blocked: progress just won't be remembered on this device */
  }
}

function saveSessionId(id: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* storage blocked: the session just won't survive a refresh */
  }
}

export default function App() {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [language, setLanguage] = useState<Language>("en");
  const [appMode, setAppMode] = useState<Mode>("welcome");
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
  // Photos are taken when someone asks (Check my work). Auto-snap when hands leave the frame is an opt-in grown-up setting.
  const [autoSnap, setAutoSnap] = useState(false);
  const [mode, setMode] = useState<string>("…");
  const [samples, setSamples] = useState<{ name: string; url: string }[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [teachKey, setTeachKey] = useState(0);
  const [teachDemo, setTeachDemo] = useState(false);
  const [townStart, setTownStart] = useState<{ concept: Concept | null; story: string | null; key: number } | null>(null);
  const [teachAlive, setTeachAlive] = useState(false); // keep the worksheet while visiting the town
  const [profileId, setProfileId] = useState<string | null>(readProfileId);
  const [remembered, setRemembered] = useState(0);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Phone layout (docs/10-mobile-ui.md)
  const isPhone = useIsPhone();
  const [phoneStart, setPhoneStart] = useState<api.TeachConceptInfo | null | undefined>(undefined);
  const [grownupsOpen, setGrownupsOpen] = useState(false);
  // Desktop: a running lesson takes the whole page (TeachView reports it), and the mode buttons can be hidden.
  const [lessonFocus, setLessonFocus] = useState(false);
  const [navOpen, setNavOpen] = useState(() => localStorage.getItem("lumi_nav_open") !== "0");
  const toggleNav = () =>
    setNavOpen((o) => {
      localStorage.setItem("lumi_nav_open", o ? "0" : "1");
      return !o;
    });
  // Lumi's dream (docs/12-dreams.md): chosen before the first lesson; the child can change it from home.
  const [dream, chooseDream] = useDream();
  const [pickingDream, setPickingDream] = useState(false);
  const [phoneCam, setPhoneCam] = useState(false); // server allows the "phone as camera" relay (LUMI_PHONE_CAMERA=1)
  const [helpShow, setHelpShow] = useState<"camera" | "photo">("camera");

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
    api.health()
      .then((h) => {
        setMode(h.mode === "mock" ? "mock mode" : h.model);
        setPhoneCam(!!h.phone_camera);
      })
      .catch(() => setMode("backend offline"));
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
      }
    },
    [sessionId, language, history, L, say, afterTutor, speech],
  );
  runGradeRef.current = runGrade;

  const trigger = useCaptureTrigger({
    element: cam.element,
    enabled: helping && cameraOn && cam.ready && autoSnap,
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

  // Sleep after ~60 s of no activity (Help mode only).
  useEffect(() => {
    if (phase === "SLEEPING" || !helping) return;
    const id = window.setInterval(() => {
      if (!busy.current && !speech.speaking && Date.now() - lastActivity.current > SLEEP_AFTER_MS) {
        setPhase("SLEEPING");
        setEmotion("sleeping");
        setBubble("");
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
    if (m === "town") {
      setTownStart((t0) => ({ concept: null, story: null, key: (t0?.key ?? 0) + 1 }));
    } else if (m === "help") {
      setEmotion("idle");
      setBubble(L.hello);
    } else if (!(m === "teach" && appMode === "town" && teachAlive)) {
      setTeachDemo(false);
      setTeachKey((k) => k + 1); // fresh Teach view (and worksheet) each time the tab is opened
    }
    if (m === "teach") setTeachAlive(true);
    if (m === "help" || m === "welcome") setTeachAlive(false); // Teach unmounts there, so don't revive it hidden later
    setAppMode(m);
  };

  /** Phone: start a lesson on the skill tapped on the Home path (null = Lumi picks). */
  const showDreamPicker = pickingDream || (!dream && (appMode === "welcome" || appMode === "teach"));
  const onDream = (d: DreamId) => {
    chooseDream(d);
    if (pickingDream) {
      setPickingDream(false);
      switchMode("welcome"); // back home; the next worksheet uses the new dream
    }
  };
  const changeDream = () => {
    speech.stopSpeaking();
    setPickingDream(true);
  };
  const dreamPickerEl = <DreamPicker language={language} current={dream} onSelect={onDream} />;
  const dreamNow = dreamInfo(dream);

  const startFromHome = (c: api.TeachConceptInfo | null) => {
    speech.stopSpeaking();
    setPhoneStart(c);
    setTeachDemo(false);
    setTeachKey((k) => k + 1);
    setTeachAlive(true);
    setAppMode("teach");
  };

  /** Phone: leave the lesson for Home (after "Stop this homework?"). */
  const exitLesson = () => {
    setPhoneStart(undefined);
    switchMode("welcome");
  };

  const selectTab = (tb: PhoneTab) => {
    if (tb === "home") switchMode("welcome");
    else if (tb === "help") switchMode("help");
    else if (tb === "town") openTown(null);
    else openTown(null, JOURNEY_TAB);
  };

  const openTown = (concept: Concept | null, story: string | null = null) => {
    speech.stopSpeaking();
    setTownStart((t0) => ({ concept, story, key: (t0?.key ?? 0) + 1 }));
    setAppMode("town");
  };

  // Android back button (app only): step back a screen; never throw away a lesson. From Teach or the welcome
  // screen it sends the app to the background (state kept) instead of closing it. docs/09-android-app.md.
  const backRef = useRef<() => void>(() => {});
  backRef.current = () => {
    if (grownupsOpen) setGrownupsOpen(false);
    else if (showReport) setShowReport(false);
    else if (pickingDream && dream) setPickingDream(false);
    else if (appMode === "town") {
      if (teachAlive) switchMode("teach");
      else switchMode("welcome");
    } else if (appMode === "help") switchMode("welcome");
    else void NativeApp.minimizeApp();
  };
  useEffect(() => {
    if (!isNativeApp) return;
    const handle = NativeApp.addListener("backButton", () => backRef.current());
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  // Deep links for testing (the admin portal opens these in the same tab, so the session carries over):
  // /?go=teach | town | journey | demo
  useEffect(() => {
    const go = new URLSearchParams(location.search).get("go");
    if (!go) return;
    window.history.replaceState(null, "", location.pathname);
    if (go === "teach") switchMode("teach");
    else if (go === "town") openTown(null);
    else if (go === "journey") openTown(null, JOURNEY_TAB);
    else if (go === "demo") startDemo();
    // once, on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Adult action (Grown-up settings): the fixed canonical demo sheet, for rehearsals and pitches. */
  const startDemo = () => {
    speech.stopSpeaking();
    setGrownupsOpen(false);
    setTeachDemo(true);
    setTeachKey((k) => k + 1);
    setAppMode("teach");
  };

  const newSession = async () => {
    const id = newSessionId();
    saveSessionId(id);
    setTeachDemo(false);
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
    `btn-kid px-6 text-xl ${appMode === m ? (m === "teach" ? "bg-violet-500 text-white" : m === "town" ? "bg-teal-500 text-white" : "bg-sky-500 text-white") : "bg-white text-slate-600 ring-2 ring-slate-200"}`;

  const deleteSessionData = async () => {
    await api.resetSession(sessionId).catch(() => {});
    await newSession();
  };

  // Saved progress: link this session to the device's profile (if a grown-up opted in earlier).
  useEffect(() => {
    if (!profileId) return setRemembered(0);
    let live = true;
    api.attachProfile(sessionId, profileId)
      .then((p) => live && setRemembered(p.summary.skills_taught))
      .catch((e) => {
        if (!live) return;
        if (e instanceof api.ApiError && (e.status === 404 || e.status === 422)) {
          writeProfileId(null); // deleted or expired on the server
          setProfileId(null);
        }
      });
    return () => {
      live = false;
    };
  }, [sessionId, profileId]);

  const saveProgress = async () => {
    setProfileBusy(true);
    setProfileError(null);
    try {
      const p = await api.createProfile(sessionId);
      writeProfileId(p.profile_id);
      setProfileId(p.profile_id);
    } catch {
      setProfileError(s.saveFailed);
    } finally {
      setProfileBusy(false);
    }
  };

  const deleteSavedProgress = async () => {
    if (!profileId) return;
    setProfileBusy(true);
    setProfileError(null);
    try {
      await api.deleteProfile(profileId);
      writeProfileId(null);
      setProfileId(null);
      await deleteSessionData(); // also clear what this session holds in memory
    } catch {
      setProfileError(s.saveFailed);
    } finally {
      setProfileBusy(false);
    }
  };

  // Screen pieces shared by the desktop page and the phone frame (docs/10-mobile-ui.md).
  const teachTownEl = (
        <>
        {appMode === "town" && townStart && (
          <TownPage
            key={`${sessionId}-${language}-${townStart.key}`}
            sessionId={sessionId}
            language={language}
            speech={speech}
            startConcept={townStart.concept}
            startStory={townStart.story}
            onBackToHomework={() => switchMode("teach")}
            phone={isPhone}
            showBack={!isPhone || teachAlive}
          />
        )}
        {(appMode === "teach" || teachAlive) && (
        <div hidden={appMode !== "teach"} className={isPhone ? "h-full" : undefined}>
        <TeachView
          key={`${sessionId}-${teachKey}-${language}`}
          sessionId={sessionId}
          language={language}
          speech={speech}
          onPracticeFirst={() => switchMode("help")}
          onShowReport={() => setShowReport(true)}
          onOpenTown={openTown}
          demo={teachDemo}
          phone={isPhone}
          startWith={phoneStart}
          onExit={exitLesson}
          onFocusChange={setLessonFocus}
        />
        </div>
        )}
        </>
  );

  const helpEl = (
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
            <button className="btn-kid bg-sun text-slate-900" disabled={!cam.ready || busy.current} onClick={() => runGrade(cam.captureHighRes)}>
              ✅ {s.checkWork}
            </button>
            <button className="btn-kid bg-violet-500 text-white" disabled={!result?.problems.length} onClick={() => askTutor("hint")}>
              💡 {s.hint}
            </button>
            {!isNativeApp && (
              <button className="btn-kid bg-sky-500 text-white" disabled={!speech.canListen || speech.listening} onClick={talk}>
                🎤 {s.talk}
              </button>
            )}
          </TutorView>

          <section className="grid gap-5 lg:grid-cols-12">
            <div className="card p-5 lg:col-span-7">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-xl font-extrabold">📷 {s.camera}</h2>
                <button
                  className={`btn-kid !min-h-12 !py-2 text-base ${cameraOn ? "bg-slate-200 text-slate-700" : "bg-sun text-slate-900"}`}
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
  );

  // Phone Help (docs/10-mobile-ui.md): one thing at a time: start → camera → photo with circles.
  useEffect(() => {
    if (captureUrl) setHelpShow("photo");
  }, [captureUrl]);
  const showPhoto = helpShow === "photo" && !!captureUrl;
  const phoneHelpEl = (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-start gap-2 px-3 pt-1 pb-2">
        <LumiMascot expression={expressionFor(emotion)} pose="threeQuarter" talking={speech.speaking} label="auto" className="w-16 shrink-0" />
        {bubble && (
          <motion.div
            key={bubble}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            aria-live="polite"
            className="max-h-28 flex-1 overflow-y-auto rounded-2xl bg-sky-50 px-3 py-2 text-base leading-snug text-slate-900 ring-2 ring-sky-200"
          >
            {bubble}
          </motion.div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        {showPhoto ? (
          <>
            <div className="flex justify-center">
              <MistakeOverlay
                imageUrl={captureUrl!}
                problems={result?.problems ?? []}
                focusId={focusId}
                onSelect={(id) => { setFocusId(id); askTutor("hint", undefined, id); }}
              />
            </div>
            {result && result.problems.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {result.problems.map((pr) => (
                  <li key={pr.id}>
                    <button
                      onClick={() => { setFocusId(pr.id); askTutor("hint", undefined, pr.id); }}
                      className={`btn-kid !min-h-12 !px-3 !py-2 text-base ${focusId === pr.id ? "ring-4 ring-sun" : ""} ${
                        pr.needs_confirmation ? "bg-violet-100 text-violet-800" : !pr.answered ? "bg-slate-100 text-slate-600" : pr.is_correct ? "bg-green-100 text-green-800" : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      <span className="font-extrabold">#{pr.id}</span> {pretty(pr.problem)} = {pr.child_answer ?? "?"}{" "}
                      {pr.needs_confirmation ? "❔" : pr.is_correct ? "✓" : pr.answered ? "✗" : "…"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : cameraOn ? (
          <div className="relative overflow-hidden rounded-3xl bg-slate-900">
            <video ref={webcam.videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
            {cam.error && <div className="absolute inset-0 grid place-items-center p-4 text-center text-red-300">{cam.error}</div>}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="text-6xl" aria-hidden>📷✏️</div>
            <button className="btn-kid w-full bg-sun py-4 text-2xl text-slate-900" onClick={() => { touch(); setCameraOn(true); }}>
              📷 {s.cameraOn}
            </button>
            <p className="text-slate-500">{s.trySampleHint}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {samples.map((x) => (
                <button key={x.name} className="btn-kid bg-amber-100 text-amber-900" onClick={() => gradeSample(x.url)}>
                  📄 {x.name}
                </button>
              ))}
              <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" onClick={() => fileInput.current?.click()}>
                ⬆️ {s.upload}
              </button>
            </div>
          </div>
        )}
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

      {(showPhoto || cameraOn) && (
        <div className="grid shrink-0 grid-cols-2 gap-3 px-3 pt-1 pb-3">
          {showPhoto ? (
            <>
              <button className="btn-kid bg-violet-500 text-white" disabled={!result?.problems.length} onClick={() => askTutor("hint")}>
                💡 {s.hint}
              </button>
              <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" onClick={() => { touch(); setCameraOn(true); setHelpShow("camera"); }}>
                📷 {s.newPhoto}
              </button>
            </>
          ) : (
            <>
              <button className="btn-kid col-span-2 bg-sun py-4 text-2xl text-slate-900" disabled={!cam.ready || busy.current} onClick={() => runGrade(cam.captureHighRes)}>
                ✅ {s.checkWork}
              </button>
              <button className="btn-small col-span-2 bg-slate-100 text-slate-600" onClick={() => setCameraOn(false)}>
                {s.cameraOff}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  const settingsBody = (
        <div className="mt-3 flex flex-col gap-3">
          <p>
            session <code>{sessionId}</code> · {mode}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!isNativeApp && phoneCam && (
              <select value={source} onChange={(e) => setSource(e.target.value as Source)} className="rounded-lg bg-slate-100 px-3 py-2">
                <option value="webcam">Webcam</option>
                <option value="remote">Phone camera</option>
              </select>
            )}
            <button className="btn-small bg-slate-100" onClick={newSession}>
              {s.newSession}
            </button>
            <button className="btn-small bg-slate-100" onClick={() => setShowReport(true)}>
              {s.report}
            </button>
            <button className="btn-small bg-violet-100 text-violet-800" onClick={startDemo}>
              🎬 {s.demoSheet}
            </button>
            <button className="btn-small bg-rose-50 text-rose-700" onClick={deleteSessionData}>
              🗑 {s.deleteData}
            </button>
          </div>
          {isNativeApp && <ServerSetting />}
          <SavedProgress
            s={s}
            saving={!!profileId}
            busy={profileBusy}
            error={profileError}
            onSave={saveProgress}
            onDelete={deleteSavedProgress}
          />
          <p className="text-xs text-slate-500">
            Data: without saved progress, everything stays in this server's memory for this session only. No photos or audio
            are stored. In Help mode the worksheet photo, and in Teach mode the typed or spoken explanation text, are sent to
            Google Gemini when a key is configured (none when MOCK_MODE=1). See docs/06-privacy-and-safety.md.
          </p>
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
            <input type="checkbox" checked={autoSnap} onChange={(e) => setAutoSnap(e.target.checked)} />
            Auto-snap: take the photo by itself when hands leave the page (the camera picture stays on this device until a photo is taken)
          </label>
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
                <p className="mt-2 text-xs">Other cameras can POST JPEGs to /api/frame/{sessionId}</p>
              </div>
            </div>
          )}
        </div>
  );

  // Grown-ups: language, the report and every grown-up setting in one panel (a sheet on phones, a dialog on desktop).
  const grownupsEl = (
    <BottomSheet
      open={grownupsOpen}
      onClose={() => setGrownupsOpen(false)}
      title={`👪 ${s.grownups}`}
      closeLabel={s.close}
      variant={isPhone ? "sheet" : "dialog"}
    >
      <div className="flex flex-col gap-4 text-sm text-slate-600">
        <label className="flex items-center justify-between gap-3 text-base font-bold text-slate-700">
          {s.language}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-2xl bg-slate-50 px-3 py-3 text-base font-semibold ring-1 ring-slate-200"
          >
            {/* plain names: Windows renders flag emoji as letters */}
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </label>
        <button
          className="btn-kid bg-sky-500 text-white"
          onClick={() => { setGrownupsOpen(false); setShowReport(true); }}
        >
          📊 {s.report}
        </button>
        <div className="rounded-2xl bg-slate-50 p-3">
          <h3 className="font-bold text-slate-700">🔧 {s.settings}</h3>
          {settingsBody}
        </div>
      </div>
    </BottomSheet>
  );
  const desktopFocus = !isPhone && appMode === "teach" && lessonFocus && !showDreamPicker;

  if (isPhone) {
    const inLesson = appMode === "teach";
    const activeTab: PhoneTab | null =
      appMode === "welcome" ? "home" : appMode === "help" ? "help" : appMode === "town" ? (townStart?.story === JOURNEY_TAB ? "journey" : "town") : null;
    return (
      <MotionConfig reducedMotion="user">
        <div className="flex h-[100dvh] flex-col">
          {showDreamPicker ? (
            <main className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">{dreamPickerEl}</main>
          ) : (
          <>
          {!inLesson && (
            <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
              <button className="flex items-center gap-2 rounded-2xl" onClick={() => switchMode("welcome")} aria-label="Lumi home">
                <LumiMascot expression="default" animated={false} className="w-9" />
                <span className="text-2xl font-extrabold tracking-tight text-slate-800">Lumi</span>
              </button>
              <button
                className="btn-kid !min-h-12 bg-white !px-3 !py-2 text-base text-slate-700 ring-1 ring-slate-200"
                onClick={() => setGrownupsOpen(true)}
              >
                👪 {s.grownups}
              </button>
            </header>
          )}
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {appMode === "welcome" ? (
              <PhoneHome
                key={`${sessionId}-${language}-${teachKey}`}
                sessionId={sessionId}
                language={language}
                remembered={remembered}
                onStart={startFromHome}
                dream={dreamNow}
                onChangeDream={changeDream}
              />
            ) : appMode === "teach" || appMode === "town" ? (
              <div className={inLesson ? "h-full" : "p-3"}>{teachTownEl}</div>
            ) : (
              phoneHelpEl
            )}
          </main>
          {!inLesson && <PhoneTabBar active={activeTab} onSelect={selectTab} s={s} />}
          </>
          )}
        </div>

        {grownupsEl}

        {showReport && <ParentReport sessionId={sessionId} language={language} onClose={() => setShowReport(false)} />}
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="lumi-desktop mx-auto flex min-h-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      {/* While a lesson runs, the lesson is the whole page: no header, no mode buttons (its own back button stays). */}
      {!desktopFocus && (
      <header className="lumi-topbar flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-3 rounded-2xl" onClick={() => switchMode("welcome")} aria-label="Lumi home">
            <LumiMascot expression="default" animated={false} className="w-11" />
            <h1 className="text-left text-4xl font-extrabold tracking-tight text-slate-800">
              Lumi <span className="block text-sm font-semibold tracking-normal text-teal-600 sm:inline sm:text-lg">· {s.tagline}</span>
            </h1>
          </button>
          {dreamNow && !showDreamPicker && (
            <button
              className="btn-kid !min-h-11 bg-white !px-3 !py-1.5 text-base text-slate-700 ring-1 ring-indigo-200"
              onClick={changeDream}
              aria-label={s.changeDream}
              title={s.changeDream}
            >
              {dreamNow.emoji} {s.dreams[dreamNow.id].name}
            </button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className="btn-kid bg-white !min-h-12 !py-2 text-base text-slate-700 ring-1 ring-slate-200"
            onClick={toggleNav}
            aria-expanded={navOpen}
            aria-controls="lumi-modes"
          >
            {navOpen ? `▲ ${s.hideMenu}` : `☰ ${s.menu}`}
          </button>
          <button className="btn-kid bg-white !min-h-12 !py-2 text-base text-slate-700 ring-1 ring-slate-200" onClick={() => setGrownupsOpen(true)}>
            👪 {s.grownups}
          </button>
        </div>
      </header>
      )}
      {/* The mode buttons live in their own nav bar under the header; the child can hide it (remembered on this device). */}
      {!desktopFocus && navOpen && (
        <nav id="lumi-modes" className="lumi-navbar flex flex-wrap justify-center gap-3" aria-label="Mode">
          <button className={tab("teach")} onClick={() => switchMode("teach")} aria-pressed={appMode === "teach"}>
            🧑‍🏫 {s.teachTab}
          </button>
          <button className={tab("help")} onClick={() => switchMode("help")} aria-pressed={appMode === "help"}>
            🙋 {s.helpTab}
          </button>
          <button className={tab("town")} onClick={() => switchMode("town")} aria-pressed={appMode === "town"}>
            🏘️ {s.town}
          </button>
        </nav>
      )}

      {showDreamPicker ? (
        dreamPickerEl
      ) : appMode === "welcome" ? (
        <WelcomeView language={language} remembered={remembered} onTeach={() => switchMode("teach")} onHelp={() => switchMode("help")} />
      ) : appMode === "teach" || appMode === "town" ? (
        teachTownEl
      ) : (
        helpEl
      )}

      {grownupsEl}
      {showReport && <ParentReport sessionId={sessionId} language={language} onClose={() => setShowReport(false)} />}
    </div>
    </MotionConfig>
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
