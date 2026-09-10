export const MAP_W = 1000;
export const MAP_H = 620;
export const STAKE = { x: 168, y: 448 };

export type Pt = { x: number; y: number };

export function height(x: number, y: number): number {
  const nx = x / MAP_W;
  const ny = y / MAP_H;
  const m1 = Math.exp(-(((nx - 0.44) * (nx - 0.44)) / 0.07 + ((ny - 0.13) * (ny - 0.13)) / 0.045)) * 0.92;
  const m2 = Math.exp(-(((nx - 0.2) * (nx - 0.2)) / 0.045 + ((ny - 0.2) * (ny - 0.2)) / 0.055)) * 0.68;
  const m3 = Math.exp(-(((nx - 0.62) * (nx - 0.62)) / 0.05 + ((ny - 0.08) * (ny - 0.08)) / 0.03)) * 0.4;
  const ridge = (1 - ny) * 0.1 * Math.sin(nx * 9.4);
  const valley = Math.exp(-(((nx - 0.56) * (nx - 0.56)) / 0.13 + ((ny - 0.55) * (ny - 0.55)) / 0.16)) * -0.4;
  const terrace = Math.exp(-(((nx - 0.7) * (nx - 0.7)) / 0.055 + ((ny - 0.68) * (ny - 0.68)) / 0.04)) * 0.16;
  const riverCut = Math.exp(-(((nx - 0.4) * (nx - 0.4)) / 0.2 + ((ny - 0.45) * (ny - 0.45)) / 0.35)) * -0.08;
  return 0.36 + m1 + m2 + m3 + ridge + valley + terrace + riverCut;
}

function bezier(t: number, a: Pt, b: Pt, c: Pt, d: Pt): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

function sampleBezier(a: Pt, b: Pt, c: Pt, d: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(bezier(i / n, a, b, c, d));
  return out;
}

export const RIVER: Pt[] = sampleBezier(
  { x: 428, y: 18 },
  { x: 360, y: 170 },
  { x: 300, y: 290 },
  { x: 338, y: 328 },
  18,
).concat(
  sampleBezier({ x: 338, y: 328 }, { x: 430, y: 390 }, { x: 640, y: 510 }, { x: 990, y: 590 }, 22).slice(1),
);

export const CAMINO: Pt[] = [
  { x: 118, y: 590 },
  { x: 142, y: 520 },
  { x: 168, y: 448 },
  { x: 210, y: 392 },
  { x: 268, y: 352 },
  { x: 338, y: 328 },
  { x: 430, y: 346 },
  { x: 522, y: 384 },
  { x: 572, y: 408 },
  { x: 640, y: 432 },
  { x: 708, y: 448 },
];

export const MURO: Pt[] = [
  { x: 388, y: 148 },
  { x: 430, y: 172 },
  { x: 456, y: 198 },
  { x: 510, y: 216 },
  { x: 568, y: 228 },
];

export const VIADUCTO: Pt[] = [
  { x: 618, y: 262 },
  { x: 700, y: 292 },
  { x: 780, y: 318 },
  { x: 870, y: 344 },
  { x: 938, y: 362 },
];

export const TRACE: Pt[] = [
  { x: 80, y: 500 },
  { x: 130, y: 470 },
  { x: 190, y: 490 },
  { x: 250, y: 510 },
  { x: 320, y: 500 },
];

export type Contour = { level: number; segs: [Pt, Pt][] };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const CONTOURS: Contour[] = (() => {
  const levels = [0.28, 0.34, 0.4, 0.46, 0.52, 0.58, 0.64, 0.7, 0.76, 0.82];
  const cols = 70;
  const rows = 44;
  const out: Contour[] = levels.map((level) => ({ level, segs: [] as [Pt, Pt][] }));
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = (i / cols) * MAP_W;
      const y0 = (j / rows) * MAP_H;
      const x1 = ((i + 1) / cols) * MAP_W;
      const y1 = ((j + 1) / rows) * MAP_H;
      const h00 = height(x0, y0);
      const h10 = height(x1, y0);
      const h11 = height(x1, y1);
      const h01 = height(x0, y1);
      for (let L = 0; L < levels.length; L++) {
        const level = levels[L]!;
        const c0 = h00 > level ? 1 : 0;
        const c1 = h10 > level ? 2 : 0;
        const c2 = h11 > level ? 4 : 0;
        const c3 = h01 > level ? 8 : 0;
        const idx = c0 | c1 | c2 | c3;
        if (idx === 0 || idx === 15) continue;
        const e: Pt[] = [];
        const edge = (ha: number, hb: number, ax: number, ay: number, bx: number, by: number) => {
          if ((ha > level) === (hb > level)) return;
          const t = (level - ha) / (hb - ha || 1e-6);
          e.push({ x: lerp(ax, bx, t), y: lerp(ay, by, t) });
        };
        edge(h00, h10, x0, y0, x1, y0);
        edge(h10, h11, x1, y0, x1, y1);
        edge(h11, h01, x1, y1, x0, y1);
        edge(h01, h00, x0, y1, x0, y0);
        if (e.length >= 2) out[L]!.segs.push([e[0]!, e[1]!]);
      }
    }
  }
  return out;
})();

export const FOREST: Pt[] = (() => {
  const pts: Pt[] = [];
  for (let i = 0; i < 120; i++) {
    const x = 40 + ((i * 73) % 920);
    const y = 20 + ((i * 47) % 280);
    const h = height(x, y);
    if (h > 0.5 && h < 0.82) pts.push({ x, y });
  }
  return pts;
})();

export function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 1 unidad de plano = 2 m (escala 1:2 000). Estaca = estación conocida. */
const M_PER_UNIT = 2;
const LAT0 = 18 + 29 / 60 + 14 / 3600;
const LON0 = -(69 + 51 / 60 + 22 / 3600);
const E0 = 412086;
const N0 = 2184320;

export function mapToGeo(x: number, y: number): {
  east: number;
  north: number;
  lat: number;
  lon: number;
  latLabel: string;
  lonLabel: string;
  utm: string;
} {
  const east = E0 + (x - STAKE.x) * M_PER_UNIT;
  const north = N0 + (STAKE.y - y) * M_PER_UNIT;
  const lat = LAT0 + ((STAKE.y - y) * M_PER_UNIT) / 110540;
  const lon = LON0 + ((x - STAKE.x) * M_PER_UNIT) / (111320 * Math.cos((LAT0 * Math.PI) / 180));
  return {
    east,
    north,
    lat,
    lon,
    latLabel: toDms(lat, "N", "S"),
    lonLabel: toDms(lon, "E", "O"),
    utm: `19N  ${east.toFixed(0)} m E  ·  ${north.toFixed(0)} m N`,
  };
}

function toDms(deg: number, pos: string, neg: string): string {
  const hemi = deg >= 0 ? pos : neg;
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const mf = (a - d) * 60;
  const m = Math.floor(mf);
  const s = ((mf - m) * 60).toFixed(1).replace(".", ",");
  return `${d}° ${String(m).padStart(2, "0")}′ ${s}″ ${hemi}`;
}

export function surveyCover(p: Pt, survey: number): number {
  const d = dist(p, STAKE);
  const r = 70 + Math.pow(survey, 0.72) * 980;
  const edge = 90;
  if (d < r - edge) return 1;
  if (d > r + 10) return 0;
  return Math.max(0, Math.min(1, 1 - (d - (r - edge)) / (edge + 10)));
}

export function nearestOnPath(path: Pt[], p: Pt): number {
  let best = Infinity;
  for (const q of path) best = Math.min(best, dist(p, q));
  return best;
}
