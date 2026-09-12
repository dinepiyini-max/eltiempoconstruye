/**
 * OBRA V2 — librerías. FASE B + C + E + F.
 * Geometry / quantity / cost siguen puros.
 * Persistencia propia: obra.v2. Nunca obra.jefe / obra.visita.
 *
 *   tables.ts     secciones y precios V2 (no el catálogo Yuna)
 *   geometry.ts   medir + MURO + snap + hueco + estructura
 *   quantity.ts   takeoff desde Geometry
 *   cost.ts       presupuesto = qty × precio
 *   history.ts    undo / redo en memoria
 *   persist-v2.ts caja obra.v2
 */
export {
  V2_COLUMNA,
  V2_HUECO,
  V2_LOSA_PLANTA,
  V2_MURO,
  V2_SCALE_M_PER_UNIT,
  V2_SECTIONS,
  V2_SHEET,
  V2_UNIT_PRICES,
  V2_VIGA,
  V2_ZAPATA,
} from "./tables.ts";
export type { V2Kind, V2PriceKey } from "./tables.ts";

export {
  FIXTURE_RAMPA,
  FIXTURE_TRAZO,
  SNAP_ANGLE_DEG,
  SNAP_CORNER_M,
  alongMuro,
  clampHuecoAlong,
  cornersOf,
  createColumna,
  createHueco,
  createLosa,
  createMuro,
  createViga,
  createZapata,
  cutFillProfile,
  distToSegment,
  formatM2,
  formatMeters,
  hitMuro,
  hitSquare,
  huecoAnchoDefault,
  huecoAlto,
  huecoEnds,
  huecoId,
  huecoOverlaps,
  lengthMeters,
  losaArea,
  measure,
  muroId,
  muroLargo,
  muroMid,
  muroParts,
  muroPoly,
  nearestColumna,
  nextHuecoSeqFor,
  nextStructSeq,
  placeHuecoOnMuro,
  polygonArea,
  polygonCentroid,
  polylineLength,
  polylineLengthMeters,
  rectPoly,
  sampleHeights,
  snapDraft,
  snapZapataCenter,
  squarePoly,
  structId,
  structureAnchors,
  vigaLargo,
} from "./geometry.ts";
export type {
  Columna,
  Hueco,
  HuecoKind,
  Losa,
  Measured,
  Muro,
  Pt,
  SnapKind,
  SnapResult,
  Viga,
  Zapata,
} from "./geometry.ts";

export {
  takeoff,
  takeoffAsCost,
  takeoffColumna,
  takeoffLosa,
  takeoffMuro,
  takeoffMuros,
  takeoffScene,
  takeoffViga,
  takeoffZapata,
} from "./quantity.ts";
export type { Takeoff, TakeoffMuro, TakeoffScene } from "./quantity.ts";

export { presupuesto } from "./cost.ts";
export type { CostItem, Presupuesto } from "./cost.ts";

export { canRedo, canUndo, histInit, histPush, histRedo, histUndo } from "./history.ts";

export {
  V2_BAK_KEY,
  V2_FORBIDDEN_KEYS,
  V2_LIVE_KEY,
  V2_PRODUCT,
  emptyV2,
  hydrateV2,
  loadV2,
  saveV2,
  snapshotV2,
} from "./persist-v2.ts";
export type { V2Document, V2View } from "./persist-v2.ts";
