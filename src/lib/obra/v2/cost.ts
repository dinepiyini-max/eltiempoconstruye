/**
 * Cost V2 — presupuesto. qty × precio. No toca resources.dinero.
 * Precios solo aquí y en tables.ts.
 */
import type { Takeoff, TakeoffScene } from "./quantity.ts";
import { V2_UNIT_PRICES, type V2PriceKey } from "./tables.ts";

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

export type HojaKey = "block6" | "mortero" | "hormigon" | "acero" | "albanil";

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

const HOJA_ORDER: { key: HojaKey; qty: (q: TakeoffScene) => number }[] = [
  { key: "block6", qty: (q) => q.blocksEst },
  { key: "mortero", qty: (q) => q.morteroM3 },
  { key: "hormigon", qty: (q) => q.hormigonM3 },
  { key: "acero", qty: (q) => q.aceroT },
  { key: "albanil", qty: (q) => q.albanilM2 },
];

export function hojaPresupuesto(q: TakeoffScene): HojaPresupuesto {
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
  const total = lineas.reduce((a, it) => a + it.subtotal, 0);
  return { lineas, total, empty: total <= 0 };
}