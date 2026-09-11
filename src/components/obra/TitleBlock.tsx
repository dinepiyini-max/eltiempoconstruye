import { CLOCK_HOLD_LINE, GLOSS, PACE_CAPTION, PHASE_LABEL, REGIME_CAPTION, RESOURCE_HINT, SUPPLY } from "@/lib/obra/catalog";
import { clockParts, formatInt } from "@/lib/obra/format";
import { CARGO, MANDANTE, PROYECTO, TESIS } from "@/lib/obra/pliego";
import { floodLine, hasSignedFront } from "@/lib/obra/sim";
import { useObra } from "@/lib/obra/store";
import type { ClockPace, PageId } from "@/lib/obra/types";
import { NuevaPartida } from "./NuevaPartida";

const TABS: { id: PageId; label: string }[] = [
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

export function TitleBlock() {
  const page = useObra((s) => s.game.page);
  const phase = useObra((s) => s.game.phase);
  const regime = useObra((s) => s.game.regime);
  const siteMinutes = useObra((s) => s.game.siteMinutes);
  const r = useObra((s) => s.game.resources);
  const lastNotice = useObra((s) => s.game.lastNotice);
  const floodStatus = useObra((s) => s.game.floodStatus);
  const fatigue = useObra((s) => s.game.fatigue);
  const prestigio = useObra((s) => s.game.prestigio);
  const clockPace = useObra((s) => s.game.clockPace);
  const libretaOpen = useObra((s) => s.game.libretaOpen);
  const noteFocus = useObra((s) => s.noteFocus);
  const game = useObra((s) => s.game);
  const slot = useObra((s) => s.slot);
  const setPage = useObra((s) => s.setPage);
  const toggleRegime = useObra((s) => s.toggleRegime);
  const restoreVisita = useObra((s) => s.restoreVisita);
  const setClockPace = useObra((s) => s.setClockPace);
  const toggleLibreta = useObra((s) => s.toggleLibreta);
  const clock = clockParts(siteMinutes);
  const turno = regime === "turno";
  const visita = slot === "visita";
  const flood = floodLine(game);
  const closed = floodStatus === "incumplido" || floodStatus === "a-salvo";
  const clockHeld = !hasSignedFront(game);
  const paceLine = clockHeld ? CLOCK_HOLD_LINE : PACE_CAPTION;

  return (
    <header className="relative z-20 border-b border-rule/80 bg-paper/90 px-3 py-2 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-serif text-3xl font-semibold tracking-[0.18em] text-ink sm:text-4xl">OBRA</h1>
            {visita ? <span className="stamp px-1.5 py-0.5 text-[0.5rem]">VISITA</span> : null}
          </div>
          <p className="small-caps mt-0.5 text-[0.55rem] tracking-[0.12em] text-cyan">
            {CARGO} · {PROYECTO} · {MANDANTE}
          </p>
          <p className="mt-0.5 max-w-xl font-serif text-sm italic text-ink-soft sm:text-[0.95rem]">{TESIS}</p>
          <p className="mt-1 small-caps text-[0.5rem] tracking-[0.12em] text-ink-soft">{GLOSS.sitio}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-1 pt-1" aria-label="Hojas">
          {TABS.map((t) => {
            const on = page === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPage(t.id)}
                className={`small-caps min-h-11 px-3 text-[0.7rem] transition-colors duration-150 ${
                  on ? "text-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                <span className={`border-b pb-1 ${on ? "border-rust" : "border-transparent"}`}>{t.label}</span>
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
            className={`small-caps text-[0.58rem] ${
              floodStatus === "incumplido" ? "text-stamp" : floodStatus === "a-salvo" ? "text-cyan" : "text-ink-soft"
            }`}
          >
            {flood}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-[0.7rem]">
          <Metric k="Dinero" v={formatInt(r.dinero)} />
          <Metric k="Horas-hombre" v={formatInt(r.horasHombre)} hint={RESOURCE_HINT["Horas-hombre"]} />
          <SupplyMetric k="Hormigón" v={`${formatInt(r.hormigon)} m³`} kind="hormigon" dinero={r.dinero} />
          <SupplyMetric k="Acero" v={`${formatInt(r.acero)} t`} kind="acero" dinero={r.dinero} />
          <Metric k="Conocimiento" v={formatInt(r.conocimiento)} hint={RESOURCE_HINT.Conocimiento} />
          <Metric k="Prestigio" v={formatInt(prestigio)} hint={RESOURCE_HINT.Prestigio} />
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={toggleRegime}
              title={turno ? REGIME_CAPTION.turno : REGIME_CAPTION.siempre}
              aria-label={turno ? REGIME_CAPTION.turno : REGIME_CAPTION.siempre}
              className={`stamp min-h-11 px-2 py-1 text-[0.58rem] ${turno ? "stamp-turno" : "stamp-siempre"}`}
            >
              {turno ? "TURNO DE OBRA" : "SIEMPRE ABIERTA"}
            </button>
            {!turno ? (
              <span className="small-caps text-[0.48rem] text-stamp">Fatiga {Math.round(fatigue * 100)}%</span>
            ) : null}
            {visita ? (
              <button
                type="button"
                onClick={restoreVisita}
                className="small-caps min-h-11 px-2 text-[0.52rem] text-ink-soft"
              >
                RESTAURAR VISITA
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule/50 pt-2">
        <span className="small-caps text-[0.5rem] text-ink-soft" title={PACE_CAPTION}>
          Reloj
        </span>
        {PACES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setClockPace(p.id)}
            disabled={clockHeld && p.id !== "pausa"}
            title={paceLine}
            className={`small-caps min-h-11 px-2 text-[0.52rem] ${
              clockPace === p.id ? "border-b border-rust text-ink" : "text-ink-soft"
            } disabled:text-faint`}
          >
            {p.label}
          </button>
        ))}
        <span className="font-serif text-xs italic text-ink-soft">{paceLine}</span>
        {noteFocus ? (
          <span className="font-serif text-xs italic text-stamp">Campo abierto · el reloj espera tu nota.</span>
        ) : null}
        {closed ? <NuevaPartida compact /> : null}
      </div>
      <p className="mt-1 font-serif text-xs leading-snug text-ink-soft">
        {GLOSS.q50} · {GLOSS.top} · {GLOSS.cuello}
      </p>

      {lastNotice ? (
        <p className="mt-2 max-w-3xl font-serif text-sm leading-snug text-rust">{lastNotice}</p>
      ) : null}
      {floodStatus === "incumplido" ? (
        <p className="mt-1 font-serif text-sm leading-snug text-stamp">
          PLAZO INCUMPLIDO. El valle se lava. NUEVA PARTIDA en el cajetín o en ARCHIVO.
        </p>
      ) : null}
    </header>
  );
}

function Metric({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="flex flex-col" title={hint ?? RESOURCE_HINT[k]}>
      <span className="small-caps text-[0.55rem] text-ink-soft">{k}</span>
      <span className="font-sans text-sm tabular-nums text-ink">{v}</span>
    </div>
  );
}

function SupplyMetric({
  k,
  v,
  kind,
  dinero,
}: {
  k: string;
  v: string;
  kind: "hormigon" | "acero";
  dinero: number;
}) {
  const order = useObra((s) => s.order);
  const spec = SUPPLY[kind];
  const can = dinero >= spec.cost;
  const label = kind === "hormigon" ? "Pedir hormigón" : "Pedir acero";
  return (
    <button
      type="button"
      disabled={!can}
      onClick={() => order(kind)}
      title={`${label} · ${spec.qty} ${spec.unit} · ${formatInt(spec.cost)}`}
      aria-label={`${label}, ${spec.qty} ${spec.unit}, cuesta ${formatInt(spec.cost)}`}
      className="flex min-h-11 flex-col text-left"
    >
      <span className="small-caps text-[0.55rem] text-ink-soft">{k}</span>
      <span className="font-sans text-sm tabular-nums text-ink">{v}</span>
      <span className={`small-caps text-[0.5rem] tracking-[0.14em] ${can ? "text-rust" : "text-faint"}`}>{label}</span>
    </button>
  );
}
