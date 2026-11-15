import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { teachConcepts, type Language, type TeachConceptInfo } from "../../api";
import { CONCEPT_EMOJI, t, type TeachConcept } from "../../i18n";
import "./study-town.css";

const HOUSES = [
  { id: "math", x: 180, icon: "🧮" },
  { id: "english", x: 560, icon: "📚" },
  { id: "biology", x: 940, icon: "🌱" },
] as const;
type House = (typeof HOUSES)[number];

const COPY = {
  en: {
    street: "Study Town", guide: "Walk along the road. Tap a house to visit.",
    left: "Walk left", right: "Walk right", close: "Close", later: "Coming later",
    pick: "What will you teach Lumi?", loading: "Opening the lesson book…",
    math: "Math", english: "English", biology: "Biology", addition: "Addition with carrying", multiplication: "Multiplication",
    reading: "Reading", words: "Words", plants: "Plants", animals: "Animals", activities: "Things Lumi can do",
  },
  es: {
    street: "Pueblo de estudio", guide: "Camina por el sendero. Toca una casa para entrar.",
    left: "Camina a la izquierda", right: "Camina a la derecha", close: "Cerrar", later: "Más adelante",
    pick: "¿Qué le enseñarás a Lumi?", loading: "Abriendo el libro de lecciones…",
    math: "Matemáticas", english: "Inglés", biology: "Biología", addition: "Sumar llevando", multiplication: "Multiplicación",
    reading: "Lectura", words: "Palabras", plants: "Plantas", animals: "Animales", activities: "Lo que Lumi puede hacer",
  },
  vi: {
    street: "Thị trấn học tập", guide: "Đi dọc theo đường. Chạm vào một ngôi nhà để ghé thăm.",
    left: "Đi sang trái", right: "Đi sang phải", close: "Đóng", later: "Sắp có",
    pick: "Con sẽ dạy Lumi điều gì?", loading: "Đang mở sách bài học…",
    math: "Toán", english: "Tiếng Anh", biology: "Sinh học", addition: "Phép cộng có nhớ", multiplication: "Phép nhân",
    reading: "Đọc", words: "Từ vựng", plants: "Cây cối", animals: "Động vật", activities: "Những điều Lumi làm được",
  },
};

export const townCopy = (language: Language) => COPY[language];
const WORLD_WIDTH = 1140;
const WORLD_HEIGHT = 388;
const ROAD_Y = 320;
const START_X = 116;
const FRAME_ORDER = [0, 1, 2, 1];
const WALK_KEYS = { ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1 } as const;
const FENCES = [[0, 90], [270, 200], [650, 200], [1030, 110]] as const;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const keyName = (key: string) => key.length === 1 ? key.toLowerCase() : key;

interface Props {
  sessionId: string;
  language: Language;
  onLearn: (concept: TeachConceptInfo) => void;
}

export default function StudyTown({ sessionId, language, onLearn }: Props) {
  const copy = townCopy(language);
  const strings = t(language);
  const [selected, setSelected] = useState<House | null>(null);
  const [menu, setMenu] = useState<TeachConceptInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLDivElement>(null);
  const chooser = useRef<HTMLElement>(null);
  const houseOpener = useRef<HTMLButtonElement | null>(null);
  const camera = useRef({ scale: 1, x: 0 });
  const walker = useRef({ x: START_X, facing: 0, target: null as number | null, walkTime: 0 });
  const inputs = useRef(new Map<string, -1 | 1>());
  const mathOpen = selected?.id === "math";

  useEffect(() => {
    if (!mathOpen) return;
    let active = true;
    setFailed(false);
    teachConcepts(sessionId, language).then(
      (concepts) => { if (active) setMenu(concepts); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [mathOpen, sessionId, language, retry]);

  useEffect(() => {
    if (selected) {
      chooser.current?.focus({ preventScroll: true });
      chooser.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  useEffect(() => {
    const view = viewport.current!;
    const map = world.current!;
    const avatar = sprite.current!;
    const actor = walker.current;
    const heldKeys = inputs.current;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let last = 0;
    let raf = 0;
    const measure = () => {
      width = view.clientWidth;
      height = view.clientHeight;
      camera.current.scale = Math.max(width < 600 ? 1.05 : 1.42, width / WORLD_WIDTH, height / WORLD_HEIGHT);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    measure();

    const draw = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now;
      const held = new Set(heldKeys.values());
      const direction = Number(held.has(1)) - Number(held.has(-1));
      const distance = actor.target === null ? 0 : actor.target - actor.x;
      const step = direction ? direction * dt * 180 : Math.sign(distance) * Math.min(Math.abs(distance), dt * 255);
      const x = clamp(actor.x + step, 22, WORLD_WIDTH - 22);
      const walking = x !== actor.x;
      if (walking) actor.facing = Math.sign(x - actor.x);
      actor.x = x;
      if (actor.target !== null && Math.abs(actor.target - x) < .1) actor.target = null;
      actor.walkTime = walking ? actor.walkTime + dt : 0;
      const column = walking && !motion.matches ? FRAME_ORDER[Math.floor(actor.walkTime * 8) % FRAME_ORDER.length] : 1;
      const { scale } = camera.current;
      const cameraX = clamp(width * .48 - x * scale, Math.min(0, width - WORLD_WIDTH * scale), 0);
      const cameraY = clamp(height * .73 - ROAD_Y * scale, Math.min(0, height - WORLD_HEIGHT * scale), 0);
      camera.current.x = cameraX;
      map.style.transform = `translate(${cameraX}px, ${cameraY}px) scale(${scale})`;
      avatar.style.left = `${x}px`;
      avatar.dataset.facing = actor.facing === 0 ? "front" : actor.facing < 0 ? "left" : "right";
      avatar.style.setProperty("--frame", `${column * 50}%`);
      raf = requestAnimationFrame(draw);
    };
    const keyDown = (event: KeyboardEvent) => {
      const key = keyName(event.key);
      const direction = WALK_KEYS[key as keyof typeof WALK_KEYS];
      const target = event.target as Node;
      if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
      if (target !== document.body && !view.contains(target)) return;
      event.preventDefault();
      actor.target = null;
      heldKeys.set(key, direction);
    };
    const keyUp = (event: KeyboardEvent) => { heldKeys.delete(keyName(event.key)); };
    const stop = () => { heldKeys.clear(); };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", stop);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", stop);
    };
  }, []);

  const go = (x: number) => {
    inputs.current.clear();
    walker.current.target = clamp(x, 22, WORLD_WIDTH - 22);
  };

  const open = (house: House, button: HTMLButtonElement) => {
    houseOpener.current = button;
    go(house.x);
    setSelected(house);
  };

  const close = () => {
    setSelected(null);
    const button = houseOpener.current;
    if (button?.classList.contains("study-town__house")) viewport.current?.focus({ preventScroll: true });
    else button?.focus();
  };

  const pointOnRoad = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.focus({ preventScroll: true });
    go((event.clientX - bounds.left - camera.current.x) / camera.current.scale);
  };

  return (
    <section className="study-town" aria-label={copy.street}>
      <p id="study-town-guide" className="study-town__guide">{copy.guide}</p>
      <div className="study-town__view" ref={viewport} tabIndex={0} aria-label={copy.street} aria-describedby="study-town-guide"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) inputs.current.clear(); }}
        onPointerDown={pointOnRoad}
      >
        <div className="study-town__world" ref={world}>
          {FENCES.map(([left, width]) => <div key={left} className="study-town__fence" style={{ left, width }} aria-hidden />)}
          <div className="study-town__fence study-town__fence--front" aria-hidden />
          {HOUSES.map((house) => (
            <button key={house.id} className="study-town__house" style={{ left: house.x }} type="button" tabIndex={-1}
              aria-expanded={selected?.id === house.id} aria-controls={selected?.id === house.id ? "study-town-lessons" : undefined}
              onClick={(event) => open(house, event.currentTarget)}
            >
              <span className="study-town__sign"><span aria-hidden>{house.icon}</span> {copy[house.id]}</span>
            </button>
          ))}
          <div className="study-town__sprite" ref={sprite} aria-hidden />
        </div>
        <div className="study-town__controls">
          {([-1, 1] as const).map((direction) => (
            <button key={direction} type="button" aria-label={direction < 0 ? copy.left : copy.right}
              onClick={() => go((walker.current.target ?? walker.current.x) + direction * 145)}
            >{direction < 0 ? "←" : "→"}</button>
          ))}
        </div>
      </div>

      <div className="study-town__doors">
        {HOUSES.map((house) => (
          <button key={house.id} type="button" className="btn-kid study-town__door"
            aria-expanded={selected?.id === house.id} aria-controls={selected?.id === house.id ? "study-town-lessons" : undefined}
            onClick={(event) => open(house, event.currentTarget)}
          ><span aria-hidden>{house.icon}</span> {copy[house.id]}</button>
        ))}
      </div>

      {selected && (
        <section id="study-town-lessons" className="card study-town__chooser" ref={chooser} tabIndex={-1}
          aria-labelledby="study-town-chooser-title"
          onKeyDown={(event) => { if (event.key === "Escape") close(); }}
        >
          <div className="study-town__chooser-heading">
            <h3 id="study-town-chooser-title"><span aria-hidden>{selected.icon}</span> {copy[selected.id]}</h3>
            <button className="btn-kid study-town__door" type="button" onClick={close}>{copy.close}</button>
          </div>
          {mathOpen ? (
            <>
              <p>{copy.pick}</p>
              {failed ? (
                <div role="alert" className="study-town__chooser-heading">
                  <span>{strings.oopsError}</span>
                  <button type="button" className="btn-kid study-town__door" onClick={() => setRetry((count) => count + 1)}>{strings.tryAgain}</button>
                </div>
              ) : !menu ? <p role="status">{copy.loading}</p> : (
                <div className="study-town__skills">
                  {menu.map((concept) => (
                    <button className="btn-kid study-town__door" type="button" key={concept.concept} onClick={() => onLearn(concept)}>
                      <span aria-hidden>{CONCEPT_EMOJI[concept.concept as TeachConcept]}</span>{" "}
                      {concept.concept === "carry" ? copy.addition : concept.concept === "mul" ? copy.multiplication : concept.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p>{copy.later}</p>
              <ul className="study-town__skills">
                {(selected.id === "english" ? [copy.reading, copy.words] : [copy.plants, copy.animals]).map((topic) => (
                  <li key={topic} className="study-town__planned">{topic}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </section>
  );
}
