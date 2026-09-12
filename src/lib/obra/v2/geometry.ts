/**
 * Geometry V2 — medir. Lee height(); no muta el valle.
 * FASE C: muro en metros, snap, cota. El editor no duplica esta matemática.
 * FASE E: hueco (puerta/ventana) ligado a wallId + posición a lo largo.
 */
import { dist, height, type Pt } from "../terrain.ts";
import { V2_HUECO, V2_MURO, V2_SCALE_M_PER_UNIT } from "./tables.ts";

export type { Pt };

/** Trazos de prueba. No son RIVER / CAMINO / MURO. */
export const FIXTURE_TRAZO: readonly Pt[] = [
  { x: 40, y: 40 },
  { x: 160, y: 40 },
  { x: 160, y: 100 },
];

export const FIXTURE_RAMPA: readonly Pt[] = [
  { x: 200, y: 500 },
  { x: 280, y: 420 },
  { x: 360, y: 360 },
  { x: 420, y: 300 },
];

export function polylineLength(pts: readonly Pt[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1]!, pts[i]!);
  return n;
}

export function polylineLengthMeters(pts: readonly Pt[]): number {
  return polylineLength(pts) * V2_SCALE_M_PER_UNIT;
}

export function sampleHeights(pts: readonly Pt[]): number[] {
  return pts.map((p) => height(p.x, p.y));
}

/** Área de perfil (m²) entre terreno y rasante (cuerda de cotas de extremo). */
export function cutFillProfile(pts: readonly Pt[]): { cutM2: number; fillM2: number } {
  if (pts.length < 2) return { cutM2: 0, fillM2: 0 };
  const hStart = height(pts[0]!.x, pts[0]!.y);
  const hEnd = height(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y);
  const total = polylineLength(pts);
  if (total <= 0) return { cutM2: 0, fillM2: 0 };

  let cutM2 = 0;
  let fillM2 = 0;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = dist(a, b);
    const g0 = hStart + ((hEnd - hStart) * acc) / total;
    const g1 = hStart + ((hEnd - hStart) * (acc + seg)) / total;
    const d0 = height(a.x, a.y) - g0;
    const d1 = height(b.x, b.y) - g1;
    const lenM = seg * V2_SCALE_M_PER_UNIT;
    addTrap(d0, d1, lenM, (cut) => {
      if (cut > 0) cutM2 += cut;
      else fillM2 += -cut;
    });
    acc += seg;
  }
  return { cutM2, fillM2 };
}

function addTrap(d0: number, d1: number, lenM: number, push: (signedM2: number) => void): void {
  if (d0 === 0 && d1 === 0) return;
  if (d0 >= 0 && d1 >= 0) {
    push(((d0 + d1) / 2) * lenM);
    return;
  }
  if (d0 <= 0 && d1 <= 0) {
    push(((d0 + d1) / 2) * lenM);
    return;
  }
  const t = d0 / (d0 - d1 || 1e-9);
  const left = (d0 / 2) * t * lenM;
  const right = (d1 / 2) * (1 - t) * lenM;
  if (left) push(left);
  if (right) push(right);
}

export type Measured = {
  largo: number;
  largoM: number;
  cotas: number[];
  cutM2: number;
  fillM2: number;
};

export function measure(pts: readonly Pt[]): Measured {
  const { cutM2, fillM2 } = cutFillProfile(pts);
  return {
    largo: polylineLength(pts),
    largoM: polylineLengthMeters(pts),
    cotas: sampleHeights(pts),
    cutM2,
    fillM2,
  };
}

/* ── FASE C: puntos en metros (editor). No aplica V2_SCALE_M_PER_UNIT. ── */

export const SNAP_ANGLE_DEG = 8;
export const SNAP_CORNER_M = 0.45;

/** Distancia en metros entre dos puntos ya expresados en metros. */
export function lengthMeters(a: Pt, b: Pt): number {
  return dist(a, b);
}

/** Cota de lámina. (0,0)→(8,0) → "8.00 m". */
export function formatMeters(n: number): string {
  return `${n.toFixed(2)} m`;
}

export function formatM2(n: number): string {
  return `${n.toFixed(2)} m²`;
}

export type Muro = {
  id: string;
  a: Pt;
  b: Pt;
  espesor: number;
};

export function muroId(seq: number): string {
  return `M-${String(seq).padStart(3, "0")}`;
}

export function createMuro(a: Pt, b: Pt, id: string, espesor: number = V2_MURO.espesorM): Muro {
  return {
    id,
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    espesor,
  };
}

export function muroLargo(m: Pick<Muro, "a" | "b">): number {
  return lengthMeters(m.a, m.b);
}

/** Rectángulo de planta del muro (4 vértices). */
export function muroPoly(m: Muro): Pt[] {
  return thickPoly(m.a, m.b, m.espesor);
}

export function thickPoly(a: Pt, b: Pt, espesor: number): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const hx = (-dy / L) * (espesor / 2);
  const hy = (dx / L) * (espesor / 2);
  return [
    { x: a.x + hx, y: a.y + hy },
    { x: b.x + hx, y: b.y + hy },
    { x: b.x - hx, y: b.y - hy },
    { x: a.x - hx, y: a.y - hy },
  ];
}

export function muroMid(m: Pick<Muro, "a" | "b">): Pt {
  return { x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2 };
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  if (L2 <= 1e-12) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + dx * t, y: a.y + dy * t });
}

export function hitMuro(p: Pt, m: Muro, slackM: number): boolean {
  return distToSegment(p, m.a, m.b) <= m.espesor / 2 + slackM;
}

export function cornersOf(muros: readonly Muro[]): Pt[] {
  const out: Pt[] = [];
  for (const m of muros) {
    out.push(m.a, m.b);
  }
  return out;
}

export type SnapKind = "horizontal" | "vertical" | "esquina" | null;

export type SnapResult = { point: Pt; kind: SnapKind };

export type SnapOpts = { angleDeg?: number; cornerM?: number };

function angleToAxis(dx: number, dy: number): { h: number; v: number } {
  const ang = Math.atan2(dy, dx);
  const ah = Math.min(Math.abs(ang), Math.abs(Math.abs(ang) - Math.PI));
  const av = Math.min(Math.abs(Math.abs(ang) - Math.PI / 2), Math.abs(Math.abs(ang) + Math.PI / 2));
  return { h: ah, v: av };
}

/**
 * Snap predecible: esquina/extremo gana; si no, horizontal o vertical.
 * `origin` es el punto inicial del trazo (null = primer clic).
 */
export function snapDraft(
  raw: Pt,
  origin: Pt | null,
  corners: readonly Pt[],
  opts: SnapOpts = {},
): SnapResult {
  const cornerM = opts.cornerM ?? SNAP_CORNER_M;
  const angLim = ((opts.angleDeg ?? SNAP_ANGLE_DEG) * Math.PI) / 180;

  let bestCorner: Pt | null = null;
  let bestD = cornerM;
  for (const c of corners) {
    if (origin && dist(c, origin) < 1e-6) continue;
    const d = dist(raw, c);
    if (d <= bestD) {
      bestD = d;
      bestCorner = c;
    }
  }
  if (bestCorner) return { point: { x: bestCorner.x, y: bestCorner.y }, kind: "esquina" };

  if (!origin) return { point: { x: raw.x, y: raw.y }, kind: null };

  const dx = raw.x - origin.x;
  const dy = raw.y - origin.y;
  const { h, v } = angleToAxis(dx, dy);
  if (h <= angLim && h <= v) return { point: { x: raw.x, y: origin.y }, kind: "horizontal" };
  if (v <= angLim) return { point: { x: origin.x, y: raw.y }, kind: "vertical" };
  return { point: { x: raw.x, y: raw.y }, kind: null };
}

/* ── FASE E: hueco sobre muro. No flota. ── */

export type HuecoKind = "puerta" | "ventana";

export type Hueco = {
  id: string;
  kind: HuecoKind;
  wallId: string;
  /** Centro del vano, metros desde el extremo a. */
  alongM: number;
  ancho: number;
};

export function huecoId(kind: HuecoKind, seq: number): string {
  return `${kind === "puerta" ? "P" : "V"}-${String(seq).padStart(3, "0")}`;
}

export function nextHuecoSeqFor(kind: HuecoKind, openings: readonly Hueco[]): number {
  const prefix = kind === "puerta" ? "P-" : "V-";
  let n = 1;
  for (const h of openings) {
    if (!h.id.startsWith(prefix)) continue;
    const num = Number(h.id.slice(prefix.length));
    if (Number.isFinite(num)) n = Math.max(n, num + 1);
  }
  return n;
}

export function createHueco(
  kind: HuecoKind,
  wallId: string,
  alongM: number,
  id: string,
  ancho: number,
): Hueco {
  return { id, kind, wallId, alongM, ancho };
}

export function huecoAlto(kind: HuecoKind): number {
  return kind === "puerta" ? V2_HUECO.puerta.altoM : V2_HUECO.ventana.altoM;
}

export function huecoAnchoDefault(kind: HuecoKind): number {
  return kind === "puerta" ? V2_HUECO.puerta.anchoM : V2_HUECO.ventana.anchoM;
}

export function pointAlong(m: Pick<Muro, "a" | "b">, t: number): Pt {
  return { x: m.a.x + (m.b.x - m.a.x) * t, y: m.a.y + (m.b.y - m.a.y) * t };
}

/** Proyección (puede salir de [0, L]). */
export function alongMuro(m: Pick<Muro, "a" | "b">, p: Pt): number {
  const L = muroLargo(m);
  if (L < 1e-9) return 0;
  const t = ((p.x - m.a.x) * (m.b.x - m.a.x) + (p.y - m.a.y) * (m.b.y - m.a.y)) / (L * L);
  return t * L;
}

/** null si el muro no cabe el vano. */
export function clampHuecoAlong(L: number, ancho: number, alongM: number, jamba = V2_HUECO.minJambaM): number | null {
  const need = ancho + 2 * jamba;
  if (L < need - 1e-9) return null;
  const lo = jamba + ancho / 2;
  const hi = L - jamba - ancho / 2;
  return Math.max(lo, Math.min(hi, alongM));
}

export function huecoRange(h: Pick<Hueco, "alongM" | "ancho">): { lo: number; hi: number } {
  return { lo: h.alongM - h.ancho / 2, hi: h.alongM + h.ancho / 2 };
}

export function huecoOverlaps(
  a: Pick<Hueco, "wallId" | "alongM" | "ancho">,
  b: Pick<Hueco, "wallId" | "alongM" | "ancho">,
  gap = V2_HUECO.minJambaM,
): boolean {
  if (a.wallId !== b.wallId) return false;
  const A = huecoRange(a);
  const B = huecoRange(b);
  return A.lo < B.hi + gap && B.lo < A.hi + gap;
}

export function huecoEnds(m: Pick<Muro, "a" | "b">, h: Pick<Hueco, "alongM" | "ancho">): { a: Pt; b: Pt } | null {
  const L = muroLargo(m);
  if (L < 1e-9) return null;
  const { lo, hi } = huecoRange(h);
  return { a: pointAlong(m, lo / L), b: pointAlong(m, hi / L) };
}

export function muroDir(m: Pick<Muro, "a" | "b">): { dx: number; dy: number; nx: number; ny: number; L: number } {
  const L = muroLargo(m) || 1;
  const dx = (m.b.x - m.a.x) / L;
  const dy = (m.b.y - m.a.y) / L;
  return { dx, dy, nx: -dy, ny: dx, L };
}

/** Tramos sólidos del muro, con vanos recortados. */
export function muroParts(m: Muro, huecos: readonly Hueco[]): { a: Pt; b: Pt }[] {
  const L = muroLargo(m);
  if (L < 1e-9) return [];
  const cuts = huecos
    .filter((h) => h.wallId === m.id)
    .map((h) => {
      const { lo, hi } = huecoRange(h);
      return { t0: Math.max(0, lo / L), t1: Math.min(1, hi / L) };
    })
    .filter((c) => c.t1 - c.t0 > 1e-4)
    .sort((x, y) => x.t0 - y.t0);

  const merged: { t0: number; t1: number }[] = [];
  for (const c of cuts) {
    const last = merged[merged.length - 1];
    if (!last || c.t0 > last.t1 + 1e-6) merged.push({ t0: c.t0, t1: c.t1 });
    else last.t1 = Math.max(last.t1, c.t1);
  }

  const parts: { a: Pt; b: Pt }[] = [];
  let t = 0;
  for (const c of merged) {
    if (c.t0 - t > 1e-4) parts.push({ a: pointAlong(m, t), b: pointAlong(m, c.t0) });
    t = c.t1;
  }
  if (1 - t > 1e-4) parts.push({ a: pointAlong(m, t), b: pointAlong(m, 1) });
  return parts;
}

export function placeHuecoOnMuro(
  kind: HuecoKind,
  m: Muro,
  world: Pt,
  existing: readonly Hueco[],
  id: string,
): Hueco | null {
  const L = muroLargo(m);
  const ancho = huecoAnchoDefault(kind);
  const along = clampHuecoAlong(L, ancho, alongMuro(m, world));
  if (along == null) return null;
  const hueco = createHueco(kind, m.id, along, id, ancho);
  if (existing.some((o) => huecoOverlaps(o, hueco))) return null;
  return hueco;
}
