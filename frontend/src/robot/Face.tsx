import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Emotion } from "../api";
import { EXPRESSIONS } from "./emotions";

interface Props {
  emotion: Emotion;
  talking: boolean;
}

/** SVG robot-lamp face. Emotion → expression; idle blinking + looking around; mouth flaps while talking. */
export default function Face({ emotion, talking }: Props) {
  const ex = EXPRESSIONS[emotion];
  const [blink, setBlink] = useState(false);
  const [glance, setGlance] = useState<[number, number]>([0, 0]);
  const [mouthOpen, setMouthOpen] = useState(false);

  // Blink every 2.5–5.5 s (not while asleep).
  useEffect(() => {
    if (emotion === "sleeping") return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        loop();
      }, 2500 + Math.random() * 3000);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [emotion]);

  // Idle: glance around now and then.
  useEffect(() => {
    if (emotion !== "idle") return setGlance([0, 0]);
    const id = window.setInterval(() => {
      setGlance(Math.random() < 0.4 ? [0, 0] : [(Math.random() - 0.5) * 24, (Math.random() - 0.5) * 12]);
    }, 1800);
    return () => window.clearInterval(id);
  }, [emotion]);

  // Mouth flaps while TTS is speaking.
  useEffect(() => {
    if (!talking) return setMouthOpen(false);
    const id = window.setInterval(() => setMouthOpen((o) => !o), 130 + Math.random() * 60);
    return () => window.clearInterval(id);
  }, [talking]);

  const eyeY = blink ? 0.08 : ex.eyeOpen;
  const lookX = ex.look[0] + glance[0];
  const lookY = ex.look[1] + glance[1];
  const spring = { type: "spring", stiffness: 260, damping: 20 } as const;

  return (
    <motion.svg
      viewBox="0 0 400 320"
      className="w-full max-w-[460px] drop-shadow-2xl"
      animate={emotion === "celebrating" ? { y: [0, -14, 0, -8, 0], rotate: [0, -3, 3, 0] } : emotion === "sleeping" ? { y: [0, 4, 0] } : { y: 0, rotate: 0 }}
      transition={{ duration: emotion === "sleeping" ? 3 : 0.9, repeat: emotion === "sleeping" || emotion === "celebrating" ? Infinity : 0 }}
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <motion.stop offset="0%" animate={{ stopColor: ex.glow }} stopOpacity={0.55} />
          <motion.stop offset="100%" animate={{ stopColor: ex.glow }} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx="200" cy="160" rx="200" ry="160" fill="url(#glow)" />
      {/* lamp-shade head */}
      <rect x="50" y="40" width="300" height="240" rx="70" fill="#1e293b" stroke="#334155" strokeWidth="6" />
      <motion.rect x="50" y="40" width="300" height="240" rx="70" fill="none" strokeWidth="4" animate={{ stroke: ex.glow }} opacity={0.6} />

      {/* eyes */}
      {[140, 260].map((cx, i) => (
        <g key={cx}>
          <motion.g style={{ originX: `${cx}px`, originY: "130px" }} animate={{ scaleY: eyeY }} transition={{ duration: 0.09 }}>
            <ellipse cx={cx} cy={130} rx={36} ry={42} fill="#f8fafc" />
            <motion.circle
              cx={cx}
              cy={130}
              fill="#0f172a"
              animate={{ cx: cx + lookX, cy: 130 + lookY, r: emotion === "confused" && i === 1 ? ex.pupil - 4 : ex.pupil }}
              transition={spring}
            />
            <motion.circle cx={cx + 6} cy={122} r={5} fill="#fff" animate={{ cx: cx + 6 + lookX, cy: 122 + lookY }} transition={spring} />
          </motion.g>
          {/* brows */}
          <motion.rect
            x={cx - 30}
            y={72}
            width={60}
            height={9}
            rx={4.5}
            fill="#94a3b8"
            style={{ originX: `${cx}px`, originY: "76px" }}
            animate={{ y: 72 + ex.brow.y, rotate: i === 0 ? ex.brow.tilt : -ex.brow.tilt }}
            transition={spring}
          />
        </g>
      ))}

      {/* cheeks */}
      <motion.circle cx={100} cy={196} r={16} fill="#f472b6" animate={{ opacity: ["happy", "celebrating"].includes(emotion) ? 0.45 : 0 }} />
      <motion.circle cx={300} cy={196} r={16} fill="#f472b6" animate={{ opacity: ["happy", "celebrating"].includes(emotion) ? 0.45 : 0 }} />

      {/* mouth */}
      <motion.path
        fill="#0f172a"
        stroke="#f8fafc"
        strokeWidth={5}
        strokeLinejoin="round"
        animate={{ d: talking && mouthOpen ? ex.talk : ex.mouth }}
        transition={{ duration: 0.12 }}
      />

      {emotion === "sleeping" && (
        <motion.text
          x={300}
          y={60}
          fill="#94a3b8"
          fontSize={34}
          fontWeight={700}
          animate={{ opacity: [0, 1, 0], y: [70, 30, 10], x: [300, 316, 330] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          z
        </motion.text>
      )}
      {emotion === "thinking" && (
        <g>
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={170 + i * 30}
              cy={300}
              r={7}
              fill="#22d3ee"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </g>
      )}
    </motion.svg>
  );
}
