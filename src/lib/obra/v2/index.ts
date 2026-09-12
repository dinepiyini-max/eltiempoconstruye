/**
 * OBRA V2 — librerías puras. FASE B.
 * No React. No localStorage. No window. No UI de NUEVA OBRA.
 *
 *   tables.ts     secciones y precios V2 (no el catálogo Yuna)
 *   geometry.ts   medir: largo, cotas, corte/terraplén
 *   quantity.ts   takeoff desde Geometry
 *   cost.ts       presupuesto = qty × precio
 */
export { V2_SCALE_M_PER_UNIT, V2_SECTIONS, V2_UNIT_PRICES } from "./tables.ts";
export type { V2Kind, V2PriceKey } from "./tables.ts";

export {
  FIXTURE_RAMPA,
  FIXTURE_TRAZO,
  cutFillProfile,
  measure,
  polylineLength,
  polylineLengthMeters,
  sampleHeights,
} from "./geometry.ts";
export type { Measured, Pt } from "./geometry.ts";

export { takeoff } from "./quantity.ts";
export type { Takeoff } from "./quantity.ts";

export { presupuesto } from "./cost.ts";
export type { CostItem, Presupuesto } from "./cost.ts";
