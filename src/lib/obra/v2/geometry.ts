/**
 * Geometry V2 — medir. Lee height(); no muta el valle.
 * FASE C: muro en metros, snap, cota. El editor no duplica esta matemática.
 * FASE E: hueco (puerta/ventana) ligado a wallId + posición a lo largo.
 */
import { dist, height, type Pt } from "../terrain.ts";
import { V2_COLUMNA, V2_HUECO, V2_LOSA_PLANTA, V2_MURO, V2_SCALE_M_PER_UNIT, V2_VIGA, V2_ZAPATA } from "./tables.ts";

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
  alto: number;
};

export function muroId(seq: number): string {
  return `M-${String(seq).padStart(3, "0")}`;
}

export function createMuro(
  a: Pt,
  b: Pt,
  id: string,
  espesor: number = V2_MURO.espesorM,
  alto: number = V2_MURO.altoM,
): Muro {
  return {
    id,
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    espesor: Math.max(V2_MURO.minEspesorM, espesor),
    alto: Math.max(V2_MURO.minAltoM, alto),
  };
}

export function muroLargo(m: Pick<Muro, "a" | "b">): number {
  return lengthMeters(m.a, m.b);
}

export function muroHiladas(altoM: number = V2_MURO.altoM): number {
  const h = V2_MURO.hiladaM;
  if (h <= 0) return 1;
  return Math.max(1, Math.round(altoM / h));
}

/** Lee "8", "8.00" o "8,00". */
export function parseMeters(raw: string): number | null {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Escala el muro desde el arranque `a`. Snap H/V si el trazo ya está en eje.
 * 14.76 → 8.00 deja `a` y mueve `b`.
 */
export function scaleMuroFromStart(m: Muro, largoM: number, angleDeg: number = SNAP_ANGLE_DEG): Muro {
  const L = Math.max(V2_MURO.minLargoM, largoM);
  const dx = m.b.x - m.a.x;
  const dy = m.b.y - m.a.y;
  const angLim = (angleDeg * Math.PI) / 180;
  const { h, v } = angleToAxis(dx, dy);
  let bx: number;
  let by: number;
  if (h <= angLim && h <= v) {
    const sign = dx === 0 ? 1 : Math.sign(dx);
    bx = m.a.x + sign * L;
    by = m.a.y;
  } else if (v <= angLim) {
    const sign = dy === 0 ? 1 : Math.sign(dy);
    bx = m.a.x;
    by = m.a.y + sign * L;
  } else {
    const cur = Math.hypot(dx, dy) || 1;
    bx = m.a.x + (dx / cur) * L;
    by = m.a.y + (dy / cur) * L;
  }
  return createMuro(m.a, { x: bx, y: by }, m.id, m.espesor, m.alto);
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
  alto: number;
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
  alto?: number,
): Hueco {
  return { id, kind, wallId, alongM, ancho, alto: alto ?? huecoAlto(kind) };
}

export function huecoAlto(kind: HuecoKind): number {
  return kind === "puerta" ? V2_HUECO.puerta.altoM : V2_HUECO.ventana.altoM;
}

export function huecoAltoDe(h: Pick<Hueco, "kind" | "alto">): number {
  return h.alto > 0 ? h.alto : huecoAlto(h.kind);
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

/* ── FASE F: columna, zapata, viga, losa. Metros de lámina. ── */

export type Columna = {
  id: string;
  c: Pt;
  lado: number;
};

export type Zapata = {
  id: string;
  c: Pt;
  lado: number;
  columnId: string | null;
};

export type Viga = {
  id: string;
  a: Pt;
  b: Pt;
  ancho: number;
  canto: number;
};

export type Losa = {
  id: string;
  poly: Pt[];
  espesor: number;
};

export function structId(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

export function nextStructSeq(prefix: string, ids: readonly string[]): number {
  const head = `${prefix}-`;
  let n = 1;
  for (const id of ids) {
    if (!id.startsWith(head)) continue;
    const num = Number(id.slice(head.length));
    if (Number.isFinite(num)) n = Math.max(n, num + 1);
  }
  return n;
}

export function createColumna(c: Pt, id: string, lado: number = V2_COLUMNA.ladoM): Columna {
  return { id, c: { x: c.x, y: c.y }, lado };
}

export function createZapata(
  c: Pt,
  id: string,
  lado: number = V2_ZAPATA.ladoM,
  columnId: string | null = null,
): Zapata {
  return { id, c: { x: c.x, y: c.y }, lado, columnId };
}

export function createViga(
  a: Pt,
  b: Pt,
  id: string,
  ancho: number = V2_VIGA.anchoM,
  canto: number = V2_VIGA.cantoM,
): Viga {
  return { id, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, ancho, canto };
}

export function createLosa(poly: readonly Pt[], id: string, espesor: number = V2_LOSA_PLANTA.espesorM): Losa {
  return { id, poly: poly.map((p) => ({ x: p.x, y: p.y })), espesor };
}

/**
 * Escala la losa desde el centroide. 12 m² → 6 m² deja la forma y mueve el RD$.
 */
export function scaleLosaToArea(l: Losa, areaM2: number): Losa {
  const cur = losaArea(l);
  const target = Math.max(V2_LOSA_PLANTA.minAreaM2, areaM2);
  if (cur <= 1e-9) return l;
  if (Math.abs(cur - target) < 1e-6) return l;
  const k = Math.sqrt(target / cur);
  const c = polygonCentroid(l.poly);
  const poly = l.poly.map((p) => ({
    x: c.x + (p.x - c.x) * k,
    y: c.y + (p.y - c.y) * k,
  }));
  return createLosa(poly, l.id, l.espesor);
}

export function losaBBox(l: Pick<Losa, "poly">): { dx: number; dy: number } {
  if (!l.poly.length) return { dx: 0, dy: 0 };
  let minX = l.poly[0]!.x;
  let maxX = minX;
  let minY = l.poly[0]!.y;
  let maxY = minY;
  for (const p of l.poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { dx: maxX - minX, dy: maxY - minY };
}

/** Largo = lado mayor del bbox; ancho = el menor. */
export function losaLados(l: Pick<Losa, "poly">): { largo: number; ancho: number } {
  const { dx, dy } = losaBBox(l);
  return dx >= dy ? { largo: dx, ancho: dy } : { largo: dy, ancho: dx };
}

/**
 * Escala la losa por lados (no por m²). El lado mayor sigue siendo el largo.
 */
export function scaleLosaToSides(l: Losa, largoM: number, anchoM: number): Losa {
  const { dx, dy } = losaBBox(l);
  const largo = Math.max(V2_LOSA_PLANTA.minLadoM, largoM);
  const ancho = Math.max(V2_LOSA_PLANTA.minLadoM, anchoM);
  if (dx < 1e-6 || dy < 1e-6) return l;
  const sx = dx >= dy ? largo / dx : ancho / dx;
  const sy = dx >= dy ? ancho / dy : largo / dy;
  const c = polygonCentroid(l.poly);
  const poly = l.poly.map((p) => ({
    x: c.x + (p.x - c.x) * sx,
    y: c.y + (p.y - c.y) * sy,
  }));
  return createLosa(poly, l.id, l.espesor);
}

export function scaleVigaFromStart(v: Viga, largoM: number): Viga {
  const dummy = createMuro(v.a, v.b, v.id, v.ancho);
  const scaled = scaleMuroFromStart(dummy, Math.max(V2_VIGA.minLargoM, largoM));
  return createViga(scaled.a, scaled.b, v.id, v.ancho, v.canto);
}

export function setHuecoMedida(
  h: Hueco,
  wall: Muro,
  others: readonly Hueco[],
  ancho: number,
  alto: number,
): Hueco | null {
  const w = Math.max(V2_HUECO.minAnchoM, ancho);
  const a = Math.max(0.4, alto);
  const along = clampHuecoAlong(muroLargo(wall), w, h.alongM);
  if (along == null) return null;
  const next = createHueco(h.kind, h.wallId, along, h.id, w, a);
  if (others.some((o) => o.id !== h.id && huecoOverlaps(o, next))) return null;
  return next;
}

export function squarePoly(c: Pt, lado: number): Pt[] {
  const h = lado / 2;
  return [
    { x: c.x - h, y: c.y - h },
    { x: c.x + h, y: c.y - h },
    { x: c.x + h, y: c.y + h },
    { x: c.x - h, y: c.y + h },
  ];
}

export function rectPoly(a: Pt, b: Pt): Pt[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
  ];
}

export function polygonArea(pts: readonly Pt[]): number {
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i]!;
    const pj = pts[j]!;
    a += pj.x * pi.y - pi.x * pj.y;
  }
  return Math.abs(a) / 2;
}

export function polygonCentroid(pts: readonly Pt[]): Pt {
  if (!pts.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export function pointInPoly(p: Pt, pts: readonly Pt[]): boolean {
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    const hit = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-12) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

export function hitSquare(p: Pt, c: Pt, lado: number, slack: number): boolean {
  const h = lado / 2 + slack;
  return Math.abs(p.x - c.x) <= h && Math.abs(p.y - c.y) <= h;
}

export function vigaLargo(v: Pick<Viga, "a" | "b">): number {
  return lengthMeters(v.a, v.b);
}

export function losaArea(l: Pick<Losa, "poly">): number {
  return polygonArea(l.poly);
}

export function nearestColumna(p: Pt, cols: readonly Columna[], maxM: number): Columna | null {
  let best: Columna | null = null;
  let bestD = maxM;
  for (const c of cols) {
    const d = dist(p, c.c);
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function snapZapataCenter(p: Pt, cols: readonly Columna[], maxM: number): { c: Pt; columnId: string | null } {
  const col = nearestColumna(p, cols, maxM);
  if (!col) return { c: { x: p.x, y: p.y }, columnId: null };
  return { c: { x: col.c.x, y: col.c.y }, columnId: col.id };
}

export function structureAnchors(
  walls: readonly Muro[],
  columns: readonly Columna[] = [],
  beams: readonly Viga[] = [],
): Pt[] {
  const out = cornersOf(walls);
  for (const c of columns) out.push(c.c);
  for (const v of beams) {
    out.push(v.a, v.b);
  }
  return out;
}
