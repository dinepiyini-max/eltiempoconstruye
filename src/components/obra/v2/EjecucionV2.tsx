import { useEffect } from "react";
import {
  FRENTE_LABEL,
  assembleFrentes,
  formatLaminaClock,
  scopeFromScene,
  type FrenteVista,
} from "@/lib/obra/v2/clock";
import { diasCuadrilla } from "@/lib/obra/v2/cost";
import { useNueva } from "@/lib/obra/v2/store";

export function EjecucionV2() {
  const walls = useNueva((s) => s.walls);
  const openings = useNueva((s) => s.openings);
  const columns = useNueva((s) => s.columns);
  const footings = useNueva((s) => s.footings);
  const beams = useNueva((s) => s.beams);
  const slabs = useNueva((s) => s.slabs);
  const clock = useNueva((s) => s.clock);
  const notice = useNueva((s) => s.notice);
  const page = useNueva((s) => s.page);
  const iniciarEjecucion = useNueva((s) => s.iniciarEjecucion);
  const setPace = useNueva((s) => s.setPace);
  const tickClock = useNueva((s) => s.tickClock);
  const resumeClock = useNueva((s) => s.resumeClock);

  const scene = { walls, openings, columns, footings, beams, slabs };
  const frentes = assembleFrentes(scopeFromScene(scene), clock.done);
  const hasWork = frentes.some((f) => f.present);
  const done = frentes.filter((f) => f.present).every((f) => f.status === "done") && hasWork;
  const dias = diasCuadrilla(scene);
  const diasLabel = dias === 1 ? "1 día" : `${dias} días`;
  const recuento = recuentoPiezas(scene);

  useEffect(() => {
    if (page !== "ejecucion") return;
    resumeClock();
    let raf = 0;
    const loop = () => {
      tickClock(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onVis = () => {
      if (document.visibilityState === "visible") resumeClock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [page, tickClock, resumeClock]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" data-v2-ejecucion>
      <p className="small-caps text-[0.62rem] text-cyan">Reloj de lámina · no es el Q50</p>
      <h2 className="font-serif text-3xl text-ink">Ejecución</h2>
      <p className="mt-1 font-serif text-sm italic text-ink-soft">Este reloj es de esta lámina. El río no corre aquí.</p>
      <p className="mt-3 font-sans text-4xl tabular-nums leading-none text-ink" data-reloj-v2>
        {formatLaminaClock(clock.laminaMs)}
      </p>
      <p className="small-caps mt-2 text-[0.62rem] text-ink-soft">
        {clock.running ? (clock.pace === "normal" ? "NORMAL" : "PAUSA") : "PAUSA hasta INICIAR EJECUCIÓN"}
      </p>
      {hasWork ? (
        <p className="mt-3 font-serif text-lg text-ink" data-duracion data-dias={dias}>
          Duración est. · {diasLabel} de cuadrilla
        </p>
      ) : null}
      {recuento ? (
        <p className="mt-1 font-serif text-sm text-ink-soft" data-recuento>
          {recuento}
        </p>
      ) : null}
      <p className="mt-1 max-w-lg font-serif text-sm italic leading-snug text-ink-soft" data-frentes-nota>
        Cimentación, estructura y albañilería: cada frente espera al anterior.
      </p>

      {notice ? (
        <p data-v2-notice className="mt-4 border border-cyan/40 bg-paper px-3 py-2 font-serif text-sm italic text-cyan">
          {notice}
        </p>
      ) : null}

      {clock.rework ? (
        <p data-retrabajo className="stamp stamp-flat mt-4 inline-block px-2.5 py-1.5 text-[0.62rem] tracking-[0.14em]">
          RETRABAJO
        </p>
      ) : null}

      <ul className="mt-6 grid gap-3">
        {frentes.map((f) => (
          <FrenteRow key={f.id} f={f} />
        ))}
      </ul>

      {done ? (
        <p className="mt-6 font-serif text-lg italic text-ink" data-construyo>
          Se construyó en {diasLabel} de juego.
        </p>
      ) : null}

      {!clock.running ? (
        <button
          type="button"
          data-tool="iniciar ejecución"
          onClick={iniciarEjecucion}
          disabled={!hasWork}
          className="small-caps mt-8 min-h-14 w-full border border-ink bg-paper px-4 text-[0.78rem] tracking-[0.16em] text-ink disabled:border-rule disabled:text-faint"
        >
          INICIAR EJECUCIÓN
        </button>
      ) : (
        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            data-tool="pausa"
            onClick={() => setPace("pausa")}
            className={`small-caps min-h-12 px-4 text-[0.7rem] tracking-[0.14em] ${
              clock.pace === "pausa" ? "border-b-2 border-rust text-ink" : "text-ink-soft"
            }`}
          >
            PAUSA
          </button>
          <button
            type="button"
            data-tool="normal"
            onClick={() => setPace("normal")}
            className={`small-caps min-h-12 px-4 text-[0.7rem] tracking-[0.14em] ${
              clock.pace === "normal" ? "border-b-2 border-rust text-ink" : "text-ink-soft"
            }`}
          >
            NORMAL
          </button>
        </div>
      )}
      {!hasWork ? (
        <p className="mt-4 font-serif text-sm italic text-ink-soft">Dibuja en la lámina para abrir un frente.</p>
      ) : null}
    </div>
  );
}

function recuentoPiezas(s: {
  walls: unknown[];
  openings: unknown[];
  columns: unknown[];
  footings: unknown[];
  beams: unknown[];
  slabs: unknown[];
}): string {
  const n =
    s.walls.length + s.openings.length + s.columns.length + s.footings.length + s.beams.length + s.slabs.length;
  if (n === 0) return "";
  const bits: string[] = [`${n} ${n === 1 ? "pieza" : "piezas"}`];
  if (s.openings.length) bits.push(`${s.openings.length} ${s.openings.length === 1 ? "vano" : "vanos"}`);
  return bits.join(" · ");
}

function FrenteRow({ f }: { f: FrenteVista }) {
  return (
    <li data-frente={f.id} className="border border-ink/20 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="small-caps text-[0.7rem] tracking-[0.14em] text-ink">{FRENTE_LABEL[f.id]}</p>
        <p className="font-sans text-2xl tabular-nums text-ink">
          {f.present ? `${Math.round(f.pct)}%` : "N/A"}
        </p>
      </div>
      {f.present ? (
        <>
          <div className="mt-2 h-2 w-full bg-rule/50">
            <div className="h-2 bg-rust" style={{ width: `${f.pct}%` }} />
          </div>
          <p className="mt-1 small-caps text-[0.52rem] text-ink-soft">
            {f.status === "locked" ? "espera al frente anterior" : f.status === "done" ? "cerrado" : "activo"}
          </p>
        </>
      ) : (
        <p className="mt-1 font-serif text-sm italic text-ink-soft">{f.naLine}</p>
      )}
    </li>
  );
}
