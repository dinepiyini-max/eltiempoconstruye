import { useEffect, useMemo, useState } from "react";
import { FRONT_LABEL, VALLEY_NAME } from "@/lib/obra/catalog";
import { formatLibretaMarkdown, formatLibretaText, noteMetaLine } from "@/lib/obra/format";
import { peekLibreta } from "@/lib/obra/persist";
import { useObra } from "@/lib/obra/store";
import type { LibretaKind } from "@/lib/obra/types";

const KINDS: { id: LibretaKind; hint: string }[] = [
  { id: "BUG", hint: "Algo que falla en el sitio o en la lámina." },
  { id: "MEJORA", hint: "Lo que el valle pide." },
  { id: "DUDA", hint: "Lo que no está claro." },
  { id: "NOTA", hint: "Comentario libre." },
];

/**
 * Panel dock. Siempre montado. El draft vive aquí, no en el store.
 * Cerrado = filete. Abierto = hoja de campo.
 */
export function Libreta() {
  const notes = useObra((s) => s.game.libreta);
  const open = useObra((s) => s.game.libretaOpen);
  const pinned = useObra((s) => s.game.libretaPinned);
  const page = useObra((s) => s.game.page);
  const selected = useObra((s) => s.game.selected);
  const regime = useObra((s) => s.game.regime);
  const siteMinutes = useObra((s) => s.game.siteMinutes);
  const noteFocus = useObra((s) => s.noteFocus);
  const pendingCoords = useObra((s) => s.pendingCoords);
  const slot = useObra((s) => s.slot);
  const addNote = useObra((s) => s.addNote);
  const clearNotes = useObra((s) => s.clearNotes);
  const importVisitaNotes = useObra((s) => s.importVisitaNotes);
  const toggleLibreta = useObra((s) => s.toggleLibreta);
  const pinLibreta = useObra((s) => s.pinLibreta);
  const setNoteFocus = useObra((s) => s.setNoteFocus);
  const setPendingCoords = useObra((s) => s.setPendingCoords);

  const [kind, setKind] = useState<LibretaKind>("NOTA");
  const [line, setLine] = useState("");
  const [wipe, setWipe] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visitaCount, setVisitaCount] = useState(0);

  useEffect(() => {
    if (slot !== "jefe") {
      setVisitaCount(0);
      return;
    }
    setVisitaCount(peekLibreta("visita").length);
  }, [slot, notes.length]);

  useEffect(() => {
    if (!open) setNoteFocus(false);
  }, [open, setNoteFocus]);

  const ordered = useMemo(
    () => [...notes].sort((a, b) => a.at - b.at || a.siteMinutes - b.siteMinutes),
    [notes],
  );

  const liveMeta = noteMetaLine({
    siteMinutes,
    page,
    front: selected,
    regime,
    coords: pendingCoords,
  });

  const copy = async (md: boolean) => {
    const text = md
      ? formatLibretaMarkdown(ordered, VALLEY_NAME)
      : formatLibretaText(ordered, VALLEY_NAME);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    if (md) {
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "obra-libreta.md";
      a.click();
      URL.revokeObjectURL(url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const submit = () => {
    addNote(kind, line);
    setLine("");
    setPendingCoords(null);
  };

  return (
    <aside
      className={`flex min-w-0 shrink-0 flex-col overflow-x-hidden border-ink/20 bg-paper max-md:border-t md:border-l ${
        open ? "max-md:h-[min(42vh,22rem)] md:w-72 md:max-w-[min(18rem,32vw)]" : "max-md:h-10 md:w-8"
      }`}
      aria-label="Libreta de campo"
    >
      <button
        type="button"
        onClick={toggleLibreta}
        className={`small-caps flex min-h-11 items-center gap-2 px-2 text-[0.58rem] tracking-[0.16em] text-ink ${
          open ? "justify-between border-b border-rule/70" : "h-full justify-center md:writing-vertical"
        }`}
        aria-expanded={open}
      >
        <span>{open ? "LIBRETA ▾" : "LIBRETA ▸"}</span>
        {open ? <span className="text-ink-soft">{ordered.length}</span> : null}
      </button>

      <div
        className={`libreta-hoja flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 ${open ? "" : "hidden"}`}
        aria-hidden={!open}
      >
        <p className="small-caps text-[0.5rem] text-cyan">Hoja de campo · {VALLEY_NAME}</p>
        {noteFocus ? (
          <p className="mt-1 font-serif text-sm italic text-stamp">Campo abierto · el reloj espera tu nota.</p>
        ) : null}

        <ol className="mt-2 min-h-0 flex-1 overflow-auto">
          {ordered.length === 0 ? (
            <li className="py-4 font-serif italic text-ink-soft">Sin anotaciones.</li>
          ) : (
            ordered.map((n) => (
              <li key={n.id} className="libreta-entry border-b border-rule/70 py-2">
                <p className="small-caps text-[0.48rem] text-ink-soft">
                  {noteMetaLine(n)}
                  <span className="ml-2 text-stamp">{n.kind}</span>
                </p>
                <p className="mt-0.5 font-serif text-[0.95rem] leading-snug text-ink">{n.line}</p>
              </li>
            ))
          )}
        </ol>

        <form
          className="mt-2 shrink-0 space-y-2 border-t border-rule/70 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="small-caps text-[0.48rem] text-ink-soft">{liveMeta}</p>
          {pendingCoords ? (
            <p className="small-caps text-[0.48rem] text-cyan">
              ANOTAR AQUÍ · {Math.round(pendingCoords.x)},{Math.round(pendingCoords.y)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`small-caps min-h-11 border px-2 text-[0.5rem] ${
                  kind === k.id ? "border-stamp text-stamp" : "border-rule text-ink-soft"
                }`}
              >
                {k.id}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="sr-only">Anotación</span>
            <textarea
              id="libreta-linea"
              name="anotacion"
              value={line}
              onChange={(e) => setLine(e.target.value)}
              onFocus={() => setNoteFocus(true)}
              onBlur={() => setNoteFocus(false)}
              maxLength={240}
              rows={2}
              placeholder="Una línea."
              autoComplete="off"
              className="w-full resize-none border-0 border-b border-ink/30 bg-transparent py-1 font-serif text-base text-ink outline-none placeholder:text-faint"
            />
          </label>
          <button type="submit" className="stamp min-h-11 px-3 py-1 text-[0.55rem]" disabled={!line.trim()}>
            ANOTAR
          </button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-rule/60 pt-2">
          <button
            type="button"
            onClick={pinLibreta}
            className={`small-caps min-h-11 border px-2 text-[0.5rem] ${
              pinned ? "border-stamp text-stamp" : "border-ink/30"
            }`}
          >
            {pinned ? "FIJADA" : "FIJAR"}
          </button>
          <button
            type="button"
            onClick={() => copy(false)}
            className="small-caps min-h-11 border border-ink/30 px-2 text-[0.5rem]"
          >
            {copied ? "COPIADA" : "COPIAR"}
          </button>
          <button
            type="button"
            onClick={() => copy(true)}
            className="small-caps min-h-11 border border-ink/30 px-2 text-[0.5rem]"
          >
            EXPORTAR
          </button>
          {wipe ? (
            <div className="flex items-center gap-1">
              <span className="font-serif text-xs text-ink">¿Vaciar?</span>
              <button
                type="button"
                onClick={() => {
                  clearNotes();
                  setWipe(false);
                }}
                className="small-caps min-h-11 border border-stamp px-2 text-[0.5rem] text-stamp"
              >
                SÍ
              </button>
              <button
                type="button"
                onClick={() => setWipe(false)}
                className="small-caps min-h-11 border border-ink/30 px-2 text-[0.5rem]"
              >
                NO
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWipe(true)}
              className="small-caps min-h-11 border border-ink/30 px-2 text-[0.5rem]"
            >
              VACIAR
            </button>
          )}
          {slot === "jefe" && visitaCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                importVisitaNotes();
                setVisitaCount(peekLibreta("visita").length);
              }}
              className="small-caps min-h-11 border border-cyan px-2 text-[0.5rem] text-cyan"
            >
              TRAER VISITA
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export { FRONT_LABEL };
