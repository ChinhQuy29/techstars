import type { Strings } from "../i18n";
import HoldButton from "./HoldButton";

/**
 * Grown-up consent for saved progress (docs/06-privacy-and-safety.md). Nothing is saved until a
 * grown-up holds "Save progress"; "Delete saved progress" removes it at once. Both are hold-to-confirm.
 */
export default function SavedProgress({ s, saving, busy, error, onSave, onDelete }: {
  s: Strings;
  saving: boolean;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-sky-200" aria-label={s.saveTitle}>
      <h3 className="mb-1 text-base font-extrabold text-slate-800">💾 {s.saveTitle}</h3>
      {saving ? (
        <>
          <p className="mb-3 font-semibold text-green-700">{s.savingOn}</p>
          <HoldButton label={`🗑 ${s.deleteSaved}`} holdLabel={s.holdForGrownups} disabled={busy} onConfirm={onDelete} />
        </>
      ) : (
        <>
          <p className="mb-3 text-slate-600">{s.saveBody}</p>
          <HoldButton label={s.saveButton} holdLabel={s.holdForGrownups} disabled={busy} onConfirm={onSave} />
        </>
      )}
      {error && <p role="alert" className="mt-2 text-rose-700">{error}</p>}
    </section>
  );
}
