import { useState } from "react";
import { VALLEY_NAME } from "@/lib/obra/catalog";
import { MANDANTE, PLIEGO_LINES, SCRIPT_60 } from "@/lib/obra/pliego";
import { floodLine } from "@/lib/obra/sim";
import { useObra } from "@/lib/obra/store";

/**
 * Calco de plano: quién te contrató y qué amenaza hay.
 * Cero modales. ≤12 líneas. Una franja + la hoja si la pides.
 */
export function PliegoStrip() {
  const instruction = useObra((s) => s.game.instruction);
  const floodStatus = useObra((s) => s.game.floodStatus);
  const game = useObra((s) => s.game);
  const [open, setOpen] = useState(false);
  const flood = floodLine(game);

  let line: string = SCRIPT_60.pliego;
  if (instruction === "levanta") line = SCRIPT_60.pliego;
  else if (instruction === "define") line = SCRIPT_60.flood;
  else if (floodStatus === "a-salvo") line = "OBRA A SALVO. El pliego se cumplió.";
  else if (floodStatus === "incumplido") line = "PLAZO INCUMPLIDO. La crecida ya está en el valle.";
  else line = `${flood} · ${SCRIPT_60.regime}`;

  return (
    <div className="pointer-events-auto max-w-md">
      <article className="border border-ink/20 bg-paper/95 px-3 py-2 shadow-sheet">
        <p className="small-caps text-[0.55rem] text-cyan">
          {instruction === "levanta" ? SCRIPT_60.received : `${VALLEY_NAME} · ${MANDANTE}`}
        </p>
        <p className="mt-1 font-serif text-sm leading-snug text-ink">{line}</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="small-caps mt-2 min-h-11 text-[0.55rem] tracking-[0.18em] text-ink"
        >
          {open ? "Cerrar pliego" : "Ver pliego"}
        </button>
        {open ? (
          <ol className="mt-3 space-y-2 border-t border-rule/80 pt-3">
            {PLIEGO_LINES.map((l) => (
              <li key={l} className="font-serif text-sm leading-snug text-ink">
                {l}
              </li>
            ))}
          </ol>
        ) : null}
      </article>
    </div>
  );
}
