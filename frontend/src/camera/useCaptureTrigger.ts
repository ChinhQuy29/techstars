import { useCallback, useEffect, useRef, useState } from "react";
import { frameSize, type FrameElement } from "./types";

const W = 160;
const H = 120;
const PIXEL_DELTA = 28; // grayscale levels a pixel must change by to count
const MOTION_FRACTION = 0.004; // > this fraction of changed pixels between ticks = "moving"
const PAGE_FRACTION = 0.0025; // > this fraction changed vs last graded frame = "page changed"
const STILL_MS = 1500;
const TICK_MS = 150;

export interface TriggerStatus {
  hands: number | null; // null = detector unavailable
  moving: boolean;
  stillMs: number;
  pageChange: number; // fraction of pixels changed since the last grade
  armed: boolean; // a hand (or motion) was seen since the last capture
}

/**
 * Fires `onTrigger` when: a hand was seen since the last capture, AND no hands now,
 * AND the frame has been still ~1.5 s, AND the page differs from the last graded frame.
 * Runs entirely in the browser on a tiny grayscale frame — no LLM cost.
 */
export function useCaptureTrigger(opts: {
  element: FrameElement | null;
  enabled: boolean;
  detectHands: (el: FrameElement) => number | null;
  onTrigger: () => void;
  onActivity: (handsVisible: boolean) => void;
}) {
  const { element, enabled } = opts;
  const cbs = useRef(opts);
  cbs.current = opts;

  const canvas = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const prev = useRef<Uint8ClampedArray | null>(null);
  const graded = useRef<Uint8ClampedArray | null>(null);
  const stillSince = useRef<number>(performance.now());
  const armed = useRef(false);
  const [status, setStatus] = useState<TriggerStatus>({
    hands: null, moving: false, stillMs: 0, pageChange: 0, armed: false,
  });

  const gray = useCallback((el: FrameElement): Uint8ClampedArray | null => {
    const [w, h] = frameSize(el);
    if (!w || !h) return null;
    const c = canvas.current;
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(el, 0, 0, W, H);
    const rgba = ctx.getImageData(0, 0, W, H).data;
    const out = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      out[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
    }
    return out;
  }, []);

  /** Call right after capturing: the current frame becomes the "last graded page". */
  const markGraded = useCallback(() => {
    if (element) graded.current = gray(element);
    armed.current = false;
  }, [element, gray]);

  useEffect(() => {
    if (!enabled || !element) return;
    const id = window.setInterval(() => {
      const frame = gray(element);
      if (!frame) return;
      const now = performance.now();
      const diff = (a: Uint8ClampedArray | null) => {
        if (!a) return 1;
        let n = 0;
        for (let i = 0; i < frame.length; i++) if (Math.abs(frame[i] - a[i]) > PIXEL_DELTA) n++;
        return n / frame.length;
      };
      const moving = diff(prev.current) > MOTION_FRACTION;
      prev.current = frame;
      if (moving) stillSince.current = now;
      const hands = cbs.current.detectHands(element);
      const handsVisible = hands !== null ? hands > 0 : moving;
      if (handsVisible) armed.current = true;
      if (handsVisible || moving) cbs.current.onActivity(handsVisible);

      const stillMs = now - stillSince.current;
      const pageChange = diff(graded.current);
      setStatus({ hands, moving, stillMs, pageChange, armed: armed.current });

      if (armed.current && !handsVisible && stillMs >= STILL_MS && pageChange > PAGE_FRACTION) {
        armed.current = false;
        cbs.current.onTrigger();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled, element, gray]);

  return { status, markGraded };
}
