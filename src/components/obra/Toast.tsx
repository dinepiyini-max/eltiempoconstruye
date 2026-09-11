import { SAVE_FAIL_LINE } from "@/lib/obra/catalog";
import { SCRIPT_60 } from "@/lib/obra/pliego";
import { useObra } from "@/lib/obra/store";

/** Sello breve. No es un modal. */
export function Toast() {
  const toastAt = useObra((s) => s.toastAt);
  const toastText = useObra((s) => s.toastText);
  if (!toastAt || !toastText) return null;
  const short = toastText === SCRIPT_60.firmado || toastText === SAVE_FAIL_LINE;
  return (
    <div className="pointer-events-none fixed bottom-10 left-1/2 z-40 max-w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 px-2">
      <p
        key={toastAt}
        className={
          short
            ? "toast-stamp stamp bg-paper px-5 py-2 text-center text-[0.78rem] tracking-[0.28em] shadow-sheet"
            : "toast-stamp border border-stamp bg-paper px-4 py-2 text-center font-serif text-sm leading-snug text-stamp shadow-sheet"
        }
      >
        {toastText}
      </p>
    </div>
  );
}
