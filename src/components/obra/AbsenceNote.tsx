import { useObra } from "@/lib/obra/store";

export function AbsenceNote() {
  const absence = useObra((s) => s.game.absence);
  const dismiss = useObra((s) => s.dismissAbsence);
  if (!absence?.line) return null;

  return (
    <button
      type="button"
      onClick={dismiss}
      className="relative z-20 flex w-full items-baseline gap-3 border-b border-rule/80 bg-paper px-3 py-2 text-left sm:px-5"
    >
      <span className="stamp shrink-0 px-1.5 py-0.5 text-[0.48rem]">AUSENTE</span>
      <span className="min-w-0 flex-1 truncate font-serif text-base italic text-ink">{absence.line}</span>
    </button>
  );
}

/** Una línea al reanudar. Encima de OBRA. Solo se cierra con CERRAR. */
export function ResumeBanner() {
  const line = useObra((s) => s.resumeLine);
  const dismiss = useObra((s) => s.dismissResume);
  if (!line) return null;
  return (
    <div
      data-obra-resume
      role="status"
      aria-live="polite"
      className="relative z-30 mb-2 flex w-full items-center gap-3 border border-ink/40 bg-cyan-wash px-3 py-2"
    >
      <p className="min-w-0 flex-1 whitespace-normal break-words font-serif text-base leading-snug text-ink">{line}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="CERRAR"
        className="small-caps shrink-0 min-h-11 border border-ink/40 px-2 text-[0.55rem] tracking-[0.14em] text-ink"
      >
        <span aria-hidden="true">×</span>
        <span className="ml-1">CERRAR</span>
      </button>
    </div>
  );
}
