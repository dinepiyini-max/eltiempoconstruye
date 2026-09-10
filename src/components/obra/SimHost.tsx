import { useEffect } from "react";
import { useObra } from "@/lib/obra/store";
import type { SaveSlot } from "@/lib/obra/types";

/**
 * Dueño del reloj de pantalla.
 * - hydrate al montar y si cambia el slot
 * - rAF solo con la pestaña visible
 * - al ocultar: flush (salva el instante)
 * - al volver: catchUp (el valle siguió, tope 8 h)
 */
export function SimHost({ slot }: { slot: SaveSlot }) {
  const hydrate = useObra((s) => s.hydrate);
  const catchUp = useObra((s) => s.catchUp);
  const advance = useObra((s) => s.advance);
  const flush = useObra((s) => s.flush);

  useEffect(() => {
    hydrate(slot);
  }, [hydrate, slot]);

  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.visibilityState === "hidden") {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      advance(dt);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        flush();
      } else {
        catchUp();
        last = performance.now();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [advance, flush, catchUp]);

  return null;
}
