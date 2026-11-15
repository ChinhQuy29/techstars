import { motion } from "framer-motion";
import type { TeachChip } from "../api";

/** Tappable explanations: the fallback when speech recognition fails (docs/02-learning-design.md). */
export default function ExplainChips({ chips, onPick, disabled }: { chips: TeachChip[]; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="lumi-explain-choices grid w-full max-w-lg gap-2">
      {chips.map((c, i) => (
        <motion.button
          key={c.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          disabled={disabled}
          onClick={() => onPick(c.id)}
          className="btn-kid lumi-explain-choice !justify-start !text-base text-left"
        >
          💬 {c.text}
        </motion.button>
      ))}
    </div>
  );
}
