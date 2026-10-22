import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import PhoneCamera from "./views/PhoneCamera";

// The phone opens /?phone=<session_id> via the QR code.
const phoneSession = new URLSearchParams(location.search).get("phone");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{phoneSession ? <PhoneCamera sessionId={phoneSession} /> : <App />}</React.StrictMode>,
);
