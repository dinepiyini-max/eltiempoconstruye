import { VALLEY_NAME } from "@/lib/obra/catalog";
import { formatInt } from "@/lib/obra/format";
import { CRECIDA_NO_NEGOCIA } from "@/lib/obra/pliego";
import { composeCierre, crecidaNoNegocia } from "@/lib/obra/sim";
import { useObra } from "@/lib/obra/store";
import { NuevaPartida } from "./NuevaPartida";

/** Banner del día 8. No es REANUDA. Solo se cierra con CERRAR. */
export function CrecidaAviso() {
  const game = useObra((s) => s.game);
  const dismissed = useObra((s) => s.crecidaAvisoDismissed);
  const dismiss = useObra((s) => s.dismissCrecidaAviso);
  if (dismissed || !crecidaNoNegocia(game)) return null;
  return (
    <div
      data-obra-crecida-aviso
      role="status"
      aria-live="polite"
      className="relative z-30 mb-2 flex w-full items-center gap-3 border border-stamp/50 bg-paper px-3 py-2"
    >
      <p className="min-w-0 flex-1 font-serif text-base leading-snug text-ink">{CRECIDA_NO_NEGOCIA}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="CERRAR"
        className="small-caps shrink-0 min-h-11 border border-ink/40 px-2 text-[0.55rem] tracking-[0.14em] text-ink"
      >
        CERRAR
      </button>
    </div>
  );
}

/** Lámina de cierre al ganar o al vencer el plazo. Panel, no fireworks. */
export function CierrePanel() {
  const game = useObra((s) => s.game);
  const dismissed = useObra((s) => s.cierreDismissed);
  const dismiss = useObra((s) => s.dismissCierre);
  const sheet = composeCierre(game);
  if (!sheet || dismissed) return null;

  return (
    <div
      data-obra-cierre
      role="dialog"
      aria-modal="true"
      aria-labelledby="obra-cierre-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/45 p-4"
    >
      <article className="w-full max-w-lg border border-ink/40 bg-paper p-6 shadow-sheet">
        <p className="small-caps text-[0.6rem] tracking-[0.14em] text-cyan">
          Lámina de cierre · {VALLEY_NAME}
        </p>
        <h2 id="obra-cierre-title" className="stamp mt-4 inline-block px-3 py-1.5 text-[0.7rem] tracking-[0.16em]">
          {sheet.stamp}
        </h2>
        <p className="mt-4 font-serif text-lg leading-snug text-ink">{sheet.phrase}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="small-caps text-[0.55rem] text-ink-soft">Día</dt>
            <dd className="tabular-nums text-ink">{sheet.dayLabel}</dd>
          </div>
          <div>
            <dt className="small-caps text-[0.55rem] text-ink-soft">Prestigio</dt>
            <dd className="tabular-nums text-ink">{formatInt(sheet.prestigio)}</dd>
          </div>
        </dl>
        <p className="mt-4 font-serif text-sm leading-snug text-ink">
          <span className="small-caps text-[0.55rem] text-ink-soft">Frentes · </span>
          {sheet.fronts}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <NuevaPartida />
          <button
            type="button"
            onClick={dismiss}
            className="small-caps min-h-11 border border-ink/40 px-3 text-[0.55rem] tracking-[0.14em] text-ink"
          >
            SEGUIR
          </button>
        </div>
      </article>
    </div>
  );
}
