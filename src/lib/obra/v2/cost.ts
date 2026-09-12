/**
 * Cost V2 — presupuesto. qty × precio. No toca resources.dinero.
 */
import type { Takeoff } from "./quantity.ts";
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
