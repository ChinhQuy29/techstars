import { motion } from "framer-motion";
import type { Language } from "../api";
import LumiMascot from "../components/mascot/LumiMascot";
import { t } from "../i18n";

/** First screen: who Lumi is and what the child can do. Teach Lumi is the main path. */
export default function WelcomeView({ language, onTeach, onHelp, remembered = 0 }: {
  language: Language;
  onTeach: () => void;
  onHelp: () => void;
  /** Skills taught on earlier days (saved progress). */
  remembered?: number;
}) {
  const s = t(language);
  return (
    <section className="lumi-welcome">
      <img
        className="lumi-welcome-brand"
        src="/assets/figma-new/wordmark.webp"
        alt=""
        width={555}
        height={800}
      />
      <div className="lumi-welcome-content">
        <LumiMascot expression="default" pose="threeQuarter" wave label={s.welcomeHi} className="lumi-welcome-mascot" />
        <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="lumi-welcome-title">
          {s.welcomeHi}
        </motion.h2>
        {remembered > 0 ? (
          <p className="rounded-2xl bg-teal-50 px-4 py-2 text-xl font-bold text-teal-800 ring-1 ring-teal-200">
            👋 {remembered === 1 ? s.welcomeBackOne : s.welcomeBack.replace("{n}", String(remembered))}
          </p>
        ) : (
          <p className="text-xl leading-snug text-slate-600">{s.welcomePremise}</p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button className="btn-kid lumi-primary px-8 text-xl" onClick={onTeach}>
            🧑‍🏫 {s.welcomeTeach}
          </button>
          <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" onClick={onHelp}>
            🙋 {s.welcomeHelp}
          </button>
        </div>
      </div>
    </section>
  );
}
