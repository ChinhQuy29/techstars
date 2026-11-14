import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import MascotGallery from "./components/mascot/MascotGallery";
import AdminPortal from "./views/AdminPortal";
import PhoneCamera from "./views/PhoneCamera";
import { isNativeApp } from "./platform";

// The phone opens /?phone=<session_id> via the QR code. /?mascot=gallery shows the mascot design sheet.
// /?admin=1 is the developer admin portal (needs the backend's LUMI_ADMIN=1; never inside the Android app).
const params = new URLSearchParams(location.search);
const phoneSession = params.get("phone");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {phoneSession ? (
      <PhoneCamera sessionId={phoneSession} />
    ) : params.get("mascot") === "gallery" ? (
      <MascotGallery />
    ) : params.get("admin") === "1" && !isNativeApp ? (
      <AdminPortal />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
