/**
 * Cost V2 — presupuesto. qty × precio. No toca resources.dinero.
 * Precios solo aquí y en tables.ts.
 */
import { formatMeters, losaLados, muroLargo, vigaLargo, type Hueco, type Muro } from "./geometry.ts";
import type { SceneQty, Takeoff, TakeoffScene } from "./quantity.ts";
import { takeoffScene } from "./quantity.ts";
import {
  V2_CUADRILLA,
  V2_PIEZAS_CAP,
  V2_RETRABAJO,
  V2_UNIT_PRICES,
  type V2PriceKey,
} from "./tables.ts";

export type CostItem = {
  key: V2PriceKey;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type Presupuesto = {
  items: CostItem[];
  total: number;
};

function line(key: V2PriceKey, qty: number): CostItem {
  const spec = V2_UNIT_PRICES[key];
  return { key, qty, unit: spec.unit, unitPrice: spec.price, total: qty * spec.price };
}

export function presupuesto(q: Takeoff): Presupuesto {
  const items: CostItem[] = [
    line("excavacion", q.excavacionM3),
    line("hormigon", q.hormigonM3),
    line("acero", q.aceroT),
  ];
  let total = 0;
  for (const it of items) total += it.total;
  return { items, total };
}

export type HojaKey = "block6" | "mortero" | "hormigon" | "acero" | "albanil" | "retrabajo";

export type HojaLinea = {
  key: HojaKey;
  partida: string;
  qty: number;
  unit: string;
  pu: number;
  subtotal: number;
};

export type HojaPresupuesto = {
  lineas: HojaLinea[];
  total: number;
  empty: boolean;
};

const HOJA_ORDER: { key: Exclude<HojaKey, "retrabajo">; qty: (q: TakeoffScene) => number }[] = [
  { key: "block6", qty: (q) => q.blocksEst },
  { key: "mortero", qty: (q) => q.morteroM3 },
  { key: "hormigon", qty: (q) => q.hormigonM3 },
  { key: "acero", qty: (q) => q.aceroT },
  { key: "albanil", qty: (q) => q.albanilM2 },
];

export function hojaPresupuesto(q: TakeoffScene, opts: { rework?: boolean } = {}): HojaPresupuesto {
  const lineas: HojaLinea[] = HOJA_ORDER.map(({ key, qty }) => {
    const spec = V2_UNIT_PRICES[key];
    const n = Math.max(0, qty(q));
    return {
      key,
      partida: spec.label,
      qty: n,
      unit: spec.unit,
      pu: spec.price,
      subtotal: n * spec.price,
    };
  });
  let total = lineas.reduce((a, it) => a + it.subtotal, 0);
  if (opts.rework && total > 0) {
    const extra = total * V2_RETRABAJO.factor;
    lineas.push({
      key: "retrabajo",
      partida: "Retrabajo",
      qty: 1,
      unit: "gl",
      pu: extra,
      subtotal: extra,
    });
    total += extra;
  }
  return { lineas, total, empty: total <= 0 };
}

function vacia(): SceneQty {
  return { walls: [], openings: [], columns: [], footings: [], beams: [], slabs: [] };
}

function parcialDe(s: SceneQty): number {
  return hojaPresupuesto(takeoffScene(s)).total;
}

function seccion(a: number, b: number): string {
  return `${a.toFixed(2)} × ${b.toFixed(2)} m`;
}

export type PiezaKind = "muro" | "hueco" | "columna" | "zapata" | "viga" | "losa";

export type PiezaLinea = {
  id: string;
  kind: PiezaKind;
  medida: string;
  parcial: number;
};

function huecosDe(m: Muro, openings: readonly Hueco[]): Hueco[] {
  return openings.filter((h) => h.wallId === m.id);
}

/**
 * Piezas de la lámina. Ilustran; el total de la hoja sigue siendo hoja.total.
 * Muro = neto de sus vanos. Hueco = delta (suele restar). No sumar estas líneas.
 */
export function piezasDeEscena(s: SceneQty): PiezaLinea[] {
  const openings = s.openings ?? [];
  const out: PiezaLinea[] = [];
  for (const m of s.walls) {
    out.push({
      id: m.id,
      kind: "muro",
      medida: formatMeters(muroLargo(m)),
      parcial: parcialDe({ ...vacia(), walls: [m], openings: huecosDe(m, openings) }),
    });
    if (out.length >= V2_PIEZAS_CAP) return out.slice(0, V2_PIEZAS_CAP);
  }
  for (const h of openings) {
    const padre = s.walls.find((w) => w.id === h.wallId);
    let parcial = 0;
    if (padre) {
      const delMuro = huecosDe(padre, openings);
      const con = parcialDe({ ...vacia(), walls: [padre], openings: delMuro });
      const sin = parcialDe({ ...vacia(), walls: [padre], openings: delMuro.filter((x) => x.id !== h.id) });
      parcial = con - sin;
    }
    out.push({
      id: h.id,
      kind: "hueco",
      medida: `${h.kind} · ${formatMeters(h.ancho)}`,
      parcial,
    });
    if (out.length >= V2_PIEZAS_CAP) return out.slice(0, V2_PIEZAS_CAP);
  }
  for (const c of s.columns ?? []) {
    out.push({
      id: c.id,
      kind: "columna",
      medida: seccion(c.lado, c.lado),
      parcial: parcialDe({ ...vacia(), columns: [c] }),
    });
    if (out.length >= V2_PIEZAS_CAP) return out.slice(0, V2_PIEZAS_CAP);
  }
  for (const z of s.footings ?? []) {
    out.push({
      id: z.id,
      kind: "zapata",
      medida: seccion(z.lado, z.lado),
      parcial: parcialDe({ ...vacia(), footings: [z] }),
    });
    if (out.length >= V2_PIEZAS_CAP) return out.slice(0, V2_PIEZAS_CAP);
  }
  for (const v of s.beams ?? []) {
    out.push({
      id: v.id,
      kind: "viga",
      medida: `${formatMeters(vigaLargo(v))} · ${seccion(v.ancho, v.canto ?? 0.3)}`,
      parcial: parcialDe({ ...vacia(), beams: [v] }),
    });
    if (out.length >= V2_PIEZAS_CAP) return out.slice(0, V2_PIEZAS_CAP);
  }
  for (const l of s.slabs ?? []) {
    out.push({
      id: l.id,
      kind: "losa",
      medida: `${losaLados(l).largo.toFixed(2)} × ${losaLados(l).ancho.toFixed(2)} m`,
      parcial: parcialDe({ ...vacia(), slabs: [l] }),
    });
    if (out.length >= V2_PIEZAS_CAP) return out.slice(0, V2_PIEZAS_CAP);
  }
  return out;
}

/** N días de cuadrilla. Cero si no hay obra. */
export function diasCuadrilla(s: SceneQty): number {
  const q = takeoffScene(s);
  let largoMuroM = 0;
  for (const m of s.walls) largoMuroM += muroLargo(m);
  const huecos = (s.openings ?? []).length;
  const t = V2_CUADRILLA;
  const carga =
    Math.max(0, q.hormigonM3) / t.hormigonM3PerDia +
    Math.max(0, largoMuroM) / t.muroMPerDia +
    Math.max(0, q.losaM2) / t.losaM2PerDia +
    Math.max(0, huecos) * t.huecoDias;
  if (carga <= 1e-9) return 0;
  return Math.max(1, Math.ceil(carga - 1e-9));
}