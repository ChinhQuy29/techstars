import { motion } from "framer-motion";
import type { Language } from "../api";
import { lumiLogo } from "../assets";
import LumiMascot from "../components/mascot/LumiMascot";
import { t } from "../i18n";

/** Welcome shown over the Town map. */
export default function WelcomeView({ language, onTown, onHelp, remembered = 0 }: {
  language: Language;
  onTown: () => void;
  onHelp: () => void;
  /** Skills taught on earlier days (saved progress). */
  remembered?: number;
}) {
  const s = t(language);
  return (
    <section className="lumi-welcome">
      <img
        className="lumi-welcome-brand"
        {...lumiLogo}
        alt="Lumi"
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
          <button className="btn-kid lumi-primary px-8 text-xl" onClick={onTown}>
            🏘️ {s.town}
          </button>
          <button className="btn-kid bg-white text-slate-700 ring-2 ring-slate-200" onClick={onHelp}>
            🙋 {s.welcomeHelp}
          </button>
        </div>
      </div>
    </section>
  );
}
