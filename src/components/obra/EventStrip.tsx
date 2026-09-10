import { STRUCTURE_NAME } from "@/lib/obra/catalog";
import { useObra } from "@/lib/obra/store";
import type { StructureId } from "@/lib/obra/types";
import { STRUCTURE_IDS } from "@/lib/obra/types";

function isStructure(id: string | null): id is StructureId {
  return !!id && (STRUCTURE_IDS as readonly string[]).includes(id);
}

export function EventStrip() {
  const events = useObra((s) => s.game.events);
  const visible = events.filter((e) => e.minutesLeft > 0).slice(0, 3);
  if (!visible.length) return null;
  return (
    <div className="pointer-events-none flex flex-col gap-2">
      {visible.map((e) => (
        <article key={e.id} className="max-w-xs border border-ink/20 bg-paper/90 px-3 py-2 shadow-sheet">
          <p className="small-caps text-[0.55rem] text-stamp">
            {e.title}
            {isStructure(e.target) ? ` · ${STRUCTURE_NAME[e.target].toUpperCase()}` : ""}
            {" · "}DÍA {String(e.day).padStart(2, "0")} · {e.clock}
          </p>
          <p className="mt-1 font-serif text-sm leading-snug text-ink">{e.body}</p>
        </article>
      ))}
    </div>
  );
}
