import { formatInt } from "@/lib/obra/format";
import type { HojaPresupuesto } from "@/lib/obra/v2/cost";
import type { V2Placa } from "@/lib/obra/v2/persist-v2";
import { formatM2, formatMeters } from "@/lib/obra/v2/geometry";

export function PresupuestoV2({
  hoja,
  archive,
  enCurso,
  onAbrir,
}: {
  hoja: HojaPresupuesto;
  archive: V2Placa[];
  enCurso?: boolean;
  onAbrir?: (id: string) => void;
}) {
  const selladas = archive.filter((p) => p.estado === "cerrada" || p.estado === "ejecutada");
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" data-v2-presupuesto>
      <p className="small-caps text-[0.62rem] text-cyan">Hoja · NUEVA OBRA</p>
      <h2 className="font-serif text-3xl text-ink">Presupuesto</h2>
      {hoja.empty ? (
        <p className="mt-8 max-w-md font-serif text-lg italic leading-snug text-ink-soft">
          Dibuja en la lámina. Aquí sale el costo.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <thead>
              <tr className="small-caps border-b border-ink/40 text-[0.62rem] text-ink-soft">
                <th className="py-2 pr-3 font-medium">PARTIDA</th>
                <th className="py-2 pr-3 font-medium">CANTIDAD</th>
                <th className="py-2 pr-3 font-medium">UNIDAD</th>
                <th className="py-2 pr-3 font-medium">P.U.</th>
                <th className="py-2 font-medium">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {hoja.lineas.map((ln) => (
                <tr key={ln.key} className="border-b border-rule/70" data-partida={ln.key}>
                  <td className="py-3 pr-3 font-serif text-base text-ink">{ln.partida}</td>
                  <td className="py-3 pr-3 font-sans text-xl tabular-nums text-ink">{fmtQty(ln.qty)}</td>
                  <td className="py-3 pr-3 small-caps text-[0.62rem] text-ink-soft">{ln.unit}</td>
                  <td className="py-3 pr-3 font-sans text-base tabular-nums text-ink">{formatInt(ln.pu)}</td>
                  <td className="py-3 font-sans text-xl tabular-nums text-ink">{formatInt(ln.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small-caps mt-8 text-[0.62rem] text-cyan">Estimado RD$</p>
      <p className="font-sans text-4xl tabular-nums leading-none tracking-tight text-ink" data-estimado>
        {formatInt(hoja.total)}
      </p>
      <p className="mt-2 font-serif text-sm italic text-ink-soft">simulación, no cotización</p>
      {hoja.lineas.some((ln) => ln.key === "retrabajo") ? (
        <p data-retrabajo className="stamp stamp-flat mt-3 inline-block px-2.5 py-1.5 text-[0.62rem]">
          RETRABAJO
        </p>
      ) : null}

      <section className="mt-10" data-v2-archivo data-abierta="0">
        <p className="small-caps text-[0.62rem] text-cyan">Archivo V2</p>
        {enCurso ? (
          <p data-lamina-curso className="mt-3 font-serif text-sm italic text-ink">
            Lámina en curso · total RD$ {formatInt(hoja.total)}
          </p>
        ) : null}
        {selladas.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {selladas.map((p) => (
              <PlacaCard key={p.id} p={p} onAbrir={onAbrir} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-serif text-sm italic text-ink-soft">
            Cerrar lámina deja una placa aquí. No es el archivo del Q50.
          </p>
        )}
      </section>
    </div>
  );
}

function PlacaCard({ p, onAbrir }: { p: V2Placa; onAbrir?: (id: string) => void }) {
  return (
    <li className="border border-ink/30 bg-paper" data-placa={p.id} data-estado={p.estado}>
      <button
        type="button"
        data-abrir={p.id}
        onClick={() => onAbrir?.(p.id)}
        className="w-full min-h-11 px-3 py-3 text-left"
      >
        <p className="small-caps text-[0.62rem] text-stamp">
          {p.id} · {p.estado.toUpperCase()}
        </p>
        <p className="font-serif text-lg text-ink">{formatFecha(p.closedAt)}</p>
        <p className="mt-1 font-sans text-sm tabular-nums text-ink">
          {formatMeters(p.largoMuroM)} muro · {formatM2(p.losaM2)} losa
        </p>
        <p className="font-sans text-xl tabular-nums text-ink">{formatInt(p.estimado)}</p>
        <p className="mt-1 small-caps text-[0.52rem] leading-snug text-ink-soft">
          {p.recuento.muros} muros · {p.recuento.vanos} vanos · {p.recuento.columnas} col · {p.recuento.zapatas} zap ·{" "}
          {p.recuento.vigas} vigas · {p.recuento.losas} losas
        </p>
        <p className="mt-2 small-caps text-[0.62rem] text-cyan">Abrir placa</p>
      </button>
    </li>
  );
}

function fmtQty(n: number): string {
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-6) return formatInt(n);
  return n.toFixed(2);
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" });
}
