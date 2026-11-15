import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

// One origin for API + Socket.IO, so a single HTTPS tunnel (ngrok / cloudflared) serves the phone camera too.
export default defineConfig({
  base: process.env.LUMI_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/socket.io": { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
});
