import { SUPPLY } from "@/lib/obra/catalog";
import { formatInt } from "@/lib/obra/format";
import { useObra } from "@/lib/obra/store";

/** Pedir hormigón o acero. Siempre a la vista: no hay que cazar un cuello. */
export function Pedidos({ compact = false }: { compact?: boolean }) {
  const dinero = useObra((s) => s.game.resources.dinero);
  const order = useObra((s) => s.order);

  return (
    <div className={`flex ${compact ? "flex-col items-stretch gap-1" : "flex-wrap items-center gap-2"}`}>
      <Pedido kind="hormigon" dinero={dinero} onOrder={order} compact={compact} />
      <Pedido kind="acero" dinero={dinero} onOrder={order} compact={compact} />
    </div>
  );
}

function Pedido({
  kind,
  dinero,
  onOrder,
  compact,
}: {
  kind: "hormigon" | "acero";
  dinero: number;
  onOrder: (k: "hormigon" | "acero") => void;
  compact: boolean;
}) {
  const spec = SUPPLY[kind];
  const can = dinero >= spec.cost;
  const label = kind === "hormigon" ? "Pedir hormigón" : "Pedir acero";
  return (
    <button
      type="button"
      disabled={!can}
      onClick={() => onOrder(kind)}
      title={`${label} · ${spec.qty} ${spec.unit} · ${formatInt(spec.cost)}`}
      aria-label={`${label}, ${spec.qty} ${spec.unit}, cuesta ${formatInt(spec.cost)}`}
      className={`small-caps min-h-11 border px-2 text-left text-[0.52rem] tracking-[0.14em] ${
        can ? "border-ink/40 text-ink" : "border-rule text-faint"
      } ${compact ? "w-full" : ""}`}
    >
      {compact ? (
        <span>
          {kind === "hormigon" ? "Pedir hormigón" : "Pedir acero"} · {spec.qty} {spec.unit} · {formatInt(spec.cost)}
        </span>
      ) : (
        <span>
          {kind === "hormigon" ? "Pedir hormigón" : "Pedir acero"} · {spec.qty} {spec.unit}
        </span>
      )}
    </button>
  );
}
