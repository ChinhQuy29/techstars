import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";
import type { ChatTurn, Concept, Emotion, GradeResponse, Language } from "./api";
import { lumiLogo } from "./assets";
import ServerSetting from "./components/ServerSetting";
import IdleDisclosure from "./components/IdleDisclosure";
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
import TownPage, { JOURNEY_TAB, SCRAPBOOK_TAB } from "./views/TownPage";
import TutorView from "./views/TutorView";
import WelcomeView from "./views/WelcomeView";
import SavedProgress from "./components/SavedProgress";
import LumiMascot from "./components/mascot/LumiMascot";

type Phase = "SLEEPING" | "WATCHING" | "CAPTURING" | "THINKING" | "RESULT";
type Mode = "landing" | "welcome" | "teach" | "help" | "town";

const SLEEP_AFTER_MS = 60_000;

const LINES: Record<Language, Record<string, string>> = {
  en: {
    hello: "Hi, I'm Lumi! Show me your worksheet and I'll check it with you.",
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

async function fetchSample(url: string): Promise<Blob> {
  const response = await fetch(`${api.BACKEND}${url}`);
  if (!response.ok) throw new Error(`Worksheet request failed: ${response.status}`);
  return response.blob();
}

export default function App() {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [language, setLanguage] = useState<Language>("en");
  const [appMode, setAppMode] = useState<Mode>("landing");
  const [phase, setPhase] = useState<Phase>("WATCHING");
  const [emotion, setEmotion] = useState<Emotion>("idle");
  const [bubble, setBubble] = useState(LINES.en.hello);
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [mode, setMode] = useState<string>("…");
  const [samples, setSamples] = useState<{ name: string; url: string }[] | null>(null);
  const [teachKey, setTeachKey] = useState(0);
  const [teachDemo, setTeachDemo] = useState(false);
  const [townStart, setTownStart] = useState<{ concept: Concept | null; story: string | null; key: number }>({ concept: null, story: null, key: 0 });
  const [teachAlive, setTeachAlive] = useState(false); // keep the worksheet while visiting the town
  const [profileId, setProfileId] = useState<string | null>(readProfileId);
  const [remembered, setRemembered] = useState(0);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Phone layout (docs/10-mobile-ui.md)
  const isPhone = useIsPhone();
  const [lessonStart, setLessonStart] = useState<api.TeachConceptInfo | null | undefined>(undefined);
  const [grownupsOpen, setGrownupsOpen] = useState(false);
  // Desktop: a running lesson takes the whole page (TeachView reports it).
  const [lessonFocus, setLessonFocus] = useState(false);
  // Lumi's dream (docs/12-dreams.md): chosen before the first lesson; the child can change it from home.
  const [dream, chooseDream] = useDream();
  const [pickingDream, setPickingDream] = useState(false);
  const afterDream = useRef<(() => void) | null>(null);

  const busy = useRef(false);
  const lastActivity = useRef(Date.now());
  const runGradeRef = useRef<(get: () => Promise<Blob>) => void>(() => {});
  const schoolSheetAttempt = useRef<string | null>(null);

  const helping = appMode === "help";
  const speech = useSpeech(language);
  const L = LINES[language];
  const s = t(language);

  useEffect(() => {
    api.health()
      .then((h) => {
        setMode(h.mode === "mock" ? "mock mode" : h.model);
      })
      .catch(() => setMode("backend offline"));
    api.samples().then(setSamples).catch(() => setSamples([]));
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
        if (g.hand_blocking || g.unreadable) return void (await say(L.error, "confused"));
        setResult(g);
        if (!g.problems.length) return;
        setPhase("RESULT");
        setEmotion("curious");
        setBubble(s.pickWorksheetProblem);
      } catch (e) {
        console.error(e);
        await say(L.error, "confused");
      } finally {
        busy.current = false;
        lastActivity.current = Date.now();
        setPhase((p) => (p === "SLEEPING" ? p : "WATCHING"));
      }
    },
    [sessionId, L, say, speech, s.pickWorksheetProblem],
  );
  runGradeRef.current = runGrade;

  const schoolSheetUrl = samples?.[0]?.url;
  const loadingSchoolSheet = !result?.problems.length && (
    samples === null || (!!schoolSheetUrl && schoolSheetAttempt.current !== sessionId) ||
    phase === "CAPTURING" || phase === "THINKING"
  );
  const showingSchoolSheet = !!captureUrl && !!result?.problems.length;

  useEffect(() => {
    if (!helping || !schoolSheetUrl || busy.current || schoolSheetAttempt.current === sessionId) return;
    schoolSheetAttempt.current = sessionId;
    runGradeRef.current(() => fetchSample(schoolSheetUrl));
  }, [helping, schoolSheetUrl, sessionId, phase]);

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

  const touch = () => {
    lastActivity.current = Date.now();
    if (phase === "SLEEPING") setPhase("WATCHING");
  };

  const askTutor = async (action: "hint" | "chat", child_said?: string, problemId?: number | null) => {
    touch();
    setEmotion("thinking");
    try {
      const tr = await api.tutor({
        session_id: sessionId, language, action, child_said, history, worksheet_only: true,
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
    await askTutor(/hint|help|ayuda|gợi ý/i.test(heard) ? "hint" : "chat", heard);
  };

  const retrySchoolSheet = () => {
    if (schoolSheetUrl) {
      void runGrade(() => fetchSample(schoolSheetUrl));
      return;
    }
    setSamples(null);
    api.samples().then(setSamples).catch(() => setSamples([]));
  };
  const worksheetStatus = (
    <div className="card flex flex-col items-center gap-3 p-4 text-center">
      <p role="status" className="font-bold">{loadingSchoolSheet ? s.loadingHomework : s.oopsError}</p>
      {!loadingSchoolSheet && <button className="btn-kid bg-white" onClick={retrySchoolSheet}>{s.tryAgain}</button>}
    </div>
  );

  const showDreamPicker = pickingDream || (!dream && appMode === "teach");
  const townWelcome = !showDreamPicker && (appMode === "landing" || (!isPhone && appMode === "welcome"));

  const transitionMode = (m: Mode) => {
    if (m === appMode) return;
    speech.stopSpeaking();
    if (m === "town") {
      if (!townWelcome) setTownStart((t0) => ({ concept: null, story: null, key: t0.key + 1 }));
    } else if (m === "help") {
      if (!showingSchoolSheet) {
        setEmotion("idle");
        setBubble(s.pickWorksheetProblem);
      }
    } else if (!(m === "teach" && appMode === "town" && teachAlive)) {
      setTeachDemo(false);
      setLessonStart(undefined);
      setTeachKey((k) => k + 1); // fresh Teach view (and worksheet) each time the tab is opened
    }
    if (m === "teach") setTeachAlive(true);
    if (m === "help" || m === "welcome") setTeachAlive(false); // Teach unmounts there, so don't revive it hidden later
    if (m === "welcome" && !isPhone) setTownStart((t0) => ({ concept: null, story: null, key: t0.key + 1 }));
    setAppMode(m);
  };

  const withDream = (next: () => void) => {
    if (dream) next();
    else {
      speech.stopSpeaking();
      afterDream.current = next;
      setPickingDream(true);
    }
  };
  const switchMode = (m: Mode) => {
    if (m === "landing" || (m === "welcome" && !isPhone)) transitionMode(m);
    else withDream(() => transitionMode(m));
  };
  const closeDreamPicker = () => {
    afterDream.current = null;
    setPickingDream(false);
  };
  const onDream = (d: DreamId) => {
    chooseDream(d);
    if (pickingDream) {
      const next = afterDream.current;
      closeDreamPicker();
      if (next) next();
      else {
        setTeachAlive(false);
        setLessonStart(undefined);
        enterTown(null);
      }
    }
  };
  const changeDream = () => {
    speech.stopSpeaking();
    afterDream.current = null;
    setPickingDream(true);
  };
  const dreamPickerEl = <DreamPicker language={language} current={dream} onSelect={onDream}
    onBack={pickingDream ? closeDreamPicker : isPhone ? () => transitionMode("landing") : undefined} />;
  const dreamNow = dreamInfo(dream);

  const startLesson = (c: api.TeachConceptInfo | null) => {
    speech.stopSpeaking();
    setLessonStart(c);
    setTeachDemo(false);
    setTeachKey((k) => k + 1);
    setTeachAlive(true);
    setAppMode("teach");
  };

  /** Leave the lesson for Town (after "Stop this homework?"). */
  const exitLesson = () => {
    setLessonStart(undefined);
    setTeachAlive(false);
    openTown(null);
  };

  const selectTab = (tb: PhoneTab) => {
    if (tb === "teach") switchMode("welcome");
    else if (tb === "help") switchMode("help");
    else showTown();
  };

  const enterTown = (concept: Concept | null, story: string | null = null) => {
    speech.stopSpeaking();
    setTownStart((t0) => ({ concept, story, key: t0.key + 1 }));
    setAppMode("town");
  };
  const openTown = (concept: Concept | null, story: string | null = null) => withDream(() => enterTown(concept, story));

  const showingMap = appMode === "town" && !townStart.story && !townStart.concept;
  const showTown = () => {
    if (appMode === "town" && !showingMap) openTown(null);
    else switchMode("town");
  };

  // Android back button (app only): step back a screen; never throw away a lesson. From Teach or the welcome
  // screen it sends the app to the background (state kept) instead of closing it. docs/09-android-app.md.
  const backRef = useRef<() => void>(() => {});
  backRef.current = () => {
    if (grownupsOpen) setGrownupsOpen(false);
    else if (showReport) setShowReport(false);
    else if (pickingDream) closeDreamPicker();
    else if (appMode === "town") {
      if (teachAlive) switchMode("teach");
      else if (!showingMap) showTown();
      else void NativeApp.minimizeApp();
    } else if (appMode === "help" || appMode === "welcome") showTown();
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

  const isLocalhost = /localhost|127\.0\.0\.1/.test(location.hostname);

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
        {(appMode === "town" || townWelcome) && (
          <TownPage
            key={`${sessionId}-${language}-${townStart.key}`}
            sessionId={sessionId}
            language={language}
            speech={speech}
            startConcept={townStart.concept}
            startStory={townStart.story}
            onBackToHomework={() => switchMode("teach")}
            onLearn={startLesson}
            restoredSkills={remembered}
            phone={isPhone}
            showBack={teachAlive}
            welcome={townWelcome && (
              <WelcomeView language={language} remembered={remembered} onTown={() => switchMode("town")} onHelp={() => switchMode("help")} />
            )}
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
          startWith={lessonStart}
          onExit={exitLesson}
          onFocusChange={setLessonFocus}
        />
        </div>
        )}
        </>
  );

  const helpEl = showingSchoolSheet ? (
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
            <button className="btn-kid bg-violet-500 text-white" disabled={!result?.problems.length} onClick={() => askTutor("hint")}>
              💡 {s.hint}
            </button>
            {!isNativeApp && (
              <button className="btn-kid bg-sky-500 text-white" disabled={!speech.canListen || speech.listening} onClick={talk}>
                🎤 {s.talk}
              </button>
            )}
          </TutorView>
  ) : worksheetStatus;

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
        {showingSchoolSheet ? (
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
        ) : worksheetStatus}
      </div>

      {showingSchoolSheet && (
        <div className="grid shrink-0 px-3 pt-1 pb-3">
          <button className="btn-kid bg-violet-500 text-white" onClick={() => askTutor("hint")}>
            💡 {s.hint}
          </button>
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
            are stored. In Practice mode the sample worksheet, and in Teach mode the typed or spoken explanation text, are sent to
            Google Gemini when a key is configured (none when MOCK_MODE=1). See docs/06-privacy-and-safety.md.
          </p>
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
  const careerBadge = dreamNow && !showDreamPicker && (
    <span className="lumi-header-career">
      {dreamNow.emoji} {s.dreams[dreamNow.id].name}
    </span>
  );
  const townLinks = (close?: () => void) => (
    <>
      <button type="button" className="lumi-header-action" aria-label={s.scrapbook} aria-pressed={appMode === "town" && townStart.story === SCRAPBOOK_TAB}
        onClick={() => { close?.(); openTown(null, SCRAPBOOK_TAB); }}>📔 {s.scrapbookShort}</button>
      <button type="button" className="lumi-header-action" aria-label={s.journey} aria-pressed={appMode === "town" && Boolean(townStart.story && townStart.story !== SCRAPBOOK_TAB)}
        onClick={() => { close?.(); openTown(null, JOURNEY_TAB); }}>🌙 {s.journeyShort}</button>
    </>
  );
  const headerMenu = (
    <IdleDisclosure label={s.menu} className="lumi-header-menu" trigger={<span aria-hidden="true">☰</span>}>
      {(close) => (
        <div className="lumi-header-menu-panel">
          {isPhone && townLinks(close)}
          {!showDreamPicker && (
            <button type="button" className="lumi-header-action" onClick={() => { close(); changeDream(); }}>
              ✨ {dreamNow ? s.changeDream : s.chooseDream}
            </button>
          )}
          <button type="button" className="lumi-header-action" onClick={() => { close(); setGrownupsOpen(true); }}>👪 {s.grownups}</button>
        </div>
      )}
    </IdleDisclosure>
  );

  if (isPhone) {
    const inLesson = appMode === "teach";
    const activeTab: PhoneTab | null =
      appMode === "welcome" ? "teach" : appMode === "help" ? "help" : showingMap ? "town" : null;
    return (
      <MotionConfig reducedMotion="user">
        <div className="flex h-[100dvh] flex-col">
          {showDreamPicker ? (
            <main className="min-h-0 flex-1 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">{dreamPickerEl}</main>
          ) : (
          <>
          {!inLesson && (
            <header className="lumi-phone-header shrink-0 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <div className="flex min-w-0 items-center gap-2.5">
                <button className="flex items-center gap-2 rounded-2xl" onClick={showTown} aria-label={s.town}>
                  <LumiMascot expression="default" animated={false} className="w-9 shrink-0" />
                  <img {...lumiLogo} alt="" className="h-auto w-[4.25rem] -translate-y-1" />
                </button>
                {careerBadge}
              </div>
              {headerMenu}
            </header>
          )}
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {appMode === "welcome" ? (
              <PhoneHome
                key={`${sessionId}-${language}-${teachKey}`}
                sessionId={sessionId}
                language={language}
                remembered={remembered}
                onStart={startLesson}
              />
            ) : appMode === "teach" || appMode === "town" || townWelcome ? (
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
    <div className="lumi-desktop mx-auto flex min-h-full w-full flex-col gap-5 p-4 sm:p-6">
      {/* While a lesson runs, the lesson is the whole page: no header, no mode buttons (its own back button stays). */}
      {!desktopFocus && (
      <header className="lumi-topbar">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2.5 rounded-2xl" onClick={showTown} aria-label={s.town}>
            <LumiMascot expression="default" animated={false} className="w-11 shrink-0" />
            <img {...lumiLogo} alt="" className="h-auto w-20 shrink-0 -translate-y-1" />
            <h1 className="sr-only">
              <span className="sr-only">Lumi · </span>{s.tagline}
            </h1>
          </button>
          {careerBadge}
        </div>
        <nav id="lumi-modes" className="lumi-header-modes" aria-label="Mode">
          <button className="lumi-header-action" onClick={showTown} aria-pressed={showingMap} data-town-tab>
            🏘️ {s.town}
          </button>
          <button className="lumi-header-action" onClick={() => switchMode("teach")} aria-pressed={appMode === "teach"}>
            🧑‍🏫 {s.teachTab}
          </button>
          <button className="lumi-header-action" onClick={() => switchMode("help")} aria-pressed={appMode === "help"}>
            🙋 {s.helpTab}
          </button>
        </nav>
        <div className="flex items-center justify-end gap-3">
          <nav className="lumi-header-links" aria-label={s.town}>{townLinks()}</nav>
          {headerMenu}
        </div>
      </header>
      )}

      <main className={`mx-auto flex w-full flex-col gap-5 ${appMode === "town" || townWelcome ? "" : "max-w-7xl"}`}>
      {showDreamPicker ? (
        dreamPickerEl
      ) : appMode === "teach" || appMode === "town" || townWelcome ? (
        teachTownEl
      ) : (
        helpEl
      )}

      </main>

      {grownupsEl}
      {showReport && <ParentReport sessionId={sessionId} language={language} onClose={() => setShowReport(false)} />}
    </div>
    </MotionConfig>
  );
}
