import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const IDLE_MS = 5_000;

/** A disclosure that closes after the child stops interacting with it. */
export default function IdleDisclosure({ label, className, trigger, children }: {
  label: string;
  className: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const timer = useRef<number>(undefined);

  const close = () => {
    const element = details.current;
    if (!element?.open) return;
    if (element.contains(document.activeElement)) summary.current?.focus({ preventScroll: true });
    element.open = false;
  };

  const reset = () => {
    window.clearTimeout(timer.current);
    if (details.current?.open) timer.current = window.setTimeout(close, IDLE_MS);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <details ref={details} className={className} onToggle={reset} onPointerMove={reset} onPointerDown={reset}
      onFocus={reset} onKeyDown={(event) => {
        if (event.key === "Escape" && details.current?.open) {
          event.preventDefault();
          close();
        } else reset();
      }}
    >
      <summary ref={summary} aria-label={label}>{trigger}</summary>
      {children(close)}
    </details>
  );
}
