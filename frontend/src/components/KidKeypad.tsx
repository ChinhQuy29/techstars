import { useRef } from "react";
import type { AnswerKind } from "../api";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  placeholder?: string;
  /** number: 0-9 · time: 0-9 and ":" · compare: < = > */
  kind?: AnswerKind;
}

const KEYS: Record<AnswerKind, string[]> = {
  number: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"],
  time: ["1", "2", "3", "4", "5", "6", "7", "8", "9", ":", "0", "⌫"],
  compare: ["<", "=", ">", "⌫"],
};
const MAX_LEN: Record<AnswerKind, number> = { number: 6, time: 5, compare: 1 };

/** Big keypad for small fingers: digits, a clock time, or a comparison sign. */
export default function KidKeypad({ value, onChange, onSubmit, submitLabel = "✓", placeholder = "?", kind = "number" }: Props) {
  const latest = useRef(value);
  latest.current = value;
  const max = MAX_LEN[kind];
  const press = (k: string) => {
    const cur = latest.current;
    const next = k === "⌫" ? cur.slice(0, -1) : kind === "compare" ? k : cur.length < max ? cur + k : cur;
    latest.current = next; // two taps before a re-render must both count
    onChange(next);
  };
  const keys = KEYS[kind];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="font-hand grid h-16 min-w-40 place-items-center rounded-2xl border-4 border-sky-300 bg-white px-6 text-5xl text-rose-600">
        {value || <span className="text-slate-300">{placeholder}</span>}
      </div>
      <div className={`grid gap-2 ${kind === "compare" ? "grid-cols-5" : "grid-cols-3"}`}>
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className={`btn-kid h-16 w-16 !p-0 text-3xl ${k === "⌫" ? "bg-slate-200 text-slate-700" : "bg-sky-100 text-sky-900"}`}
            aria-label={k === "⌫" ? "Delete" : k === "<" ? "less than" : k === ">" ? "greater than" : k === "=" ? "equal to" : k}
          >
            {k}
          </button>
        ))}
        <button
          onClick={onSubmit}
          disabled={!value || !onSubmit}
          className="btn-kid h-16 w-16 !p-0 bg-green-500 text-3xl text-white"
          aria-label={submitLabel}
        >
          ✓
        </button>
      </div>
    </div>
  );
}
