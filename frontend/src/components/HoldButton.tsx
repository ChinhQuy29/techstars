import { useRef, useState } from "react";

const HOLD_MS = 1500;

/**
 * Adult-only action guard: the button must be held for 1.5 s (mouse, touch, or Enter/Space),
 * so a child tapping around can't trigger it by accident (docs/04-character-ui-and-art.md).
 */
export default function HoldButton({ label, holdLabel, onConfirm, disabled }: {
  label: string;
  holdLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const start = useRef(0);

  const begin = () => {
    if (disabled || timer.current !== null) return;
    start.current = performance.now();
    timer.current = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        cancel();
        onConfirm();
      }
    }, 30);
  };
  const cancel = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !e.repeat && begin()}
      onKeyUp={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className="relative overflow-hidden rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 disabled:opacity-40"
      aria-label={`${label} (${holdLabel})`}
    >
      <span className="absolute inset-y-0 left-0 bg-slate-300/70" style={{ width: `${progress * 100}%` }} aria-hidden />
      <span className="relative">
        🔒 {label} · <span className="font-normal">{holdLabel}</span>
      </span>
    </button>
  );
}
