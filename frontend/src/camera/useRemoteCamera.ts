import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { BACKEND } from "../api";
import { connectSocket } from "./socket";
import { canvasToBlob, dataUrlToBlob, type CameraSource } from "./types";

/**
 * Phone / ESP32 frames relayed through the backend over Socket.IO.
 * Preview frames are painted into a canvas; captures ask the camera for a high-res still,
 * then fall back to the ESP32 /capture pull, then to the latest preview frame.
 */
export function useRemoteCamera(sessionId: string, enabled: boolean): CameraSource & { connected: boolean } {
  const [canvas] = useState(() => document.createElement("canvas"));
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pendingCapture = useRef<((dataUrl: string) => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket(sessionId, "viewer");
    socketRef.current = socket;
    const img = new Image();
    let busy = false;
    socket.on("frame", ({ image }: { image: string }) => {
      if (busy) return; // drop frames rather than queue
      busy = true;
      img.onload = () => {
        if (canvas.width !== img.width) canvas.width = img.width;
        if (canvas.height !== img.height) canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        setReady(true);
        setConnected(true);
        busy = false;
      };
      img.onerror = () => (busy = false);
      img.src = image;
    });
    socket.on("capture", ({ image }: { image: string }) => {
      pendingCapture.current?.(image);
      pendingCapture.current = null;
    });
    socket.on("camera_status", ({ connected }: { connected: boolean }) => setConnected(connected));
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setReady(false);
      setConnected(false);
    };
  }, [enabled, sessionId, canvas]);

  const captureHighRes = useCallback(async (): Promise<Blob> => {
    const viaSocket = new Promise<string | null>((resolve) => {
      pendingCapture.current = resolve;
      socketRef.current?.emit("capture_request", {});
      setTimeout(() => resolve(null), 3000);
    });
    const dataUrl = await viaSocket;
    if (dataUrl) return dataUrlToBlob(dataUrl);
    return canvasToBlob(canvas); // no high-res reply in time: use the latest preview frame
  }, [canvas]);

  return { element: ready ? canvas : null, ready, error: null, captureHighRes, connected };
}
