import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import MascotGallery from "./components/mascot/MascotGallery";
import PhoneCamera from "./views/PhoneCamera";

// The phone opens /?phone=<session_id> via the QR code. /?mascot=gallery shows the mascot design sheet.
const params = new URLSearchParams(location.search);
const phoneSession = params.get("phone");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {phoneSession ? <PhoneCamera sessionId={phoneSession} /> : params.get("mascot") === "gallery" ? <MascotGallery /> : <App />}
  </React.StrictMode>,
);
