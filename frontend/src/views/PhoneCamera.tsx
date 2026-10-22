import { useEffect, useRef, useState } from "react";
import { connectSocket } from "../camera/socket";

const PREVIEW_W = 480;
const PREVIEW_FPS = 5;

/** Page the phone opens via QR: streams low-res preview frames, answers high-res capture requests. */
export default function PhoneCamera({ sessionId }: { sessionId: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Starting camera…");
  const [sent, setSent] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    const socket = connectSocket(sessionId, "camera");
    const small = document.createElement("canvas");
    const big = document.createElement("canvas");

    const snap = (canvas: HTMLCanvasElement, width: number, quality: number) => {
      const v = video.current!;
      const scale = Math.min(1, width / v.videoWidth);
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    };

    socket.on("capture_request", () => {
      if (!video.current?.videoWidth) return;
      socket.emit("capture", { image: snap(big, 2400, 0.92) });
      setStatus("📸 Sent a high-res photo");
    });

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (s) => {
        stream = s;
        video.current!.srcObject = s;
        await video.current!.play();
        setStatus("Streaming to the lamp screen");
        timer = window.setInterval(() => {
          if (!socket.connected || !video.current?.videoWidth) return;
          socket.emit("frame", { image: snap(small, PREVIEW_W, 0.6) });
          setSent((n) => n + 1);
        }, 1000 / PREVIEW_FPS);
      })
      .catch((e: Error) => setStatus(`Camera error: ${e.message}`));
    if (!navigator.mediaDevices) setStatus("Camera needs HTTPS — open this page through the tunnel URL");

    return () => {
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      socket.disconnect();
    };
  }, [sessionId]);

  return (
    <div className="flex min-h-full flex-col items-center gap-4 bg-black p-4 text-center">
      <h1 className="text-2xl font-bold text-lamp">Homework Lamp camera</h1>
      <p className="text-slate-400">Hold the phone ~35 cm above the worksheet, pointing down.</p>
      <video ref={video} playsInline muted className="w-full max-w-md rounded-2xl border border-slate-700" />
      <p className="text-sm text-slate-300">{status}</p>
      <p className="text-xs text-slate-500">
        session {sessionId} · frames sent {sent}
      </p>
    </div>
  );
}
