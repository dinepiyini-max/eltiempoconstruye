import { STRUCTURE_NAME_UP } from "@/lib/obra/catalog";
import { useObra } from "@/lib/obra/store";
import { V1_CONTRACT_IDS } from "@/lib/obra/types";

/** Atajo si el hit-test del canvas falla. Reabre la ficha. */
export function FrontChips() {
  const game = useObra((s) => s.game);
  const select = useObra((s) => s.select);
  if (game.instruction === "levanta") return null;
  const ids = V1_CONTRACT_IDS.filter((id) => game.structures[id].opened || game.survey >= 1);
  if (!ids.length) return null;

  return (
    <div className="pointer-events-auto flex flex-wrap gap-1">
      {ids.map((id) => {
        const on = game.selected === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            className={`small-caps min-h-11 border px-2 text-[0.52rem] ${
              on ? "border-stamp text-stamp" : "border-ink/30 text-ink"
            }`}
          >
            {STRUCTURE_NAME_UP[id]}
          </button>
        );
      })}
    </div>
  );
}
