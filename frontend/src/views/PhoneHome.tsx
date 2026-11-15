import { useEffect, useState } from "react";
import * as api from "../api";
import type { Language, TeachConceptInfo } from "../api";
import ConceptPicker from "../components/ConceptPicker";
import LumiMascot from "../components/mascot/LumiMascot";
import { t } from "../i18n";

/** Phone Teach Me screen, with the same skill cards as the desktop picker. */
export default function PhoneHome({ sessionId, language, remembered, onStart }: {
  sessionId: string;
  language: Language;
  remembered: number;
  onStart: (c: TeachConceptInfo | null) => void;
}) {
  const s = t(language);
  const [menu, setMenu] = useState<TeachConceptInfo[]>([]);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    api.teachConcepts(sessionId, language).then(setMenu).catch(() => setFailed(true));
  };
  useEffect(load, [sessionId, language]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-full flex-col gap-3 px-3 pt-2 pb-4">
      <LumiMascot expression="default" pose="threeQuarter" wave className="w-20 self-center" />
      {remembered > 0 && (
        <p className="text-center font-bold text-teal-800">
          👋 {remembered === 1 ? s.welcomeBackOne : s.welcomeBack.replace("{n}", String(remembered))}
        </p>
      )}
      <section className="card p-4" aria-label={s.lumisHomework}>
        {failed ? (
          <div role="alert" className="flex flex-col items-center gap-3 text-center">
            <p className="font-bold text-slate-800">😵 {s.oopsError}</p>
            <button className="btn-kid bg-white text-slate-800" onClick={load}>🔁 {s.tryAgain}</button>
          </div>
        ) : (
          <ConceptPicker concepts={menu} busy={false} onPick={onStart} onLumiPicks={() => onStart(null)} s={s} />
        )}
      </section>
    </div>
  );
}
