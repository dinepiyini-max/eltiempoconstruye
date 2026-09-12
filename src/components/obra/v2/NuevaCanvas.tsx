import { useEffect, useRef } from "react";
import { drawNueva, hitTestHuecos, hitTestWalls, paletteFrom, toWorld, type HuecoPreview } from "@/lib/obra/v2/draw-v2";
import {
  clampHuecoAlong,
  huecoAnchoDefault,
  alongMuro,
  lengthMeters,
  muroLargo,
  type HuecoKind,
  type Pt,
} from "@/lib/obra/v2/geometry";
import { useNueva } from "@/lib/obra/v2/store";

const DRAG_PX = 7;

export function NuevaCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ dist: number; center: Pt } | null>(null);
  const down = useRef<{ screen: Pt; moved: boolean; pan: boolean; started: boolean } | null>(null);
  const space = useRef(false);
  const fitted = useRef(false);
  const hover = useRef<HuecoPreview | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const fit = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!fitted.current && w > 40 && h > 40) {
        const st = useNueva.getState();
        if (st.view.ppm === 28) st.fit(w, h);
        fitted.current = true;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const parent = canvas.parentElement;
      if (!parent) return;
      const pal = paletteFrom(canvas);
      const st = useNueva.getState();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawNueva(
        ctx,
        parent.clientWidth,
        parent.clientHeight,
        {
          walls: st.walls,
          openings: st.openings,
          selectedId: st.selectedId,
          draft: st.draft,
          view: st.view,
          hover: hover.current,
        },
        pal,
      );
      canvas.style.cursor =
        st.tool === "muro" || st.tool === "puerta" || st.tool === "ventana" ? "crosshair" : "default";
    };
    raf = requestAnimationFrame(loop);

    const pos = (e: PointerEvent): Pt => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const worldOf = (screen: Pt) => toWorld(useNueva.getState().view, screen);

    const previewHueco = (kind: HuecoKind, world: Pt) => {
      const st = useNueva.getState();
      const wallId = hitTestWalls(world, st.walls, st.view.ppm);
      if (!wallId) {
        hover.current = null;
        return;
      }
      const m = st.walls.find((w) => w.id === wallId);
      if (!m) {
        hover.current = null;
        return;
      }
      const ancho = huecoAnchoDefault(kind);
      const along = clampHuecoAlong(muroLargo(m), ancho, alongMuro(m, world));
      if (along == null) {
        hover.current = null;
        return;
      }
      hover.current = { kind, wallId, alongM: along, ancho };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events / some browsers */
      }
      const screen = pos(e);
      pointers.current.set(e.pointerId, screen);
      if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()];
        const a = pts[0]!;
        const b = pts[1]!;
        pinch.current = {
          dist: Math.hypot(b.x - a.x, b.y - a.y),
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
        down.current = null;
        return;
      }
      const pan = space.current || e.button === 1 || e.altKey;
      down.current = { screen, moved: false, pan, started: false };
      if (pan) return;
      const st = useNueva.getState();
      if (st.tool === "seleccionar") {
        const world = worldOf(screen);
        const hid = hitTestHuecos(world, st.walls, st.openings, st.view.ppm);
        st.select(hid ?? hitTestWalls(world, st.walls, st.view.ppm));
        return;
      }
      if (st.tool === "puerta" || st.tool === "ventana") {
        st.placeHueco(st.tool, worldOf(screen));
        hover.current = null;
        return;
      }
      if (!st.draft) {
        const s = st.snap(worldOf(screen), null);
        st.setDraft({ a: s.point, b: s.point, kind: s.kind });
        down.current.started = true;
      } else {
        const s = st.snap(worldOf(screen), st.draft.a);
        st.setDraft({ a: st.draft.a, b: s.point, kind: s.kind });
      }
    };

    const onMove = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, pos(e));
      if (pointers.current.size === 2 && pinch.current) {
        const pts = [...pointers.current.values()];
        const a = pts[0]!;
        const b = pts[1]!;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const factor = dist / (pinch.current.dist || dist);
        useNueva.getState().zoom(pinch.current.center, factor);
        useNueva.getState().pan(center.x - pinch.current.center.x, center.y - pinch.current.center.y);
        pinch.current = { dist, center };
        return;
      }
      const screen = pos(e);
      const st = useNueva.getState();
      if (down.current?.pan) {
        st.pan(screen.x - down.current.screen.x, screen.y - down.current.screen.y);
        down.current = { ...down.current, screen, moved: true };
        return;
      }
      if (down.current) {
        if (Math.hypot(screen.x - down.current.screen.x, screen.y - down.current.screen.y) > DRAG_PX) {
          down.current.moved = true;
        }
      }
      if (st.tool === "puerta" || st.tool === "ventana") {
        if (!down.current) previewHueco(st.tool, worldOf(screen));
        return;
      }
      hover.current = null;
      if (st.tool !== "muro" || !st.draft) return;
      const s = st.snap(worldOf(screen), st.draft.a);
      st.setDraft({ a: st.draft.a, b: s.point, kind: s.kind });
    };

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      const st = useNueva.getState();
      const d = down.current;
      down.current = null;
      if (!d || d.pan || st.tool !== "muro" || !st.draft) return;
      const s = st.snap(worldOf(pos(e)), st.draft.a);
      if (d.moved || !d.started) {
        if (lengthMeters(st.draft.a, s.point) >= 0.3) st.commitMuro(st.draft.a, s.point);
        else if (!d.started) st.setDraft(null);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      useNueva.getState().zoom({ x: e.clientX - r.left, y: e.clientY - r.top }, e.deltaY > 0 ? 0.9 : 1.1);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") space.current = e.type === "keydown";
    };

    const onLeave = () => {
      hover.current = null;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", () => {
      space.current = false;
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="block h-full w-full touch-none"
      data-obra-canvas="nueva"
      aria-label="Lámina de muros"
    />
  );
}
