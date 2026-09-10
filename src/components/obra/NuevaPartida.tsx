import { useState } from "react";
import { useObra } from "@/lib/obra/store";

/** Confirmación explícita: qué borra y si se conservan las notas. */
export function NuevaPartida({ compact = false }: { compact?: boolean }) {
  const resetValley = useObra((s) => s.resetValley);
  const notes = useObra((s) => s.game.libreta.length);
  const [open, setOpen] = useState(false);
  const [keep, setKeep] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`small-caps min-h-11 border border-ink/40 px-2 text-[0.52rem] ${compact ? "" : "px-3"}`}
      >
        NUEVA PARTIDA
      </button>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-2 border border-ink/30 bg-paper px-3 py-2">
      <p className="font-serif text-sm leading-snug text-ink">
        Se borra el valle, el pliego y el reloj. {notes ? `${notes} notas en la libreta.` : "Libreta vacía."}
      </p>
      <label className="flex min-h-11 items-center gap-2 font-serif text-sm text-ink">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        Conservar notas de campo
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            resetValley(keep);
            setOpen(false);
            setKeep(true);
          }}
          className="stamp min-h-11 px-3 py-1 text-[0.55rem]"
        >
          CONFIRMAR
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="small-caps min-h-11 border border-ink/30 px-3 text-[0.55rem]"
        >
          NO
        </button>
      </div>
    </div>
  );
}
