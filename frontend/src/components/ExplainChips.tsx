import { motion } from "framer-motion";
import type { TeachChip } from "../api";

const COLORS = ["bg-amber-100 text-amber-900 ring-amber-300", "bg-violet-100 text-violet-900 ring-violet-300", "bg-teal-100 text-teal-900 ring-teal-300"];

/** Tappable explanations: the fallback when speech recognition fails (docs/02-learning-design.md). */
export default function ExplainChips({ chips, onPick, disabled }: { chips: TeachChip[]; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="grid w-full gap-2 sm:grid-cols-3">
      {chips.map((c, i) => (
        <motion.button
          key={c.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          disabled={disabled}
          onClick={() => onPick(c.id)}
          className={`btn-kid h-full !text-base ring-2 ${COLORS[i % COLORS.length]}`}
        >
          💬 {c.text}
        </motion.button>
      ))}
    </div>
  );
}
