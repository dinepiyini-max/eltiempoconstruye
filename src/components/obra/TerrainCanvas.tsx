import { useEffect, useRef } from "react";
import { drawSheet, hitTest, paletteFrom } from "@/lib/obra/draw";
import { useObra } from "@/lib/obra/store";

export function TerrainCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const startSurvey = useObra((s) => s.startSurvey);
  const select = useObra((s) => s.select);
  const setPendingCoords = useObra((s) => s.setPendingCoords);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let hover: { x: number; y: number } | null = null;
    let pal = paletteFrom(canvas);

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
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const parent = canvas.parentElement;
      if (!parent) return;
      pal = paletteFrom(canvas);
      const st = useObra.getState();
      const flashAt = st.surveyFlashAt;
      const flash = flashAt ? Math.max(0, 1 - (Date.now() - flashAt) / 520) : 0;
      drawSheet(ctx, parent.clientWidth, parent.clientHeight, st.game, pal, hover, {
        visita: st.slot === "visita",
        flash,
      });
    };
    raf = requestAnimationFrame(loop);

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onMove = (e: PointerEvent) => {
      hover = pos(e);
      const parent = canvas.parentElement;
      if (!parent) return;
      const hit = hitTest(hover.x, hover.y, parent.clientWidth, parent.clientHeight, useObra.getState().game);
      canvas.style.cursor = hit ? "pointer" : "crosshair";
    };
    const onLeave = () => {
      hover = null;
    };
    const onClick = (e: PointerEvent) => {
      if (e.button === 2) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const p = pos(e);
      const game = useObra.getState().game;
      const hit = hitTest(p.x, p.y, parent.clientWidth, parent.clientHeight, game);
      if (!hit) {
        select(null);
        return;
      }
      if (hit.type === "stake" || hit.type === "instruction") {
        if (game.survey < 1) startSurvey();
        return;
      }
      if (hit.type === "structure" && hit.id) {
        select(hit.id);
      }
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      setPendingCoords({ x, y });
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);
    canvas.addEventListener("contextmenu", onContext);

    const onFonts = () => fit();
    document.fonts?.ready.then(onFonts);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
      canvas.removeEventListener("contextmenu", onContext);
    };
  }, [startSurvey, select, setPendingCoords]);

  return (
    <canvas
      ref={ref}
      className="block h-full w-full touch-none"
      role="img"
      aria-label="Plano del Valle del Yuna"
    />
  );
}
