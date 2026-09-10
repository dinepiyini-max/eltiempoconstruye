import { useEffect, useMemo, useState } from "react";
import { NOTE_KINDS, VALLE } from "@/game/catalog";
import { notesMarkdown, notesPlain, noteStamp } from "@/game/sim";
import { readDraft, useObra, writeDraft } from "@/game/store";
import type { NoteKind } from "@/game/types";

export function Libreta() {
  const notes = useObra((s) => s.game.libreta);
  const open = useObra((s) => s.game.libretaOpen);
  const pinned = useObra((s) => s.game.libretaPinned);
  const page = useObra((s) => s.game.page);
  const selected = useObra((s) => s.game.selected);
  const regime = useObra((s) => s.game.regime);
  const siteMinutes = useObra((s) => s.game.siteMinutes);
  const noteFocus = useObra((s) => s.noteFocus);
  const pending = useObra((s) => s.pendingCoords);
  const slot = useObra((s) => s.slot);
  const addNote = useObra((s) => s.addNote);
  const clearNotes = useObra((s) => s.clearNotes);
  const importVisita = useObra((s) => s.importVisitaNotes);
  const toggle = useObra((s) => s.toggleLibreta);
  const pin = useObra((s) => s.pinLibreta);
  const setFocus = useObra((s) => s.setNoteFocus);
  const setCoords = useObra((s) => s.setPendingCoords);

  const draft0 = readDraft(slot);
  const [kind, setKind] = useState<NoteKind>(draft0.kind);
  const [line, setLine] = useState(draft0.line);
  const [wipe, setWipe] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visitaN, setVisitaN] = useState(0);

  useEffect(() => {
    const d = readDraft(slot);
    setKind(d.kind);
    setLine(d.line);
  }, [slot]);

  useEffect(() => {
    writeDraft(slot, { kind, line });
  }, [slot, kind, line]);

  useEffect(() => {
    if (slot !== "jefe") {
      setVisitaN(0);
      return;
    }
    try {
      const raw = window.localStorage.getItem("obra.visita");
      if (!raw) {
        setVisitaN(0);
        return;
      }
      const p = JSON.parse(raw) as { libreta?: unknown[] };
      setVisitaN(Array.isArray(p.libreta) ? p.libreta.length : 0);
    } catch {
      setVisitaN(0);
    }
  }, [slot, notes.length]);

  useEffect(() => {
    if (!open) setFocus(false);
  }, [open, setFocus]);

  const sorted = useMemo(
    () => [...notes].sort((a, b) => a.at - b.at || a.siteMinutes - b.siteMinutes),
    [notes],
  );
  const stamp = noteStamp({
    siteMinutes,
    page,
    front: selected,
    regime,
    coords: pending,
  });

  const copyOut = async (md: boolean) => {
    const text = md ? notesMarkdown(sorted, VALLE) : notesPlain(sorted, VALLE);
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
    writeDraft(slot, { kind, line: "" });
    setCoords(null);
  };

  return (
    <aside
      className={`flex shrink-0 flex-col border-ink/20 bg-paper max-md:border-t md:border-l ${open ? "max-md:h-[min(42vh,22rem)] md:w-[300px]" : "max-md:h-10 md:w-8"}`}
      aria-label="Libreta de campo"
    >
      <button
        type="button"
        onClick={toggle}
        className={`small-caps flex min-h-11 items-center gap-2 px-2 text-[0.58rem] tracking-[0.16em] text-ink ${open ? "justify-between border-b border-rule/70" : "h-full justify-center md:writing-vertical"}`}
        aria-expanded={open}
      >
        <span>{open ? "LIBRETA ▾" : "LIBRETA ▸"}</span>
        {open ? <span className="text-ink-soft">{sorted.length}</span> : null}
      </button>
      <div
        className={`libreta-hoja flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 ${open ? "" : "hidden"}`}
        aria-hidden={!open}
      >
        <p className="small-caps text-[0.5rem] text-cyan">Hoja de campo · {VALLE}</p>
        {noteFocus ? (
          <p className="mt-1 font-serif text-sm italic text-stamp">
            Campo abierto · el reloj espera tu nota.
          </p>
        ) : null}
        <ol className="mt-2 min-h-0 flex-1 overflow-auto">
          {sorted.length === 0 ? (
            <li className="py-4 font-serif italic text-ink-soft">Sin anotaciones.</li>
          ) : (
            sorted.map((n) => (
              <li key={n.id} className="libreta-entry border-b border-rule/70 py-2">
                <p className="small-caps text-[0.48rem] text-ink-soft">
                  {noteStamp(n)}
                  <span className="ml-2 text-stamp">{n.kind}</span>
                </p>
                <p className="mt-0.5 font-serif text-[0.95rem] leading-snug text-ink">
                  {n.line}
                </p>
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
          <p className="small-caps text-[0.48rem] text-ink-soft">{stamp}</p>
          {pending ? (
            <p className="small-caps text-[0.48rem] text-cyan">
              ANOTAR AQUÍ · {Math.round(pending.x)},{Math.round(pending.y)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {NOTE_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`small-caps min-h-11 border px-2 text-[0.5rem] ${kind === k.id ? "border-stamp text-stamp" : "border-rule text-ink-soft"}`}
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
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              maxLength={240}
              rows={2}
              placeholder="Una línea."
              autoComplete="off"
              className="w-full resize-none border-0 border-b border-ink/30 bg-transparent py-1 font-serif text-base text-ink outline-none placeholder:text-faint"
            />
          </label>
          <button
            type="submit"
            className="stamp min-h-11 px-3 py-1 text-[0.55rem]"
            disabled={!line.trim()}
          >
            ANOTAR
          </button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-rule/60 pt-2">
          <button
            type="button"
            onClick={pin}
            className={`small-caps min-h-11 border px-2 text-[0.5rem] ${pinned ? "border-stamp text-stamp" : "border-ink/30"}`}
          >
            {pinned ? "FIJADA" : "FIJAR"}
          </button>
          <button
            type="button"
            onClick={() => copyOut(false)}
            className="small-caps min-h-11 border border-ink/30 px-2 text-[0.5rem]"
          >
            {copied ? "COPIADA" : "COPIAR"}
          </button>
          <button
            type="button"
            onClick={() => copyOut(true)}
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
          {slot === "jefe" && visitaN > 0 ? (
            <button
              type="button"
              onClick={() => {
                importVisita();
                try {
                  const raw = window.localStorage.getItem("obra.visita");
                  const p = raw ? (JSON.parse(raw) as { libreta?: unknown[] }) : {};
                  setVisitaN(Array.isArray(p.libreta) ? p.libreta.length : 0);
                } catch {
                  setVisitaN(0);
                }
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
