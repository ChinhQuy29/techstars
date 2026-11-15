import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { teachConcepts, type Language, type TeachConceptInfo } from "../../api";
import { t } from "../../i18n";
import ConceptPicker from "../ConceptPicker";
import "./study-town.css";

const HOUSES = [
  { id: "math", x: 322, icon: "🧮" },
  { id: "english", x: 702, icon: "📚" },
  { id: "biology", x: 1082, icon: "🌱" },
] as const;
type House = (typeof HOUSES)[number];
type Point = { x: number; y: number };

const COPY = {
  en: {
    guide: "Walk to a door to go inside.", shortcuts: "Quick access",
    directions: ["Walk up", "Walk left", "Walk down", "Walk right"], close: "Close", later: "Coming later",
    math: "Math", english: "English", biology: "Biology", topics: { english: ["Reading", "Words"], biology: ["Plants", "Animals"] },
  },
  es: {
    guide: "Camina hasta una puerta para entrar.", shortcuts: "Acceso rápido",
    directions: ["Camina hacia arriba", "Camina a la izquierda", "Camina hacia abajo", "Camina a la derecha"], close: "Cerrar", later: "Más adelante",
    math: "Matemáticas", english: "Inglés", biology: "Biología", topics: { english: ["Lectura", "Palabras"], biology: ["Plantas", "Animales"] },
  },
  vi: {
    guide: "Đi đến cửa để vào nhà.", shortcuts: "Truy cập nhanh",
    directions: ["Đi lên", "Đi sang trái", "Đi xuống", "Đi sang phải"], close: "Đóng", later: "Sắp có",
    math: "Toán", english: "Tiếng Anh", biology: "Sinh học", topics: { english: ["Đọc", "Từ vựng"], biology: ["Cây cối", "Động vật"] },
  },
};

const WORLD = { width: 1380, height: 720 };
const ROAD = { left: 22, right: WORLD.width - 22, top: 508, bottom: 624, center: 572 };
const DOOR_Y = 511;
const FRAME_ORDER = [0, 1, 2, 1];
const WALK = [
  { x: 0, y: -1, icon: "↑", name: "up" },
  { x: -1, y: 0, icon: "←", name: "left" },
  { x: 0, y: 1, icon: "↓", name: "down" },
  { x: 1, y: 0, icon: "→", name: "right" },
] as const;
type Direction = (typeof WALK)[number];
const WALK_KEYS: Record<string, Direction | undefined> = {
  arrowup: WALK[0], w: WALK[0], arrowleft: WALK[1], a: WALK[1],
  arrowdown: WALK[2], s: WALK[2], arrowright: WALK[3], d: WALK[3],
};
const FENCES = [[0, 242], [402, 220], [782, 220], [1162, 218]] as const;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const insideRoad = ({ x, y }: Point) => ({ x: clamp(x, ROAD.left, ROAD.right), y: clamp(y, ROAD.top, ROAD.bottom) });

interface Props {
  sessionId: string;
  language: Language;
  onLearn: (concept: TeachConceptInfo | null) => void;
  actions: ReactNode;
  notice?: string | null;
}

export default function StudyTown({ sessionId, language, onLearn, actions, notice }: Props) {
  const copy = COPY[language];
  const strings = t(language);
  const [selected, setSelected] = useState<House | null>(null);
  const [menu, setMenu] = useState<TeachConceptInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const camera = useRef({ scale: 1, x: 0, y: 0 });
  const walker = useRef({
    x: 250, y: ROAD.center, facing: "down", route: [] as Point[], door: null as House["id"] | null, walkTime: 0,
  });
  const inputs = useRef(new Map<string | number, Direction>());
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
    const box = dialog.current;
    if (selected && box && !box.open) box.showModal();
  }, [selected]);

  useEffect(() => {
    const view = viewport.current!;
    const map = world.current!;
    const avatar = sprite.current!;
    const actor = walker.current;
    const held = inputs.current;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let last = 0;
    let raf = 0;
    const measure = () => {
      width = view.clientWidth;
      height = view.clientHeight;
      camera.current.scale = Math.max(width / WORLD.width, height / WORLD.height, .8);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    measure();

    const draw = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now;
      let dx = 0;
      let dy = 0;
      for (const direction of held.values()) {
        dx = direction.x;
        dy = direction.y;
      }
      let stride = dt * 185;
      const target = actor.route[0];
      if (target) {
        dx = target.x - actor.x;
        dy = target.y - actor.y;
        stride = Math.min(Math.hypot(dx, dy), dt * 320);
        if (Math.hypot(dx, dy) < .2) actor.route.shift();
      }
      const distance = Math.hypot(dx, dy);
      const next = distance && !dialog.current?.open
        ? insideRoad({ x: actor.x + dx / distance * stride, y: actor.y + dy / distance * stride })
        : actor;
      const movedX = next.x - actor.x;
      const movedY = next.y - actor.y;
      const walking = Boolean(movedX || movedY);
      if (walking) {
        actor.facing = Math.abs(movedX) >= Math.abs(movedY)
          ? (movedX < 0 ? "left" : "right")
          : (movedY < 0 ? "up" : "down");
      }
      actor.x = next.x;
      actor.y = next.y;
      const door = HOUSES.find((house) => Math.abs(house.x - actor.x) < 25 && Math.abs(DOOR_Y - actor.y) < 12);
      if (door && door.id !== actor.door) {
        actor.route = [];
        actor.door = door.id;
        held.clear();
        setSelected(door);
      } else if (!door) actor.door = null;

      actor.walkTime = walking ? actor.walkTime + dt : 0;
      const frame = walking && !motion.matches ? FRAME_ORDER[Math.floor(actor.walkTime * 8) % FRAME_ORDER.length] : 1;
      const { scale } = camera.current;
      const cameraX = clamp(width * .48 - actor.x * scale, Math.min(0, width - WORLD.width * scale), 0);
      const cameraY = clamp(height * .72 - ROAD.center * scale, Math.min(0, height - WORLD.height * scale), 0);
      camera.current.x = cameraX;
      camera.current.y = cameraY;
      map.style.transform = `translate(${cameraX}px, ${cameraY}px) scale(${scale})`;
      avatar.style.left = `${actor.x}px`;
      avatar.style.top = `${actor.y}px`;
      avatar.dataset.facing = actor.facing;
      avatar.style.setProperty("--frame", `${frame * 50}%`);
      raf = requestAnimationFrame(draw);
    };
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const direction = WALK_KEYS[key];
      if (!direction || event.altKey || event.ctrlKey || event.metaKey || dialog.current?.open) return;
      if (event.target !== document.body && (!(event.target instanceof Node) || !view.contains(event.target))) return;
      event.preventDefault();
      actor.route = [];
      held.set(key, direction);
    };
    const keyUp = (event: KeyboardEvent) => { held.delete(event.key.toLowerCase()); };
    const stop = () => { held.clear(); };
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

  const go = (point: Point) => {
    inputs.current.clear();
    walker.current.route = [insideRoad(point)];
  };

  const approach = (house: House) => {
    const actor = walker.current;
    inputs.current.clear();
    if (actor.door === house.id) actor.door = null;
    actor.route = [{ x: actor.x, y: ROAD.center }, { x: house.x, y: ROAD.center }, { x: house.x, y: DOOR_Y }];
    viewport.current?.focus({ preventScroll: true });
  };

  const close = () => {
    dialog.current?.close();
    setSelected(null);
    viewport.current?.focus({ preventScroll: true });
  };

  const pointOnRoad = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, dialog")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const { scale, x, y } = camera.current;
    const point = {
      x: (event.clientX - bounds.left - event.currentTarget.clientLeft - x) / scale,
      y: (event.clientY - bounds.top - event.currentTarget.clientTop - y) / scale,
    };
    if (point.y < ROAD.top || point.y > ROAD.bottom) return;
    event.currentTarget.focus({ preventScroll: true });
    go(point);
  };

  return (
    <section className="study-town" aria-label={strings.town}>
      <div className="study-town__view" ref={viewport} tabIndex={0} aria-label={strings.town} aria-describedby="study-town-guide"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) inputs.current.clear(); }}
        onPointerDown={pointOnRoad}
      >
        <div className="study-town__world" ref={world}>
          <div className="study-town__terrain" aria-hidden />
          <div className="study-town__road" aria-hidden />
          <div className="study-town__foreground" aria-hidden />
          {FENCES.map(([left, width]) => <div key={left} className="study-town__fence" style={{ left, width }} aria-hidden />)}
          <div className="study-town__fence study-town__fence--front" aria-hidden />
          {HOUSES.map((house) => (
            <button key={house.id} className="study-town__house" style={{ left: house.x }} type="button" tabIndex={-1}
              aria-haspopup="dialog" onClick={() => approach(house)}
            >
              <span className="study-town__sign"><span aria-hidden>{house.icon}</span> {copy[house.id]}</span>
            </button>
          ))}
          <div className="study-town__sprite" ref={sprite} aria-hidden />
        </div>
        <div className="study-town__hud">
          <div className="study-town__travel">
            <p id="study-town-guide">{copy.guide}</p>
            <nav className="study-town__shortcuts" aria-label={copy.shortcuts}>
              {HOUSES.map((house) => (
                <button key={house.id} type="button" aria-haspopup="dialog" onClick={() => approach(house)}>
                  <span aria-hidden>{house.icon}</span> {copy[house.id]}
                </button>
              ))}
            </nav>
          </div>
          <div className="study-town__actions">{actions}</div>
        </div>
        {notice && <p className="study-town__notice" role="status">{notice}</p>}
        <div className="study-town__controls">
          {WALK.map((direction, index) => (
            <button key={direction.name} type="button" data-direction={direction.name} aria-label={copy.directions[index]}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                walker.current.route = [];
                inputs.current.set(event.pointerId, direction);
              }}
              onLostPointerCapture={(event) => inputs.current.delete(event.pointerId)}
              onClick={() => {
                if (dialog.current?.open) return;
                const actor = walker.current;
                go({ x: actor.x + direction.x * 30, y: actor.y + direction.y * 30 });
              }}
            >{direction.icon}</button>
          ))}
        </div>
      </div>

      <dialog className="study-town__dialog" ref={dialog} aria-labelledby="study-town-chooser-title"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        {selected && (
          <div className="study-town__chooser">
            <header>
              <h2 id="study-town-chooser-title"><span aria-hidden>{selected.icon}</span> {copy[selected.id]}</h2>
              <button className="btn-kid study-town__close" type="button" onClick={close}>✕ {copy.close}</button>
            </header>
            {selected.id === "math" ? (
              failed ? (
                <div role="alert" className="study-town__chooser-error">
                  <span>{strings.oopsError}</span>
                  <button type="button" className="btn-kid study-town__close" onClick={() => setRetry((count) => count + 1)}>{strings.tryAgain}</button>
                </div>
              ) : <ConceptPicker concepts={menu ?? []} busy={false} onPick={onLearn} onLumiPicks={() => onLearn(null)} s={strings} />
            ) : (
              <>
                <p>{copy.later}</p>
                <ul className="study-town__planned">{copy.topics[selected.id].map((topic) => <li key={topic}>{topic}</li>)}</ul>
              </>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}
