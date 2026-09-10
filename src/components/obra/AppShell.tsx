import { useEffect } from "react";
import { useObra } from "@/lib/obra/store";
import type { SaveSlot } from "@/lib/obra/types";
import { AbsenceNote } from "./AbsenceNote";
import { Archivo } from "./Archivo";
import { Contratos } from "./Contratos";
import { Libreta } from "./Libreta";
import { Obra } from "./Obra";
import { Plano } from "./Plano";
import { SimHost } from "./SimHost";
import { TitleBlock } from "./TitleBlock";

export function AppShell({ slot }: { slot: SaveSlot }) {
  const page = useObra((s) => s.game.page);
  const hydrated = useObra((s) => s.hydrated);
  const toggleLibreta = useObra((s) => s.toggleLibreta);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      toggleLibreta();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleLibreta]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <SimHost slot={slot} />
      {hydrated ? (
        <>
          <TitleBlock />
          <AbsenceNote />
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <main className="relative min-h-0 min-w-0 flex-1">
              <div
                className={`absolute inset-0 ${page === "plano" ? "" : "invisible pointer-events-none"}`}
                aria-hidden={page !== "plano"}
              >
                <Plano />
              </div>
              {page !== "plano" ? (
                <div className="absolute inset-0 z-10 overflow-auto bg-paper">
                  {page === "obra" ? <Obra /> : null}
                  {page === "contratos" ? <Contratos /> : null}
                  {page === "archivo" ? <Archivo /> : null}
                </div>
              ) : null}
            </main>
            <Libreta />
          </div>
        </>
      ) : null}
    </div>
  );
}
