import type { Strings } from "../../i18n";

export type PhoneTab = "home" | "help" | "town";

/** Phone bottom tab bar (docs/10-mobile-ui.md). */
export default function PhoneTabBar({ active, onSelect, s }: { active: PhoneTab | null; onSelect: (t: PhoneTab) => void; s: Strings }) {
  const tabs: { id: PhoneTab; emoji: string; label: string; on: string }[] = [
    { id: "town", emoji: "🏘️", label: s.townShort, on: "bg-teal-100 text-teal-800 ring-teal-300" },
    { id: "home", emoji: "🧑‍🏫", label: s.teachMe, on: "bg-violet-100 text-violet-800 ring-violet-300" },
    { id: "help", emoji: "🙋", label: s.helpTab, on: "bg-sky-100 text-sky-800 ring-sky-300" },
  ];
  return (
    <nav
      aria-label="Main"
      className="grid shrink-0 grid-cols-3 gap-1 border-t border-slate-200 bg-white/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-extrabold transition active:scale-95 ${
              on ? `ring-2 ${t.on}` : "text-slate-500"
            }`}
          >
            <span className={`text-2xl leading-none ${on ? "" : "opacity-80"}`} aria-hidden>{t.emoji}</span>
            <span className="mt-0.5 leading-tight">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
