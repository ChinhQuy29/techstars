import { useCallback, useEffect, useRef, useState } from "react";
import { canvasToBlob, type CameraSource } from "./types";

/** getUserMedia source. Requests a high resolution so the still is sharp enough for handwriting. */
export function useWebcam(enabled: boolean): CameraSource & { videoRef: (el: HTMLVideoElement | null) => void } {
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled || !element) return;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      ?.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "environment" },
        audio: false,
      })
      .then(async (stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        element.srcObject = stream;
        await element.play().catch(() => {});
        setReady(true);
      })
      .catch((e: Error) => setError(e.message || "Camera unavailable"));
    if (!navigator.mediaDevices) setError("Camera needs HTTPS or localhost");
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [enabled, element]);

  const captureHighRes = useCallback(async () => {
    if (!element || !element.videoWidth) throw new Error("Camera not ready");
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")!.drawImage(element, 0, 0);
    return canvasToBlob(canvas);
  }, [element]);

  return { element, ready, error, captureHighRes, videoRef: setElement };
}
