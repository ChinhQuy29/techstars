import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A panel for the Grown-ups area and the "stop lesson?" question: slides up from the bottom on phones, or opens as a
 * centred dialog on desktop (`variant="dialog"`).
 */
export default function BottomSheet({ open, onClose, title, children, closeLabel, variant = "sheet" }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel: string;
  variant?: "sheet" | "dialog";
}) {
  const dialog = variant === "dialog";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 flex flex-col ${dialog ? "items-center justify-center p-4" : "justify-end"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button aria-label={closeLabel} className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40 }}
            animate={{ y: 0 }}
            exit={{ y: 40 }}
            transition={{ duration: 0.2 }}
            className={dialog
              ? "relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white px-6 pt-5 pb-6 shadow-2xl"
              : "relative max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"}
          >
            {!dialog && <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-200" aria-hidden />}
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold text-slate-800">{title}</h2>
              <button className="btn-small bg-slate-100 text-slate-700" onClick={onClose}>
                ✕ {closeLabel}
              </button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
