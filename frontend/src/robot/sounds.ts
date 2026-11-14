import confetti from "canvas-confetti";

// Tiny synthesized sound effects (WebAudio) — no asset files needed.
let ctx: AudioContext | null = null;
const audio = () => (ctx ??= new AudioContext());

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.15) {
  const a = audio();
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.05);
}

export const sounds = {
  shutter: () => {
    tone(1200, 0, 0.05, "square", 0.06);
    tone(800, 0.06, 0.06, "square", 0.05);
  },
  thinking: () => [440, 554, 659].forEach((f, i) => tone(f, i * 0.12, 0.18, "triangle", 0.06)),
  correct: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25, "triangle", 0.12)),
  hint: () => [392, 494].forEach((f, i) => tone(f, i * 0.12, 0.2, "sine", 0.1)),
  /** Soft, neutral blip for each mark on the phone lesson (never says right or wrong). */
  pop: () => {
    tone(660, 0, 0.07, "sine", 0.08);
    tone(990, 0.06, 0.09, "sine", 0.07);
  },
};

export function celebrate() {
  sounds.correct();
  const opts = { particleCount: 90, spread: 70, startVelocity: 45, colors: ["#facc15", "#f472b6", "#4ade80", "#38bdf8"] };
  confetti({ ...opts, origin: { x: 0.2, y: 0.7 }, angle: 60 });
  confetti({ ...opts, origin: { x: 0.8, y: 0.7 }, angle: 120 });
}
