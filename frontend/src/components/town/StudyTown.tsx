import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { teachConcepts, type Language, type TeachConceptInfo } from "../../api";
import { publicAsset } from "../../assets";
import { useDreamArt } from "../../dream";
import { t } from "../../i18n";
import ConceptPicker from "../ConceptPicker";
import IdleDisclosure from "../IdleDisclosure";
import "./study-town.css";

const HOUSES = [
  { id: "art", x: 200, icon: "🎨", asset: "stand" },
  { id: "math", x: 580, icon: "🧮", asset: "counter" },
  { id: "english", x: 960, icon: "📚", asset: "jar" },
  { id: "biology", x: 1340, icon: "🌱", asset: "bakery" },
  { id: "astronomy", x: 1720, icon: "🔭", asset: "shrine" },
] as const;
type House = (typeof HOUSES)[number];
type Point = { x: number; y: number };

const COPY = {
  en: {
    guide: "Walk to a door to go inside.", shortcuts: "Quick access", joystick: "Drag to move Lumi",
    firstGuide: "Tap the Math house or walk to its door.",
    directions: ["Walk up", "Walk left", "Walk down", "Walk right"], close: "Close", later: "Coming later",
    math: "Math", english: "English", biology: "Biology", art: "Art", astronomy: "Astronomy",
    xp: "XP", taught: "skills taught",
    topics: { english: ["Reading", "Words"], biology: ["Plants", "Animals"], art: ["Colors", "Drawing"], astronomy: ["The Moon", "Planets"] },
  },
  es: {
    guide: "Camina hasta una puerta para entrar.", shortcuts: "Acceso rápido", joystick: "Arrastra para mover a Lumi",
    firstGuide: "Toca la casa de Matemáticas o camina hasta su puerta.",
    directions: ["Camina hacia arriba", "Camina a la izquierda", "Camina hacia abajo", "Camina a la derecha"], close: "Cerrar", later: "Más adelante",
    math: "Matemáticas", english: "Inglés", biology: "Biología", art: "Arte", astronomy: "Astronomía",
    xp: "XP", taught: "habilidades enseñadas",
    topics: { english: ["Lectura", "Palabras"], biology: ["Plantas", "Animales"], art: ["Colores", "Dibujo"], astronomy: ["La Luna", "Planetas"] },
  },
  vi: {
    guide: "Đi đến cửa để vào nhà.", shortcuts: "Truy cập nhanh", joystick: "Kéo để di chuyển Lumi",
    firstGuide: "Chạm vào nhà Toán hoặc đi đến cửa nhà.",
    directions: ["Đi lên", "Đi sang trái", "Đi xuống", "Đi sang phải"], close: "Đóng", later: "Sắp có",
    math: "Toán", english: "Tiếng Anh", biology: "Sinh học", art: "Mỹ thuật", astronomy: "Thiên văn",
    xp: "XP", taught: "kỹ năng đã dạy",
    topics: { english: ["Đọc", "Từ vựng"], biology: ["Cây cối", "Động vật"], art: ["Màu sắc", "Vẽ"], astronomy: ["Mặt Trăng", "Các hành tinh"] },
  },
};

const CAMERA_REFERENCE_HEIGHT = 640;
const WORLD = { width: 2460, height: 810 };
const GATE_X = 2210;
const ROAD = { left: 22, top: 501, bottom: 549, center: 539 };
const DOOR_Y = 511;
const XP_GOAL = 5;
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
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
function insideRoad({ x, y }: Point): Point {
  const roadY = clamp(y, ROAD.top, ROAD.bottom);
  // The Figma roadblock runs diagonally between the two shoulders.
  const rightEdge = GATE_X - 18 + (roadY - 522) * 1.75;
  return { x: clamp(x, ROAD.left, rightEdge), y: roadY };
}

interface Props {
  sessionId: string;
  language: Language;
  onLearn: (concept: TeachConceptInfo | null) => void;
  actions: ReactNode;
  notice?: string | null;
  restoredSkills: number;
  welcome?: ReactNode;
}

export default function StudyTown({ sessionId, language, onLearn, actions, notice, restoredSkills, welcome }: Props) {
  const copy = COPY[language];
  const strings = t(language);
  const dream = useDreamArt();
  const preview = Boolean(welcome);
  const [selected, setSelected] = useState<House | null>(null);
  const [visitedMath, setVisitedMath] = useState(false);
  const [menu, setMenu] = useState<TeachConceptInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLDivElement>(null);
  const joystick = useRef<HTMLDivElement>(null);
  const joystickPointer = useRef<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const camera = useRef({ scale: 1, x: 0, y: 0 });
  const walker = useRef({
    x: 650, y: ROAD.center, facing: "down", route: [] as Point[], door: null as House["id"] | null, walkTime: 0,
  });
  const inputs = useRef(new Map<string | number, Direction>());
  const taught = menu === null ? null : Math.min(XP_GOAL, menu.filter((concept) => concept.stars > 0).length);

  const resetJoystick = () => {
    const pointer = joystickPointer.current;
    if (pointer !== null) inputs.current.delete(pointer);
    joystickPointer.current = null;
    joystick.current?.style.removeProperty("--stick-x");
    joystick.current?.style.removeProperty("--stick-y");
  };

  const moveJoystick = (event: PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (bounds.left + bounds.width / 2);
    const y = event.clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(x, y);
    const reach = distance > 8 ? Math.min(1, 29 / distance) : 0;
    event.currentTarget.style.setProperty("--stick-x", `${x * reach}px`);
    event.currentTarget.style.setProperty("--stick-y", `${y * reach}px`);
    if (!reach) inputs.current.delete(event.pointerId);
    else inputs.current.set(event.pointerId, Math.abs(x) > Math.abs(y) ? WALK[x < 0 ? 1 : 3] : WALK[y < 0 ? 0 : 2]);
  };

  useEffect(() => {
    let active = true;
    setFailed(false);
    teachConcepts(sessionId, language).then(
      (concepts) => { if (active) setMenu(concepts); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [sessionId, language, restoredSkills, retry]);

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
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let last = 0;
    let raf = 0;
    const measure = () => {
      width = view.clientWidth;
      height = view.clientHeight;
      camera.current.scale = Math.max(width / WORLD.width, height / CAMERA_REFERENCE_HEIGHT, .8) * 1.12;
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
        resetJoystick();
        setSelected(door);
        if (door.id === "math") setVisitedMath(true);
      } else if (!door) actor.door = null;

      actor.walkTime = walking ? actor.walkTime + dt : 0;
      const frame = walking && !reducedMotion.matches ? FRAME_ORDER[Math.floor(actor.walkTime * 8) % FRAME_ORDER.length] : 1;
      const { scale } = camera.current;
      const cameraX = clamp(width * .5 - actor.x * scale, Math.min(0, width - WORLD.width * scale), 0);
      const cameraY = clamp(height * .55 - ROAD.center * scale, Math.min(0, height - WORLD.height * scale), 0);
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
      if (preview) return;
      const key = event.key.toLowerCase();
      const direction = WALK_KEYS[key];
      if (!direction || event.altKey || event.ctrlKey || event.metaKey || dialog.current?.open) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("details")) return;
      if (target !== document.body && !view.contains(target) && !target.closest("[data-town-tab]")) return;
      event.preventDefault();
      actor.route = [];
      held.set(key, direction);
    };
    const keyUp = (event: KeyboardEvent) => { held.delete(event.key.toLowerCase()); };
    const stop = () => { held.clear(); resetJoystick(); };
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
  }, [preview]);

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
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, dialog, details, [data-town-joystick]")) return;
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
      <div className="study-town__view" ref={viewport} tabIndex={0} inert={preview} aria-label={strings.town} aria-describedby="study-town-guide"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) inputs.current.clear(); }}
        onPointerDown={pointOnRoad}
      >
        <div className="study-town__world" ref={world}>
          <div className="study-town__terrain" aria-hidden />
          <div className="study-town__terrain study-town__terrain--extension" aria-hidden />
          <img className="study-town__gate" style={{ left: GATE_X }} src={publicAsset("assets/map_asset/roadblock.png")}
            width={128} height={112} alt="" draggable={false} />
          {HOUSES.map((house) => (
            <button key={house.id} className="study-town__house" style={{ left: house.x }} type="button"
              tabIndex={-1} data-guided={!preview && !visitedMath && house.id === "math"}
              aria-haspopup="dialog" onClick={() => approach(house)}
            >
              <img className="study-town__house-art" src={publicAsset(`assets/map_asset/${house.asset}.png`)} alt="" draggable={false} />
              <span className="study-town__sign"><span aria-hidden>{house.icon}</span> {copy[house.id]}</span>
            </button>
          ))}
          <div className="study-town__sprite" ref={sprite} data-dream={dream?.id} aria-hidden />
        </div>
        <p id="study-town-guide" className={!preview && !visitedMath ? "study-town__guide" : "sr-only"}>
          {visitedMath ? copy.guide : copy.firstGuide}
        </p>
        <IdleDisclosure className="study-town__travel" label={copy.shortcuts} trigger={
          <span className="study-town__chevron" aria-hidden="true" />
        }>
          {(closeDrawer) => (
            <nav className="study-town__shortcuts" aria-label={copy.shortcuts}>
              <p>{copy.shortcuts}</p>
              {HOUSES.map((house) => (
                <button key={house.id} type="button" aria-haspopup="dialog" onClick={() => { closeDrawer(); approach(house); }}>
                  <span aria-hidden>{house.icon}</span> {copy[house.id]}
                </button>
              ))}
            </nav>
          )}
        </IdleDisclosure>
        {actions && <div className="study-town__actions">{actions}</div>}
        <div className="study-town__footer">
          <div className="study-town__feedback">
            {notice && <p className="study-town__notice" role="status">{notice}</p>}
            <div className="study-town__xp" role="progressbar" aria-label={copy.xp}
              aria-valuemin={0} aria-valuemax={XP_GOAL} aria-valuenow={taught ?? undefined}
              aria-valuetext={taught === null ? undefined : `${taught}/${XP_GOAL} ${copy.taught}`}
            >
              <div className="study-town__xp-label"><strong>{copy.xp}</strong><span>{taught ?? "–"}/{XP_GOAL} {copy.taught}</span></div>
              <div className="study-town__xp-marks" aria-hidden>
                {Array.from({ length: XP_GOAL }, (_, index) => <span key={index} data-earned={index < (taught ?? 0)} />)}
              </div>
            </div>
          </div>
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
          <div className="study-town__joystick" data-town-joystick ref={joystick} role="group" tabIndex={0} aria-label={copy.joystick}
            onPointerDown={(event) => {
              if (event.button !== 0 || joystickPointer.current !== null || dialog.current?.open) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              walker.current.route = [];
              joystickPointer.current = event.pointerId;
              moveJoystick(event);
            }}
            onPointerMove={moveJoystick}
            onPointerUp={(event) => { if (joystickPointer.current === event.pointerId) resetJoystick(); }}
            onPointerCancel={(event) => { if (joystickPointer.current === event.pointerId) resetJoystick(); }}
            onLostPointerCapture={(event) => { if (joystickPointer.current === event.pointerId) resetJoystick(); }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="study-town__joystick-thumb" aria-hidden="true" />
          </div>
        </div>
      </div>

      <AnimatePresence onExitComplete={() => viewport.current?.focus({ preventScroll: true })}>
        {welcome && (
          <motion.div
            className="study-town__welcome"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {welcome}
          </motion.div>
        )}
      </AnimatePresence>

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
