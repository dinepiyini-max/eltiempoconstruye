/**
 * Geometry V2 — medir. Lee height(); no muta el valle.
 */
import { dist, height, type Pt } from "../terrain.ts";
import { V2_SCALE_M_PER_UNIT } from "./tables.ts";

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
