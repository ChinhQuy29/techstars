import { io, type Socket } from "socket.io-client";
import { BACKEND } from "../api";

export function connectSocket(sessionId: string, role: "camera" | "viewer"): Socket {
  const socket = io(BACKEND || undefined, { transports: ["websocket", "polling"] });
  socket.on("connect", () => socket.emit("join", { session_id: sessionId, role }));
  return socket;
}
