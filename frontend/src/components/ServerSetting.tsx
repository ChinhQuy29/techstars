import { useState } from "react";
import { BACKEND, DEFAULT_BACKEND, setBackend } from "../api";

/**
 * Grown-up setting, Android app only: which Lumi server the app talks to.
 * Default is the address baked into the build (the cloud server); the laptop fallback is
 * http://<laptop-ip>:8000 on the same Wi-Fi. Saving reloads the app so a fresh session starts. See docs/09-android-app.md.
 */
export default function ServerSetting() {
  const [value, setValue] = useState(BACKEND);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Checks the address without saving it. */
  const test = async (url: string) => {
    setBusy(true);
    setStatus("Checking…");
    try {
      const r = await fetch(`${url.trim().replace(/\/$/, "")}/api/health`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(String(r.status));
      const h: { mode: string; model: string } = await r.json();
      setStatus(`✅ Connected (${h.mode === "mock" ? "mock mode" : h.model})`);
      return true;
    } catch {
      setStatus("❌ Can't reach that server. Check the address and that the phone is on the same Wi-Fi.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (url: string) => {
    if (!(await test(url))) return;
    setBackend(url);
    window.setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
      <label className="font-bold text-slate-700" htmlFor="lumi-server">
        🌐 Lumi server
      </label>
      <input
        id="lumi-server"
        className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="http://192.168.1.20:8000"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-2">
        <button className="btn-small bg-slate-100" disabled={busy} onClick={() => test(value)}>
          Test connection
        </button>
        <button className="btn-small bg-violet-100 text-violet-800" disabled={busy || !value.trim()} onClick={() => save(value)}>
          Save and restart
        </button>
        {DEFAULT_BACKEND && value !== DEFAULT_BACKEND && (
          <button
            className="btn-small bg-slate-100"
            disabled={busy}
            onClick={() => {
              setValue(DEFAULT_BACKEND);
              setBackend(null);
              window.location.reload();
            }}
          >
            Use default
          </button>
        )}
      </div>
      {status && <p className="text-xs">{status}</p>}
      <p className="text-xs text-slate-500">
        Default: {DEFAULT_BACKEND || "none set"}. Laptop fallback: run the backend on the laptop and enter its Wi-Fi address with port
        8000.
      </p>
    </div>
  );
}
