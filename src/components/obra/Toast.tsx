import { SCRIPT_60 } from "@/lib/obra/pliego";
import { useObra } from "@/lib/obra/store";

/** Sello breve. No es un modal. */
export function Toast() {
  const lastNotice = useObra((s) => s.game.lastNotice);
  const toastAt = useObra((s) => s.toastAt);
  if (!toastAt || lastNotice !== SCRIPT_60.firmado) return null;
  return (
    <div className="pointer-events-none fixed bottom-10 left-1/2 z-40 -translate-x-1/2">
      <p key={toastAt} className="toast-stamp stamp bg-paper px-5 py-2 text-[0.78rem] tracking-[0.28em] shadow-sheet">
        {SCRIPT_60.firmado}
      </p>
    </div>
  );
}
