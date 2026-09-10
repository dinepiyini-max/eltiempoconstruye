import { useEffect } from "react";
import {
  CARGO,
  CLOCK_HINT,
  COPY,
  HINTS,
  MANDANTE,
  PHASE_LABEL,
  PROYECTO,
  REGIME_HINT,
} from "@/game/catalog";
import { clockOf, floodLine, fmt } from "@/game/sim";
import { useObra } from "@/game/store";
import type { ClockPace, Page, Slot } from "@/game/types";
import { Libreta } from "./libreta";
import { ArchivoPage, ContratosPage, ObraPage } from "./pages";
import { Plano } from "./plano";
import { Meter, NuevaPartida, OrderMeter } from "./widgets";

const SHEETS: { id: Page; label: string }[] = [
  { id: "plano", label: "PLANO" },
  { id: "obra", label: "OBRA" },
  { id: "contratos", label: "CONTRATOS" },
  { id: "archivo", label: "ARCHIVO" },
];

const PACES: { id: ClockPace; label: string }[] = [
  { id: "normal", label: "NORMAL" },
  { id: "lento", label: "LENTO" },
  { id: "pausa", label: "PAUSA" },
];

function Ticker({ slot }: { slot: Slot }) {
  const hydrate = useObra((s) => s.hydrate);
  const catchUp = useObra((s) => s.catchUp);
  const advance = useObra((s) => s.advance);
  const flush = useObra((s) => s.flush);
  useEffect(() => {
    hydrate(slot);
  }, [hydrate, slot]);
  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.visibilityState === "hidden") {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      advance(dt);
    };
    raf = requestAnimationFrame(loop);
    const vis = () => {
      if (document.visibilityState === "hidden") flush();
      else {
        catchUp();
        last = performance.now();
      }
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", flush);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [advance, flush, catchUp]);
  return null;
}

function Absence() {
  const line = useObra((s) => s.game.absence?.line);
  const dismiss = useObra((s) => s.dismissAbsence);
  if (!line) return null;
  return (
    <button
      type="button"
      onClick={dismiss}
      className="relative z-20 flex w-full items-baseline gap-3 border-b border-rule/80 bg-paper px-3 py-2 text-left sm:px-5"
    >
      <span className="stamp shrink-0 px-1.5 py-0.5 text-[0.48rem]">AUSENTE</span>
      <span className="min-w-0 flex-1 truncate font-serif text-base italic text-ink">{line}</span>
    </button>
  );
}

function Header() {
  const page = useObra((s) => s.game.page);
  const phase = useObra((s) => s.game.phase);
  const regime = useObra((s) => s.game.regime);
  const siteMinutes = useObra((s) => s.game.siteMinutes);
  const resources = useObra((s) => s.game.resources);
  const notice = useObra((s) => s.game.lastNotice);
  const flood = useObra((s) => s.game.floodStatus);
  const fatigue = useObra((s) => s.game.fatigue);
  const prestigio = useObra((s) => s.game.prestigio);
  const pace = useObra((s) => s.game.clockPace);
  const libretaOpen = useObra((s) => s.game.libretaOpen);
  const noteFocus = useObra((s) => s.noteFocus);
  const game = useObra((s) => s.game);
  const slot = useObra((s) => s.slot);
  const setPage = useObra((s) => s.setPage);
  const toggleRegime = useObra((s) => s.toggleRegime);
  const restore = useObra((s) => s.restoreVisita);
  const setPace = useObra((s) => s.setClockPace);
  const toggleLibreta = useObra((s) => s.toggleLibreta);
  const clock = clockOf(siteMinutes);
  const turno = regime === "turno";
  const visita = slot === "visita";
  const crecida = floodLine(game);
  const closed = flood === "incumplido" || flood === "a-salvo";
  return (
    <header className="relative z-20 border-b border-rule/80 bg-paper/90 px-3 py-2 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-serif text-3xl font-semibold tracking-[0.18em] text-ink sm:text-4xl">
              OBRA
            </h1>
            {visita ? (
              <span className="stamp px-1.5 py-0.5 text-[0.5rem]">VISITA</span>
            ) : null}
          </div>
          <p className="small-caps mt-0.5 text-[0.55rem] tracking-[0.12em] text-cyan">
            {CARGO} · {PROYECTO} · {MANDANTE}
          </p>
          <p className="mt-0.5 max-w-xl font-serif text-sm italic text-ink-soft sm:text-[0.95rem]">
            {COPY.pliego.startsWith("PLIEGO")
              ? "El tiempo construye. Tú decides qué merece ser construido."
              : "El tiempo construye. Tú decides qué merece ser construido."}
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-1 pt-1" aria-label="Hojas">
          {SHEETS.map((s) => {
            const on = page === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setPage(s.id)}
                className={`small-caps min-h-11 px-3 text-[0.7rem] transition-colors duration-150 ${on ? "text-ink" : "text-ink-soft hover:text-ink"}`}
              >
                <span className={`border-b pb-1 ${on ? "border-rust" : "border-transparent"}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleLibreta}
            className="small-caps min-h-11 px-3 text-[0.7rem] text-ink-soft hover:text-ink"
            aria-pressed={libretaOpen}
          >
            {libretaOpen ? "LIBRETA ▾" : "LIBRETA ▸"}
          </button>
        </nav>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-t border-rule/60 pt-2">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-ink">
          <span className="small-caps text-[0.62rem] text-cyan">{PHASE_LABEL[phase]}</span>
          <span className="font-sans text-sm tabular-nums tracking-wide">{clock.label}</span>
          <span
            title={HINTS["CRECIDA Q50"]}
            className={`small-caps text-[0.58rem] ${flood === "incumplido" ? "text-stamp" : flood === "a-salvo" ? "text-cyan" : "text-ink-soft"}`}
          >
            {crecida}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-[0.7rem]">
          <Meter k="Dinero" v={fmt(resources.dinero)} />
          <Meter k="Horas-hombre" v={fmt(resources.horasHombre)} hint={HINTS["Horas-hombre"]} />
          <OrderMeter
            k="Hormigón"
            v={`${fmt(resources.hormigon)} m³`}
            kind="hormigon"
            dinero={resources.dinero}
          />
          <OrderMeter
            k="Acero"
            v={`${fmt(resources.acero)} t`}
            kind="acero"
            dinero={resources.dinero}
          />
          <Meter k="Conocimiento" v={fmt(resources.conocimiento)} hint={HINTS.Conocimiento} />
          <Meter k="Prestigio" v={fmt(prestigio)} hint={HINTS.Prestigio} />
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={toggleRegime}
              title={turno ? REGIME_HINT.turno : REGIME_HINT.siempre}
              aria-label={turno ? REGIME_HINT.turno : REGIME_HINT.siempre}
              className={`stamp min-h-11 px-2 py-1 text-[0.58rem] ${turno ? "stamp-turno" : "stamp-siempre"}`}
            >
              {turno ? "TURNO DE OBRA" : "SIEMPRE ABIERTA"}
            </button>
            {turno ? null : (
              <span className="small-caps text-[0.48rem] text-stamp">
                Fatiga {Math.round(fatigue * 100)}%
              </span>
            )}
            {visita ? (
              <button
                type="button"
                onClick={restore}
                className="small-caps min-h-11 px-2 text-[0.52rem] text-ink-soft"
              >
                RESTAURAR VISITA
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule/50 pt-2">
        <span className="small-caps text-[0.5rem] text-ink-soft" title={CLOCK_HINT}>
          Reloj
        </span>
        {PACES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPace(p.id)}
            title={CLOCK_HINT}
            className={`small-caps min-h-11 px-2 text-[0.52rem] ${pace === p.id ? "border-b border-rust text-ink" : "text-ink-soft"}`}
          >
            {p.label}
          </button>
        ))}
        <span className="font-serif text-xs italic text-ink-soft">{CLOCK_HINT}</span>
        {noteFocus ? (
          <span className="font-serif text-xs italic text-stamp">
            Campo abierto · el reloj espera tu nota.
          </span>
        ) : null}
        {closed ? <NuevaPartida compact /> : null}
      </div>
      {notice ? (
        <p className="mt-2 max-w-3xl font-serif text-sm leading-snug text-rust">{notice}</p>
      ) : null}
      {flood === "incumplido" ? (
        <p className="mt-1 font-serif text-sm leading-snug text-stamp">
          PLAZO INCUMPLIDO. El valle se lava. NUEVA PARTIDA en el cajetín o en ARCHIVO.
        </p>
      ) : null}
    </header>
  );
}

export function ObraApp({ slot }: { slot: Slot }) {
  const page = useObra((s) => s.game.page);
  const hydrated = useObra((s) => s.hydrated);
  const toggle = useObra((s) => s.toggleLibreta);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      const t = e.target as HTMLElement | null;
      if (
        !t ||
        (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA" && !t.isContentEditable)
      ) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <Ticker slot={slot} />
      {hydrated ? (
        <>
          <Header />
          <Absence />
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <main className="relative min-h-0 min-w-0 flex-1">
              <div
                className={`absolute inset-0 ${page === "plano" ? "" : "invisible pointer-events-none"}`}
                aria-hidden={page !== "plano"}
              >
                <Plano />
              </div>
              {page === "plano" ? null : (
                <div className="absolute inset-0 z-10 overflow-auto bg-paper">
                  {page === "obra" ? <ObraPage /> : null}
                  {page === "contratos" ? <ContratosPage /> : null}
                  {page === "archivo" ? <ArchivoPage /> : null}
                </div>
              )}
            </main>
            <Libreta />
          </div>
        </>
      ) : (
        <header className="relative z-20 border-b border-rule/80 bg-paper/90 px-3 py-2 sm:px-5">
          <h1 className="font-serif text-3xl font-semibold tracking-[0.18em] text-ink sm:text-4xl">
            OBRA
          </h1>
          <p className="mt-0.5 max-w-xl font-serif text-sm italic text-ink-soft sm:text-[0.95rem]">
            El tiempo construye. Tú decides qué merece ser construido.
          </p>
        </header>
      )}
    </div>
  );
}
