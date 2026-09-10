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
