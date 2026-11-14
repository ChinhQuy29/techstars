import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/** True once nobody has touched the screen for `ms` (restarts when `resetKey` changes). Nothing is stored. */
export function useIdle(ms: number, resetKey: unknown = null): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let id = window.setTimeout(() => setIdle(true), ms);
    const touch = () => {
      setIdle(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setIdle(true), ms);
    };
    setIdle(false);
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [ms, resetKey]);
  return idle;
}

/**
 * A bouncing hand that points at the next thing to tap (docs/10-mobile-ui.md). Place it inside a `relative` wrapper
 * around the target and position it with `className`; it never blocks taps. `down` (👇) sits above the target, `up`
 * (👆) below it. Use it only for a single next action, or centered between equal choices: never lean toward an answer.
 */
export function PointHand({ show, className, dir = "up" }: { show: boolean; className: string; dir?: "up" | "down" }) {
  if (!show) return null;
  return (
    <span aria-hidden className={`pointer-events-none absolute z-10 ${className}`}>
      <motion.span
        className="block text-4xl drop-shadow"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: dir === "up" ? [0, -8, 0] : [0, 8, 0] }}
        transition={{ y: { duration: 0.9, repeat: Infinity }, opacity: { duration: 0.2 } }}
      >
        {dir === "up" ? "👆" : "👇"}
      </motion.span>
    </span>
  );
}
