import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "../api";

export const LANG_TAGS: Record<Language, string> = { en: "en-US", es: "es-ES", vi: "vi-VN" };

// Minimal typings for the (Chrome-prefixed) Web Speech recognition API.
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** TTS (speechSynthesis) + STT (SpeechRecognition) with a language-matched voice. */
export function useSpeech(language: Language) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const phraseRec = useRef<Recognition | null>(null);

  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window) || !text) return resolve();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const tag = LANG_TAGS[language];
        u.lang = tag;
        const pool = voices.filter((v) => v.lang.replace("_", "-").startsWith(tag.slice(0, 2)));
        u.voice = pool.find((v) => /female|zira|samantha|google/i.test(v.name)) ?? pool[0] ?? null;
        u.rate = 0.95;
        u.pitch = 1.25;
        const done = () => {
          setSpeaking(false);
          resolve();
        };
        u.onend = done;
        u.onerror = done;
        setSpeaking(true);
        speechSynthesis.speak(u);
        // Safety net: some browsers never fire onend.
        window.setTimeout(done, 1500 + text.length * 90);
      }),
    [language, voices],
  );

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  /** One-shot listen: resolves with the final transcript ("" on silence / unsupported). */
  const listen = useCallback(
    () =>
      new Promise<string>((resolve) => {
        const Ctor = getRecognition();
        if (!Ctor) return resolve("");
        const rec = new Ctor();
        rec.lang = LANG_TAGS[language];
        rec.interimResults = false;
        rec.continuous = false;
        let text = "";
        rec.onresult = (e) => (text = Array.from(e.results).map((r) => r[0].transcript).join(" "));
        rec.onerror = () => {};
        rec.onend = () => {
          setListening(false);
          resolve(text.trim());
        };
        setListening(true);
        rec.start();
      }),
    [language],
  );

  /** Background phrase listener for the voice fallback trigger ("check my work"). */
  const startPhraseListener = useCallback(
    (phrases: string[], onPhrase: () => void) => {
      const Ctor = getRecognition();
      if (!Ctor) return () => {};
      let stopped = false;
      const rec = new Ctor();
      phraseRec.current = rec;
      rec.lang = LANG_TAGS[language];
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript.toLowerCase();
          if (phrases.some((p) => t.includes(p))) onPhrase();
        }
      };
      rec.onerror = () => {};
      rec.onend = () => {
        if (!stopped) window.setTimeout(() => !stopped && rec.start(), 300);
      };
      rec.start();
      return () => {
        stopped = true;
        rec.stop();
      };
    },
    [language],
  );

  return {
    speak, stopSpeaking, listen, startPhraseListener, speaking, listening,
    canListen: getRecognition() !== null,
  };
}
