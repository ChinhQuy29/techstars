import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { FrameElement } from "./types";

// Pinned to the installed @mediapipe/tasks-vision version.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/**
 * MediaPipe HandLandmarker wrapper. Returns a `detect(el)` function giving the number of hands
 * in the current frame (or null while loading / if it failed — callers fall back to motion only).
 */
export function useHandDetector() {
  const landmarker = useRef<HandLandmarker | null>(null);
  const lastTs = useRef(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        const make = (delegate: "GPU" | "CPU") =>
          HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
          });
        const lm = await make("GPU").catch(() => make("CPU"));
        if (cancelled) return lm.close();
        landmarker.current = lm;
        setStatus("ready");
      } catch (e) {
        console.warn("HandLandmarker failed to load, using motion-only trigger", e);
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      landmarker.current?.close();
      landmarker.current = null;
    };
  }, []);

  const detect = (el: FrameElement): number | null => {
    const lm = landmarker.current;
    if (!lm) return null;
    if (el instanceof HTMLVideoElement && el.readyState < 2) return null;
    const ts = Math.max(performance.now(), lastTs.current + 1);
    lastTs.current = ts;
    try {
      return lm.detectForVideo(el, ts).landmarks.length;
    } catch {
      return null;
    }
  };

  return { detect, status };
}
