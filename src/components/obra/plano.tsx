import { useEffect, useRef, useState } from "react";
import {
  COPY,
  MANDANTE,
  STRUCT_NAME,
  STRUCT_SHORT,
  VALLE,
} from "@/game/catalog";
import {
  bottleAct,
  bottleHint,
  contractOf,
  fichaOf,
  frontDue,
  gateHint,
  gateOf,
  isPliego,
  staffCheck,
} from "@/game/sim";
import { useObra } from "@/game/store";
import { PLIEGO_IDS, type PliegoId, type StructureId } from "@/game/types";
import { drawSheet, hitTest, readPalette } from "@/game/map";
import { Almacen, Pair } from "./widgets";

function Ficha() {
  const selected = useObra((s) => s.game.selected);
  const game = useObra((s) => s.game);
  const accept = useObra((s) => s.accept);
  const select = useObra((s) => s.select);
  const staff = useObra((s) => s.staffFront);
  if (!selected) return null;
  const s = game.structures[selected];
  const card = fichaOf(game, selected);
  const c = contractOf(game, selected);
  const pliego = isPliego(selected);
  const gate = !s.opened && pliego ? gateOf(game, selected) : null;
  const needStaff =
    s.opened &&
    (card.bottle === "SIN CUADRILLA" ||
      card.bottle === "FALTA TOPÓGRAFO" ||
      card.bottle === "FALTAN OBREROS");
  const chk = needStaff ? staffCheck(game, selected) : { ok: true, reason: "" };
  const neck = gate ?? card.bottle;
  const hint = gate ? gateHint(gate) : bottleHint(card.bottle);
  const act = gate ? null : bottleAct(card.bottle);
  const canSign =
    pliego &&
    c &&
    c.status !== "cumplido" &&
    c.status !== "activo" &&
    !s.opened &&
    !gate;
  const due = c ? frontDue(game, c) : null;
  return (
    <aside className="pointer-events-auto w-full max-w-xs border border-ink/20 bg-paper/95 px-3 py-2 shadow-sheet">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="small-caps text-[0.55rem] text-cyan">Nota de plano</p>
          <h2 className="font-serif text-lg leading-tight text-ink">{STRUCT_NAME[selected]}</h2>
        </div>
        <button
          type="button"
          className="small-caps min-h-11 px-2 text-[0.55rem] text-ink-soft"
          onClick={() => select(null)}
        >
          Cerrar
        </button>
      </div>
      {c?.purpose ? (
        <p className="mt-2 font-serif text-sm leading-snug text-ink-soft">{c.purpose}</p>
      ) : null}
      <dl className="mt-2 space-y-1 text-[0.78rem] text-ink">
        <Pair k="Estado" v={card.stage} />
        <Pair k="Cuadrilla" v={card.crew} />
        <Pair k="Dotación" v={card.people} />
        <Pair k="Productividad" v={card.prod} />
        <Pair k="Hito" v={card.next} />
        <Pair k="Cuello" v={neck ?? "—"} accent={!!neck} />
        {due && c?.status === "activo" ? (
          <Pair
            k="Obra estimada del frente"
            v={due.late ? "TARDÍO" : `${due.remaining} d`}
            accent={due.late}
          />
        ) : null}
        {c && (c.status === "activo" || c.status === "cumplido") ? (
          <Pair
            k={c.status === "cumplido" ? "Prestigio" : "Prestigio al completar"}
            v={`${c.prestigio}`}
          />
        ) : null}
      </dl>
      {hint ? <p className="mt-3 font-serif text-sm leading-snug text-ink-soft">{hint}</p> : null}
      {act ? <p className="mt-1 font-serif text-sm text-ink">{act}</p> : null}
      {game.lastNotice ? (
        <p className="mt-2 font-serif text-sm leading-snug text-rust">{game.lastNotice}</p>
      ) : null}
      {needStaff ? (
        <button
          type="button"
          disabled={!chk.ok}
          onClick={() => staff(selected)}
          title={chk.ok ? "Asignar desde disponibles" : chk.reason}
          className="small-caps mt-3 min-h-11 w-full border border-ink px-3 text-[0.62rem] text-ink disabled:border-rule disabled:text-faint"
        >
          {chk.ok ? "Asignar desde disponibles" : chk.reason}
        </button>
      ) : null}
      {s.opened ? (
        <div className="mt-3">
          <p className="small-caps mb-1 text-[0.52rem] text-ink-soft">Almacén del valle</p>
          <Almacen compact />
        </div>
      ) : null}
      {canSign && c ? (
        <button
          type="button"
          onClick={() => accept(c.id)}
          className="stamp mt-4 min-h-11 px-3 py-1 text-[0.62rem]"
        >
          {COPY.merece}
        </button>
      ) : null}
    </aside>
  );
}

function Events() {
  const events = useObra((s) => s.game.events)
    .filter((e) => e.minutesLeft > 0)
    .slice(0, 3);
  if (!events.length) return null;
  return (
    <div className="pointer-events-none flex flex-col gap-2">
      {events.map((e) => (
        <article
          key={e.id}
          className="max-w-xs border border-ink/20 bg-paper/90 px-3 py-2 shadow-sheet"
        >
          <p className="small-caps text-[0.55rem] text-stamp">
            {e.title}
            {e.target !== "site" && (PLIEGO_IDS as readonly string[]).includes(e.target)
              ? ` · ${STRUCT_NAME[e.target as StructureId].toUpperCase()}`
              : ""}
            {` · DÍA ${String(e.day).padStart(2, "0")} · ${e.clock}`}
          </p>
          <p className="mt-1 font-serif text-sm leading-snug text-ink">{e.body}</p>
        </article>
      ))}
    </div>
  );
}

function Seals() {
  const hydrated = useObra((s) => s.hydrated);
  const survey = useObra((s) => s.game.survey);
  const surveying = useObra((s) => s.game.surveying);
  const instruction = useObra((s) => s.game.instruction);
  const start = useObra((s) => s.startSurvey);
  const sign = useObra((s) => s.signFirst);
  if (!hydrated) return null;
  if (survey < 1 && !surveying) {
    return (
      <div className="pointer-events-auto flex justify-center">
        <button
          type="button"
          onClick={start}
          className="stamp min-h-12 px-4 py-2 text-[0.72rem] tracking-[0.28em]"
        >
          {COPY.levanta}
        </button>
      </div>
    );
  }
  if (instruction === "define") {
    return (
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <p className="max-w-sm text-center font-serif text-sm italic text-ink">{COPY.define}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          {(["camino", "puente", "muro"] as PliegoId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => sign(id)}
              className="stamp min-h-12 min-w-24 px-3 py-2 text-[0.72rem] tracking-[0.32em]"
            >
              {STRUCT_SHORT[id]}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function FrontTabs() {
  const game = useObra((s) => s.game);
  const select = useObra((s) => s.select);
  const sign = useObra((s) => s.signFirst);
  if (game.instruction === "levanta") return null;
  const ids = PLIEGO_IDS.filter((id) => game.structures[id].opened || game.survey >= 1);
  if (!ids.length) return null;
  return (
    <div className="pointer-events-auto flex flex-wrap gap-1">
      {ids.map((id) => {
        const on = game.selected === id;
        const opened = game.structures[id].opened;
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (!opened && game.instruction === "define" && isPliego(id)) sign(id);
              else select(id);
            }}
            className={`small-caps min-h-11 border px-2 text-[0.52rem] ${on ? "border-stamp text-stamp" : "border-ink/30 text-ink"}`}
          >
            {STRUCT_SHORT[id]}
          </button>
        );
      })}
    </div>
  );
}

function Leyenda() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto max-w-[14rem] border border-ink/20 bg-paper/95 px-2 py-1 shadow-sheet">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="small-caps min-h-11 w-full text-left text-[0.52rem] tracking-[0.16em] text-ink"
      >
        {open ? "LEYENDA ▾" : "LEYENDA ▸"}
      </button>
      {open ? (
        <ul className="space-y-1 border-t border-rule/70 pb-1 pt-2 font-serif text-xs leading-snug text-ink">
          <li>Bandera — frente abierto</li>
          <li>Círculos — cuadrilla en el frente</li>
          <li>Punteado → continuo → doble — etapa</li>
          <li>Cian ancho — zona de inundación</li>
          <li>Sello TURNO / SIEMPRE — régimen</li>
          <li>Óxido en ficha — cuello</li>
        </ul>
      ) : null}
    </div>
  );
}

function PliegoCard() {
  const instruction = useObra((s) => s.game.instruction);
  const flood = useObra((s) => s.game.floodStatus);
  const [open, setOpen] = useState(false);
  let body = COPY.pliego;
  if (instruction === "levanta") body = COPY.pliego;
  else if (instruction === "define") body = COPY.flood;
  else if (flood === "a-salvo") body = "OBRA A SALVO. El pliego se cumplió.";
  else if (flood === "incumplido") body = "PLAZO INCUMPLIDO. La crecida ya está en el valle.";
  else body = COPY.regime;
  return (
    <div className="pointer-events-auto max-w-md">
      <article className="border border-ink/20 bg-paper/95 px-3 py-2 shadow-sheet">
        <p className="small-caps text-[0.55rem] text-cyan">
          {instruction === "levanta" ? COPY.received : `${VALLE} · ${MANDANTE}`}
        </p>
        <p className="mt-1 font-serif text-sm leading-snug text-ink">{body}</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="small-caps mt-2 min-h-11 text-[0.55rem] tracking-[0.18em] text-ink"
        >
          {open ? "Cerrar pliego" : "Ver pliego"}
        </button>
        {open ? (
          <ol className="mt-3 space-y-2 border-t border-rule/80 pt-3">
            {[
              `Mandante · ${MANDANTE}`,
              "Cargo · Jefe de obra del Proyecto 001",
              "Conectar la terraza aluvial con el cerro norte antes de la crecida.",
              "Amenaza · CRECIDA Q50 · cota +31,2 m · día 12 de sitio",
              "Tres frentes del pliego: CAMINO (llegar) · PUENTE (cruzar el Yuna) · MURO (sostener la ladera).",
              "Tú diriges. El reloj no espera. Sin hormigón no se vierte; sin acero no se arma.",
              "El tiempo construye. Tú decides qué merece ser construido.",
            ].map((line) => (
              <li key={line} className="font-serif text-sm leading-snug text-ink">
                {line}
              </li>
            ))}
          </ol>
        ) : null}
      </article>
    </div>
  );
}

function Canvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const start = useObra((s) => s.startSurvey);
  const sign = useObra((s) => s.signFirst);
  const select = useObra((s) => s.select);
  const setCoords = useObra((s) => s.setPendingCoords);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let cursor: { x: number; y: number } | null = null;
    let pal = readPalette(el);
    const resize = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      el.width = Math.max(1, Math.floor(w * dpr));
      el.height = Math.max(1, Math.floor(h * dpr));
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (el.parentElement) ro.observe(el.parentElement);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const parent = el.parentElement;
      if (!parent) return;
      pal = readPalette(el);
      const st = useObra.getState();
      drawSheet(ctx, parent.clientWidth, parent.clientHeight, st.game, pal, cursor, {
        visita: st.slot === "visita",
      });
    };
    raf = requestAnimationFrame(loop);
    const pos = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const move = (e: PointerEvent) => {
      cursor = pos(e);
      const parent = el.parentElement;
      if (!parent) return;
      const hit = hitTest(cursor.x, cursor.y, parent.clientWidth, parent.clientHeight, useObra.getState().game);
      el.style.cursor = hit ? "pointer" : "crosshair";
    };
    const leave = () => {
      cursor = null;
    };
    const down = (e: PointerEvent) => {
      if (e.button === 2) return;
      const parent = el.parentElement;
      if (!parent) return;
      const p = pos(e);
      const g = useObra.getState().game;
      const hit = hitTest(p.x, p.y, parent.clientWidth, parent.clientHeight, g);
      if (!hit) {
        select(null);
        return;
      }
      if (hit.type === "stake" || hit.type === "instruction") {
        if (g.survey < 1) start();
        return;
      }
      if (hit.type === "structure" && hit.id) {
        if (g.instruction === "define" && isPliego(hit.id)) sign(hit.id);
        else select(hit.id);
      }
    };
    const ctxmenu = (e: MouseEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setCoords({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("contextmenu", ctxmenu);
    void document.fonts?.ready.then(() => resize());
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("contextmenu", ctxmenu);
    };
  }, [start, sign, select, setCoords]);
  return (
    <canvas
      ref={ref}
      className="block h-full w-full touch-none"
      role="img"
      aria-label="Plano del Valle del Yuna"
    />
  );
}

export function Plano() {
  return (
    <section className="relative h-full min-h-0">
      <div className="absolute inset-0">
        <Canvas />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <PliegoCard />
            <Leyenda />
            <FrontTabs />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Events />
            <Ficha />
          </div>
        </div>
        <Seals />
      </div>
    </section>
  );
}
