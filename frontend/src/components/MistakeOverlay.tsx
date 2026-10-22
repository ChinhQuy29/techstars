import { useEffect, useRef } from "react";
import type { BBox, GradedProblem } from "../api";

interface Props {
  imageUrl: string;
  problems: GradedProblem[];
  focusId: number | null;
  onSelect?: (id: number) => void;
}

/** Converts a Gemini [ymin, xmin, ymax, xmax] 0-1000 box to pixel rect for a w×h canvas. */
function toRect(b: BBox, w: number, h: number) {
  const [ymin, xmin, ymax, xmax] = b;
  return { x: (xmin / 1000) * w, y: (ymin / 1000) * h, w: ((xmax - xmin) / 1000) * w, h: ((ymax - ymin) / 1000) * h };
}

/** Hand-drawn-looking ellipse, animated as if a teacher's pen circles the mistake. */
function wobblyEllipse(ctx: CanvasRenderingContext2D, r: ReturnType<typeof toRect>, progress: number, seed: number) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rx = r.w / 2 + 12;
  const ry = r.h / 2 + 10;
  const turns = 1.15 * progress;
  ctx.beginPath();
  for (let t = 0; t <= turns * Math.PI * 2; t += 0.05) {
    const wob = 1 + 0.04 * Math.sin(t * 3 + seed) + 0.025 * t;
    const x = cx + rx * wob * Math.cos(t - 2.2);
    const y = cy + ry * wob * Math.sin(t - 2.2);
    t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function check(ctx: CanvasRenderingContext2D, r: ReturnType<typeof toRect>) {
  const s = Math.min(r.h, 40);
  const x = r.x + r.w + 8;
  const y = r.y + r.h / 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s * 0.35, y + s * 0.35);
  ctx.lineTo(x + s, y - s * 0.5);
  ctx.stroke();
}

export default function MistakeOverlay({ imageUrl, problems, focusId, onSelect }: Props) {
  const img = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = img.current;
    const c = canvas.current;
    if (!el || !c) return;
    let raf = 0;
    const draw = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      const ctx = c.getContext("2d")!;
      const start = performance.now();
      cancelAnimationFrame(raf);
      const frame = (now: number) => {
        const p = Math.min(1, (now - start) / 700);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        problems.forEach((pr, i) => {
          if (!pr.answered) return;
          const box = pr.answer_bbox ?? pr.bbox;
          if (pr.needs_confirmation) {
            ctx.setLineDash([8, 8]);
            ctx.strokeStyle = "#a78bfa";
            ctx.lineWidth = 4;
            wobblyEllipse(ctx, toRect(box, w, h), p, i);
            ctx.setLineDash([]);
          } else if (pr.is_correct) {
            ctx.strokeStyle = "#16a34a";
            ctx.lineWidth = 5;
            check(ctx, toRect(box, w, h));
          } else {
            const focused = focusId === null || focusId === pr.id;
            ctx.strokeStyle = focused ? "#ef4444" : "rgba(239,68,68,0.45)";
            ctx.lineWidth = focused ? 5 : 3;
            wobblyEllipse(ctx, toRect(pr.error_bbox ?? box, w, h), p, i);
          }
        });
        if (p < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    el.complete ? draw() : el.addEventListener("load", draw, { once: true });
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [imageUrl, problems, focusId]);

  const handleClick = (e: React.MouseEvent) => {
    if (!onSelect || !img.current) return;
    const r = img.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 1000;
    const y = ((e.clientY - r.top) / r.height) * 1000;
    const hit = problems.find(({ bbox: [y0, x0, y1, x1] }) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    if (hit) onSelect(hit.id);
  };

  return (
    <div className="relative inline-block max-w-full" onClick={handleClick}>
      <img ref={img} src={imageUrl} alt="Captured worksheet" className="block max-h-[70vh] max-w-full rounded-xl" />
      <canvas ref={canvas} className="pointer-events-none absolute left-0 top-0" />
    </div>
  );
}
