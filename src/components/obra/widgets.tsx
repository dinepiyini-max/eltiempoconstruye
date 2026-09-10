import { useState } from "react";
import { HINTS, ORDER } from "@/game/catalog";
import { fmt } from "@/game/sim";
import { useObra } from "@/game/store";
import type { OrderKind } from "@/game/types";

export function NuevaPartida({ compact = false }: { compact?: boolean }) {
  const reset = useObra((s) => s.resetValley);
  const n = useObra((s) => s.game.libreta.length);
  const [ask, setAsk] = useState(false);
  const [keep, setKeep] = useState(true);
  if (ask) {
    return (
      <div className="flex max-w-sm flex-col gap-2 border border-ink/30 bg-paper px-3 py-2">
        <p className="font-serif text-sm leading-snug text-ink">
          Se borra el valle, el pliego y el reloj.{" "}
          {n ? `${n} notas en la libreta.` : "Libreta vacía."}
        </p>
        <label className="flex min-h-11 items-center gap-2 font-serif text-sm text-ink">
          <input
            type="checkbox"
            checked={keep}
            onChange={(e) => setKeep(e.target.checked)}
          />
          Conservar notas de campo
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              reset(keep);
              setAsk(false);
              setKeep(true);
            }}
            className="stamp min-h-11 px-3 py-1 text-[0.55rem]"
          >
            CONFIRMAR
          </button>
          <button
            type="button"
            onClick={() => setAsk(false)}
            className="small-caps min-h-11 border border-ink/30 px-3 text-[0.55rem]"
          >
            NO
          </button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setAsk(true)}
      className={`small-caps min-h-11 border border-ink/40 px-2 text-[0.52rem] ${compact ? "" : "px-3"}`}
    >
      NUEVA PARTIDA
    </button>
  );
}

export function Pedido({
  kind,
  dinero,
  onOrder,
  compact,
}: {
  kind: OrderKind;
  dinero: number;
  onOrder: (k: OrderKind) => void;
  compact?: boolean;
}) {
  const spec = ORDER[kind];
  const ok = dinero >= spec.cost;
  const label = kind === "hormigon" ? "Pedir hormigón" : "Pedir acero";
  return (
    <button
      type="button"
      disabled={!ok}
      onClick={() => onOrder(kind)}
      title={`${label} · ${spec.qty} ${spec.unit} · ${fmt(spec.cost)}`}
      aria-label={`${label}, ${spec.qty} ${spec.unit}, cuesta ${fmt(spec.cost)}`}
      className={`small-caps min-h-11 border px-2 text-left text-[0.52rem] tracking-[0.14em] ${ok ? "border-ink/40 text-ink" : "border-rule text-faint"} ${compact ? "w-full" : ""}`}
    >
      {compact ? (
        <span>
          {label} · {spec.qty} {spec.unit} · {fmt(spec.cost)}
        </span>
      ) : (
        <span>
          {label} · {spec.qty} {spec.unit}
        </span>
      )}
    </button>
  );
}

export function Almacen({ compact = false }: { compact?: boolean }) {
  const dinero = useObra((s) => s.game.resources.dinero);
  const order = useObra((s) => s.order);
  return (
    <div
      className={`flex ${compact ? "flex-col items-stretch gap-1" : "flex-wrap items-center gap-2"}`}
    >
      <Pedido kind="hormigon" dinero={dinero} onOrder={order} compact={compact} />
      <Pedido kind="acero" dinero={dinero} onOrder={order} compact={compact} />
    </div>
  );
}

export function Meter({
  k,
  v,
  hint,
}: {
  k: string;
  v: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col" title={hint ?? HINTS[k]}>
      <span className="small-caps text-[0.55rem] text-ink-soft">{k}</span>
      <span className="font-sans text-sm tabular-nums text-ink">{v}</span>
    </div>
  );
}

export function OrderMeter({
  k,
  v,
  kind,
  dinero,
}: {
  k: string;
  v: string;
  kind: OrderKind;
  dinero: number;
}) {
  const order = useObra((s) => s.order);
  const spec = ORDER[kind];
  const ok = dinero >= spec.cost;
  const label = kind === "hormigon" ? "Pedir hormigón" : "Pedir acero";
  return (
    <button
      type="button"
      disabled={!ok}
      onClick={() => order(kind)}
      title={`${label} · ${spec.qty} ${spec.unit} · ${fmt(spec.cost)}`}
      aria-label={`${label}, ${spec.qty} ${spec.unit}, cuesta ${fmt(spec.cost)}`}
      className="flex min-h-11 flex-col text-left"
    >
      <span className="small-caps text-[0.55rem] text-ink-soft">{k}</span>
      <span className="font-sans text-sm tabular-nums text-ink">{v}</span>
      <span
        className={`small-caps text-[0.5rem] tracking-[0.14em] ${ok ? "text-rust" : "text-faint"}`}
      >
        {label}
      </span>
    </button>
  );
}

export function Pair({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-rule/50 pb-1">
      <dt className="small-caps text-[0.58rem] text-ink-soft">{k}</dt>
      <dd className={`text-right ${accent ? "text-rust" : "text-ink"}`}>{v}</dd>
    </div>
  );
}

export function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="small-caps text-[0.55rem] text-ink-soft">{k}</dt>
      <dd className="tabular-nums text-ink">{v}</dd>
    </div>
  );
}

export function ArchiveMark({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 64" className="mt-3 w-full text-ink" aria-hidden>
      {id === "camino" && (
        <path
          d="M8 48 C40 44 70 28 110 30 S170 48 192 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
      )}
      {id === "puente" && (
        <>
          <rect x="20" y="28" width="160" height="6" fill="currentColor" />
          <rect x="50" y="34" width="6" height="18" fill="currentColor" />
          <rect x="144" y="34" width="6" height="18" fill="currentColor" />
        </>
      )}
      {id === "muro" && (
        <path
          d="M16 48 L60 28 L120 24 L184 32 L184 48 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {id === "cimentacion" && (
        <>
          <rect x="30" y="36" width="28" height="12" fill="currentColor" />
          <rect x="86" y="36" width="28" height="12" fill="currentColor" />
          <rect x="142" y="36" width="28" height="12" fill="currentColor" />
        </>
      )}
      {id === "planta" && (
        <>
          <rect x="40" y="24" width="80" height="28" fill="none" stroke="currentColor" />
          <circle cx="140" cy="38" r="12" fill="none" stroke="currentColor" />
          <circle cx="168" cy="38" r="8" fill="none" stroke="currentColor" />
        </>
      )}
      {id === "viaducto" && (
        <>
          <path d="M10 28 L190 28" stroke="currentColor" strokeWidth="3" />
          <rect x="40" y="28" width="4" height="24" fill="currentColor" />
          <rect x="98" y="28" width="4" height="24" fill="currentColor" />
          <rect x="156" y="28" width="4" height="24" fill="currentColor" />
        </>
      )}
      {(id === "ensayo" || id === "valle") && (
        <>
          <rect x="70" y="16" width="60" height="36" fill="none" stroke="currentColor" />
          <path d="M70 16 L100 4 L130 16" fill="none" stroke="currentColor" />
        </>
      )}
    </svg>
  );
}
