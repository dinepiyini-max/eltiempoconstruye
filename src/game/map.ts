import { MAP_H, MAP_W, RIO, SITE, STAKE, STAGE_SHORT, STRUCT_SHORT, STRUCTURES } from "./catalog.ts";
import { bottle, clockOf, crewAt, crewsAt, isPliego, stageIndex } from "./sim.ts";
import { PLIEGO_IDS, STRUCTURE_IDS, type Game, type Stage, type StructureId } from "./types.ts";

export type Palette = {
  paper: string;
  ink: string;
  graphite: string;
  faint: string;
  cyan: string;
  rust: string;
  rule: string;
};

type Pt = { x: number; y: number };
type Frame = { x: number; y: number; w: number; h: number };

function heightAt(x: number, y: number): number {
  const n = x / MAP_W;
  const r = y / MAP_H;
  const i =
    Math.exp(-(((n - 0.44) * (n - 0.44)) / 0.07 + ((r - 0.13) * (r - 0.13)) / 0.045)) * 0.92;
  const a =
    Math.exp(-(((n - 0.2) * (n - 0.2)) / 0.045 + ((r - 0.2) * (r - 0.2)) / 0.055)) * 0.68;
  const o =
    Math.exp(-(((n - 0.62) * (n - 0.62)) / 0.05 + ((r - 0.08) * (r - 0.08)) / 0.03)) * 0.4;
  const s = (1 - r) * 0.1 * Math.sin(n * 9.4);
  const c =
    Math.exp(-(((n - 0.56) * (n - 0.56)) / 0.13 + ((r - 0.55) * (r - 0.55)) / 0.16)) * -0.4;
  const l =
    Math.exp(-(((n - 0.7) * (n - 0.7)) / 0.055 + ((r - 0.68) * (r - 0.68)) / 0.04)) * 0.16;
  const u =
    Math.exp(-(((n - 0.4) * (n - 0.4)) / 0.2 + ((r - 0.45) * (r - 0.45)) / 0.35)) * -0.08;
  return 0.36 + i + a + o + s + c + l + u;
}

function bezier(t: number, a: Pt, b: Pt, c: Pt, d: Pt): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

function curve(a: Pt, b: Pt, c: Pt, d: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(bezier(i / n, a, b, c, d));
  return out;
}

const RIVER = curve({ x: 428, y: 18 }, { x: 360, y: 170 }, { x: 300, y: 290 }, { x: 338, y: 328 }, 18).concat(
  curve({ x: 338, y: 328 }, { x: 430, y: 390 }, { x: 640, y: 510 }, { x: 990, y: 590 }, 22).slice(1),
);

const ROAD: Pt[] = [
  { x: 118, y: 590 }, { x: 142, y: 520 }, { x: 168, y: 448 }, { x: 210, y: 392 },
  { x: 268, y: 352 }, { x: 338, y: 328 }, { x: 430, y: 346 }, { x: 522, y: 384 },
  { x: 572, y: 408 }, { x: 640, y: 432 }, { x: 708, y: 448 },
];

const WALL: Pt[] = [
  { x: 388, y: 148 }, { x: 430, y: 172 }, { x: 456, y: 198 }, { x: 510, y: 216 }, { x: 568, y: 228 },
];

const VIADUCT: Pt[] = [
  { x: 618, y: 262 }, { x: 700, y: 292 }, { x: 780, y: 318 }, { x: 870, y: 344 }, { x: 938, y: 362 },
];

const PATH: Pt[] = [
  { x: 80, y: 500 }, { x: 130, y: 470 }, { x: 190, y: 490 }, { x: 250, y: 510 }, { x: 320, y: 500 },
];

const CONTOURS = (() => {
  const levels = [0.28, 0.34, 0.4, 0.46, 0.52, 0.58, 0.64, 0.7, 0.76, 0.82];
  const t = levels.map((level) => ({ level, segs: [] as [Pt, Pt][] }));
  for (let n = 0; n < 44; n++) {
    for (let r = 0; r < 70; r++) {
      const i = (r / 70) * MAP_W;
      const a = (n / 44) * MAP_H;
      const o = ((r + 1) / 70) * MAP_W;
      const s = ((n + 1) / 44) * MAP_H;
      const c = heightAt(i, a);
      const l = heightAt(o, a);
      const u = heightAt(o, s);
      const d = heightAt(i, s);
      for (let k = 0; k < levels.length; k++) {
        const lv = levels[k]!;
        const bits = +(c > lv) | (l > lv ? 2 : 0) | (u > lv ? 4 : 0) | (d > lv ? 8 : 0);
        if (bits === 0 || bits === 15) continue;
        const pts: Pt[] = [];
        const edge = (h1: number, h2: number, x1: number, y1: number, x2: number, y2: number) => {
          if ((h1 > lv) === (h2 > lv)) return;
          const t0 = (lv - h1) / (h2 - h1 || 1e-6);
          pts.push({ x: h1 + (x2 - x1) * 0 + (x1 + (x2 - x1) * t0 - x1), y: y1 + (y2 - y1) * t0 });
          pts[pts.length - 1] = { x: x1 + (x2 - x1) * t0, y: y1 + (y2 - y1) * t0 };
        };
        edge(c, l, i, a, o, a);
        edge(l, u, o, a, o, s);
        edge(u, d, o, s, i, s);
        edge(d, c, i, s, i, a);
        if (pts.length >= 2) t[k]!.segs.push([pts[0]!, pts[1]!]);
      }
    }
  }
  return t;
})();

const TREES = (() => {
  const e: Pt[] = [];
  for (let t = 0; t < 120; t++) {
    const n = 40 + ((t * 73) % 920);
    const r = 20 + ((t * 47) % 280);
    const i = heightAt(n, r);
    if (i > 0.5 && i < 0.82) e.push({ x: n, y: r });
  }
  return e;
})();

function dist(a: Pt, b: Pt): number {
  const n = a.x - b.x;
  const r = a.y - b.y;
  return Math.sqrt(n * n + r * r);
}

export function revealed(pt: Pt, survey: number): number {
  const n = dist(pt, STAKE);
  const r = 70 + survey ** 0.72 * 980;
  if (n < r - 90) return 1;
  if (n > r + 10) return 0;
  return Math.max(0, Math.min(1, 1 - (n - (r - 90)) / 100));
}

export function readPalette(el: HTMLElement): Palette {
  const t = getComputedStyle(el);
  const n = (name: string, fb: string) => t.getPropertyValue(name).trim() || fb;
  return {
    paper: n("--color-paper", "#efe6d0"),
    ink: n("--color-ink", "#2c2a26"),
    graphite: n("--color-graphite", "#3f3c36"),
    faint: n("--color-faint", "#b9ad93"),
    cyan: n("--color-cyan", "#2f6a78"),
    rust: n("--color-rust", "#c45c26"),
    rule: n("--color-rule", "#c4b79a"),
  };
}

export function sheetFrame(w: number, h: number): Frame {
  const n = w < 720 ? 18 : 36;
  return { x: n, y: n * 0.7, w: w - n * 2, h: h - n * 1.6 };
}

function X(f: Frame, x: number): number {
  return f.x + (x / MAP_W) * f.w;
}
function Y(f: Frame, y: number): number {
  return f.y + (y / MAP_H) * f.h;
}
function P(f: Frame, p: Pt): Pt {
  return { x: X(f, p.x), y: Y(f, p.y) };
}

function strokePts(ctx: CanvasRenderingContext2D, f: Frame, pts: Pt[], close = false): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(X(f, pts[0]!.x), Y(f, pts[0]!.y));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(X(f, pts[i]!.x), Y(f, pts[i]!.y));
  if (close) ctx.closePath();
}

function cross(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(9, 0);
  ctx.moveTo(0, -9);
  ctx.lineTo(0, 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function flag(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, -16);
  ctx.stroke();
  ctx.fillStyle = pal.rust;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(11, -11);
  ctx.lineTo(0, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function dots(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, pal: Palette): void {
  const a = Math.min(3, Math.max(0, n));
  ctx.save();
  ctx.strokeStyle = pal.graphite;
  ctx.lineWidth = 1;
  for (let i = 0; i < a; i++) {
    ctx.beginPath();
    ctx.arc(x + (i - (a - 1) / 2) * 9, y, 3.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function cropMarks(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 0.8;
  const corners: [number, number][] = [
    [8, 8],
    [w - 8, 8],
    [8, h - 8],
    [w - 8, h - 8],
  ];
  for (const [x, y] of corners) {
    const sx = x < w / 2 ? 1 : -1;
    const sy = y < h / 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x + sx * 14, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * 14);
    ctx.stroke();
  }
}

function north(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.ink;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 8, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(7, 12);
  ctx.lineTo(0, 6);
  ctx.lineTo(-7, 12);
  ctx.closePath();
  ctx.fill();
  ctx.font = "600 13px 'IBM Plex Sans Condensed', sans-serif";
  ctx.fillStyle = pal.ink;
  ctx.textAlign = "center";
  ctx.fillText("N", 0, -18);
  ctx.restore();
}

function scalebar(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(192, 0);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(i * 48, i % 2 === 0 ? -7 : 0, 48, 7);
    ctx.strokeRect(i * 48, -7, 48, 7);
  }
  ctx.font = "600 12px 'IBM Plex Sans Condensed', sans-serif";
  ctx.fillStyle = pal.ink;
  ctx.textAlign = "center";
  ctx.fillText("0", 0, 20);
  ctx.fillText("100", 96, 20);
  ctx.fillText("200 m", 192, 20);
  ctx.restore();
}

function grid(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  if (g.survey < 0.35) return;
  ctx.save();
  ctx.strokeStyle = pal.rule;
  ctx.lineWidth = 0.5;
  for (let n = 0; n <= MAP_W; n += 100) {
    ctx.globalAlpha = n % 200 === 0 ? 0.28 : 0.14;
    ctx.beginPath();
    ctx.moveTo(X(f, n), Y(f, 0));
    ctx.lineTo(X(f, n), Y(f, MAP_H));
    ctx.stroke();
  }
  for (let n = 0; n <= MAP_H; n += 100) {
    ctx.globalAlpha = n % 200 === 0 ? 0.28 : 0.14;
    ctx.beginPath();
    ctx.moveTo(X(f, 0), Y(f, n));
    ctx.lineTo(X(f, MAP_W), Y(f, n));
    ctx.stroke();
  }
  ctx.restore();
}

function river(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  const i = g.survey;
  ctx.save();
  strokePts(ctx, f, RIVER);
  ctx.strokeStyle = pal.cyan;
  ctx.globalAlpha = 0.18 + i * 0.45;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.35 + i * 0.55;
  ctx.stroke();
  if (i > 0.35) {
    ctx.font = "italic 500 12px 'Cormorant Garamond', serif";
    ctx.fillStyle = pal.cyan;
    ctx.globalAlpha = 0.85;
    const p = P(f, RIVER[4] ?? RIVER[0]!);
    const lift = stageIndex(g.structures.puente.stage) >= 6 ? 16 : 0;
    ctx.fillText(RIO, p.x + 10, p.y - 8 + lift);
  }
  ctx.restore();
}

function contours(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  ctx.save();
  ctx.lineCap = "round";
  for (const band of CONTOURS) {
    const major = band.level % 0.12 < 0.01;
    for (const [a, b] of band.segs) {
      const vis = revealed({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, g.survey);
      if (vis < 0.05) {
        const n = Math.abs(Math.sin(a.x * 0.017 + a.y * 0.011 + band.level * 8));
        if (n > 0.55) {
          ctx.globalAlpha = 0.28 + n * 0.12;
          ctx.strokeStyle = pal.graphite;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(X(f, a.x), Y(f, a.y));
          const cut = 0.4 + n * 0.25;
          ctx.lineTo(X(f, a.x + (b.x - a.x) * cut), Y(f, a.y + (b.y - a.y) * cut));
          ctx.stroke();
        }
        continue;
      }
      ctx.globalAlpha = 0.25 + vis * (major ? 0.55 : 0.35);
      ctx.strokeStyle = pal.graphite;
      ctx.lineWidth = major ? 1.05 : 0.65;
      ctx.beginPath();
      ctx.moveTo(X(f, a.x), Y(f, a.y));
      ctx.lineTo(X(f, b.x), Y(f, b.y));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function trees(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  if (g.survey < 0.2) return;
  ctx.save();
  ctx.strokeStyle = pal.graphite;
  ctx.lineWidth = 0.8;
  for (const t of TREES) {
    const vis = revealed(t, g.survey);
    if (vis < 0.4) continue;
    ctx.globalAlpha = 0.25 * vis;
    const x = X(f, t.x);
    const y = Y(f, t.y);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2.4, y + 5);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2.4, y + 5);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
  }
  ctx.restore();
}

function rice(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  if (g.survey < 0.45) return;
  ctx.save();
  ctx.strokeStyle = pal.faint;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.28;
  for (let y = 300; y < 540; y += 10) {
    for (let x = 480; x < 820; x += 14) {
      if (revealed({ x, y }, g.survey) < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(X(f, x), Y(f, y));
      ctx.lineTo(X(f, x + 6), Y(f, y + 4));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function floodZone(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  if (g.survey < 0.55 && g.floodStatus !== "incumplido") return;
  ctx.save();
  strokePts(ctx, f, RIVER);
  ctx.strokeStyle = pal.cyan;
  const hot =
    g.floodStatus === "incumplido" ||
    (g.floodStatus === "pendiente" && clockOf(g.siteMinutes).day >= 10);
  ctx.globalAlpha = hot ? 0.22 : 0.12;
  ctx.lineWidth = hot ? 36 : 28;
  ctx.lineCap = "round";
  ctx.stroke();
  if (g.floodStatus === "incumplido") {
    strokePts(ctx, f, RIVER);
    ctx.strokeStyle = pal.rust;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 52;
    ctx.stroke();
    strokePts(ctx, f, RIVER);
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = pal.cyan;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 44;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 0.85;
  ctx.font = "600 11px 'IBM Plex Sans Condensed', sans-serif";
  ctx.fillStyle = pal.cyan;
  ctx.letterSpacing = "0.12em";
  const p = P(f, { x: 520, y: 500 });
  ctx.fillText("ZONA DE INUNDACIÓN · COTA +31,2", p.x, p.y);
  ctx.letterSpacing = "0";
  ctx.restore();
  if (g.floodStatus === "incumplido") {
    ctx.save();
    ctx.translate(X(f, 500), Y(f, 350));
    ctx.rotate(-0.22);
    ctx.font = "600 26px 'IBM Plex Sans Condensed', sans-serif";
    ctx.letterSpacing = "0.18em";
    ctx.strokeStyle = pal.rust;
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = 0.62;
    ctx.textAlign = "center";
    ctx.strokeText("PLAZO INCUMPLIDO", 0, 0);
    ctx.letterSpacing = "0";
    ctx.restore();
  }
}

function strokeStyleFor(stage: Stage): { w: number; dash: number[]; alpha: number } {
  switch (stage) {
    case "vacio":
      return { w: 1, dash: [6, 6], alpha: 0.45 };
    case "levantado":
      return { w: 1.1, dash: [4, 5], alpha: 0.7 };
    case "trazado":
      return { w: 1.4, dash: [], alpha: 0.9 };
    case "excavacion":
      return { w: 5, dash: [], alpha: 0.55 };
    case "armado":
      return { w: 5.5, dash: [2, 3], alpha: 0.8 };
    case "encofrado":
      return { w: 6, dash: [], alpha: 0.85 };
    default:
      return { w: 7, dash: [], alpha: 1 };
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  const s = g.structures.camino;
  const ghost = g.survey < 1 && !s.opened;
  ctx.save();
  strokePts(ctx, f, ROAD);
  if (ghost || s.stage === "vacio") {
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    return;
  }
  const st = strokeStyleFor(s.stage);
  ctx.setLineDash(st.dash);
  ctx.strokeStyle = s.stage === "conexion" || s.stage === "estructura" ? pal.ink : pal.graphite;
  ctx.globalAlpha = st.alpha;
  ctx.lineWidth = st.w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  if (s.stage === "conexion") {
    ctx.strokeStyle = pal.cyan;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBridge(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  const s = g.structures.puente;
  const vis = revealed(STRUCTURES.puente, g.survey);
  if (vis < 0.4 && !s.opened) return;
  const p = P(f, STRUCTURES.puente);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-0.45);
  ctx.strokeStyle = pal.ink;
  ctx.globalAlpha = 0.4 + vis * 0.6;
  ctx.lineWidth = 1;
  const k = stageIndex(s.stage);
  if (k <= 1) {
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(-22, -7, 44, 14);
  } else if (k === 2) {
    ctx.strokeRect(-22, -8, 44, 16);
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(22, 0);
    ctx.stroke();
  } else if (k === 3) {
    ctx.fillStyle = pal.faint;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(-18, 4, 12, 8);
    ctx.fillRect(6, 4, 12, 8);
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(-18, 4, 12, 8);
    ctx.strokeRect(6, 4, 12, 8);
  } else {
    ctx.fillStyle = pal.graphite;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-26, -5, 52, 10);
    ctx.fillRect(-14, 5, 5, 12);
    ctx.fillRect(8, 5, 5, 12);
    ctx.strokeStyle = pal.ink;
    ctx.strokeRect(-26, -5, 52, 10);
    if (k >= 7) {
      ctx.strokeStyle = pal.cyan;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-26, -5);
      ctx.lineTo(26, -5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWall(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  const s = g.structures.muro;
  if (revealed(STRUCTURES.muro, g.survey) < 0.35 && !s.opened) return;
  ctx.save();
  strokePts(ctx, f, WALL);
  const k = stageIndex(s.stage);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (k <= 1) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = pal.faint;
    ctx.lineWidth = 1.2;
  } else if (k < 5) {
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 3.5;
  } else {
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 6;
  }
  ctx.stroke();
  ctx.restore();
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  id: StructureId,
  g: Game,
  pal: Palette,
): void {
  const s = g.structures[id];
  if (g.instruction !== "dirige" && !s.opened) return;
  const d = STRUCTURES[id];
  if (revealed(d, g.survey) < 0.35 && !s.opened) return;
  const p = P(f, d);
  const k = stageIndex(s.stage);
  const w = id === "planta" ? 34 : 40;
  const h = id === "planta" ? 26 : 22;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = pal.ink;
  ctx.globalAlpha = 0.55 + Math.min(0.45, k / 8);
  ctx.lineWidth = 1;
  if (k <= 1) {
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  } else if (k === 2) {
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.moveTo(w / 2, -h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = pal.graphite;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = pal.ink;
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    if (id === "planta" && k >= 6) {
      ctx.beginPath();
      ctx.arc(-8, 0, 7, 0, Math.PI * 2);
      ctx.arc(8, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawViaduct(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  const s = g.structures.viaducto;
  if ((g.instruction !== "dirige" && !s.opened) || (revealed(STRUCTURES.viaducto, g.survey) < 0.4 && !s.opened)) {
    return;
  }
  const k = stageIndex(s.stage);
  ctx.save();
  strokePts(ctx, f, VIADUCT);
  ctx.lineCap = "round";
  if (k <= 1) {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = pal.faint;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (k < 5) {
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
}

function stake(ctx: CanvasRenderingContext2D, f: Frame, pal: Palette, pulse: boolean): void {
  const p = P(f, STAKE);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -18);
  ctx.stroke();
  ctx.restore();
  cross(ctx, p.x, p.y - 18, pal);
  if (pulse) {
    ctx.save();
    ctx.strokeStyle = pal.rust;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function crews(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  for (const id of STRUCTURE_IDS) {
    if (!g.structures[id].opened) continue;
    const c = crewAt(g, id);
    const n = c.obreros + c.capataces + c.ingenieros + c.topografos;
    const p = P(f, STRUCTURES[id]);
    flag(ctx, p.x + 18, p.y - 4, pal);
    const dotsN = Math.min(3, n === 0 ? 0 : Math.max(1, Math.ceil(n / 5)));
    dots(ctx, p.x, p.y + 14, dotsN, pal);
  }
  if (g.surveying && g.survey < 1) {
    const p = P(f, STAKE);
    dots(ctx, p.x + 16, p.y + 8, 2, pal);
  }
  void crewsAt;
}

function overlaps(
  a: { l: number; t: number; r: number; b: number },
  b: { l: number; t: number; r: number; b: number },
): boolean {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

function labels(ctx: CanvasRenderingContext2D, f: Frame, g: Game, pal: Palette): void {
  ctx.save();
  ctx.font = "500 10px 'IBM Plex Sans Condensed', sans-serif";
  ctx.fillStyle = pal.graphite;
  ctx.globalAlpha = 0.85;
  ctx.textAlign = "left";
  ctx.letterSpacing = "0.06em";
  ctx.fillText(`${SITE.valle.toUpperCase()}  ·  ${SITE.municipio.toUpperCase()}`, f.x + 4, f.y + 14);
  ctx.letterSpacing = "0.03em";
  ctx.fillText(`${SITE.lat}   ${SITE.lon}`, f.x + 4, f.y + 28);
  ctx.fillText(`UTM ${SITE.utmZone}  ${SITE.easting}  ${SITE.northing}`, f.x + 4, f.y + 42);
  ctx.fillText(`${SITE.datum}  ·  cota est. ${SITE.cota}  ·  ${SITE.scale}`, f.x + 4, f.y + 56);
  ctx.fillText(`declinación ${SITE.declinacion}`, f.x + 4, f.y + 70);
  const t = clockOf(g.siteMinutes);
  ctx.textAlign = "right";
  ctx.fillText("HOJA 1 DE 1", f.x + f.w - 4, f.y + f.h - 8);
  ctx.fillText(`${SITE.valle.toUpperCase()}  ·  ${t.label}`, f.x + f.w - 4, f.y + f.h + 8);
  ctx.letterSpacing = "0";
  ctx.restore();
  if (g.survey < 0.2) {
    ctx.save();
    ctx.font = "500 13px 'IBM Plex Sans Condensed', sans-serif";
    ctx.fillStyle = pal.faint;
    ctx.textAlign = "center";
    ctx.letterSpacing = "0.28em";
    ctx.fillText("TERRENO SIN LEVANTAR", f.x + f.w / 2, f.y + f.h * 0.44);
    ctx.letterSpacing = "0";
    ctx.restore();
  }
  const boxes: { l: number; t: number; r: number; b: number }[] = [];
  const claim = (box: (typeof boxes)[number], force: boolean) => {
    if (!force && boxes.some((b) => overlaps(box, b))) return false;
    boxes.push(box);
    return true;
  };
  const order = [...STRUCTURE_IDS].sort((a, b) =>
    g.selected === a ? -1 : g.selected === b ? 1 : +!g.structures[a].opened - +!g.structures[b].opened,
  );
  for (const id of order) {
    const s = g.structures[id];
    const d = STRUCTURES[id];
    if ((!isPliego(id) && !s.opened && g.instruction !== "dirige") || (g.survey < 1 && revealed(d, g.survey) < 0.5 && !s.opened)) {
      continue;
    }
    const p = P(f, d);
    const sel = g.selected === id;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = sel
      ? "600 11px 'IBM Plex Sans Condensed', sans-serif"
      : "600 10px 'IBM Plex Sans Condensed', sans-serif";
    ctx.letterSpacing = "0.1em";
    const name = STRUCT_SHORT[id];
    const w = Math.max(48, ctx.measureText(name).width + 8);
    if (!claim({ l: p.x - w / 2, t: p.y - 36, r: p.x + w / 2, b: p.y - 4 }, sel || s.opened)) {
      ctx.restore();
      continue;
    }
    ctx.fillStyle = s.opened ? pal.ink : pal.graphite;
    ctx.fillText(name, p.x, p.y - 24);
    ctx.font = "500 9px 'IBM Plex Sans Condensed', sans-serif";
    ctx.letterSpacing = "0.08em";
    if (s.opened) {
      ctx.fillStyle = pal.cyan;
      ctx.fillText(STAGE_SHORT[s.stage], p.x, p.y - 12);
      const btl = bottle(g, id);
      if (btl) {
        ctx.fillStyle = pal.rust;
        ctx.fillText(btl, p.x, p.y + 24);
      }
    } else if (g.survey >= 1) {
      ctx.fillStyle = pal.faint;
      ctx.fillText(STAGE_SHORT.vacio, p.x, p.y - 12);
    }
    ctx.letterSpacing = "0";
    ctx.restore();
  }
  if (g.survey > 0.5) {
    ctx.save();
    ctx.font = "italic 500 13px 'Cormorant Garamond', serif";
    ctx.fillStyle = pal.graphite;
    ctx.globalAlpha = 0.75;
    const places: { x: number; y: number; name: string; elev?: string }[] = [
      { x: 470, y: 90, name: "cerro norte", elev: "68 m" },
      { x: 600, y: 560, name: "valle", elev: "12 m" },
      { x: 250, y: 240, name: "cañada", elev: "31 m" },
      { x: 780, y: 180, name: "loma este", elev: "54 m" },
      { x: 530, y: 430, name: "terraza aluvial", elev: "21 m" },
      { x: 130, y: 560, name: "camino vecinal", elev: "18 m" },
      { x: 340, y: 360, name: "vado", elev: "14 m" },
      { x: 430, y: 160, name: "ladera norte", elev: "49 m" },
    ];
    ctx.textAlign = "left";
    for (const pl of places) {
      const p = P(f, pl);
      const w = ctx.measureText(pl.name).width + 8;
      if (!claim({ l: p.x, t: p.y - 12, r: p.x + w, b: p.y + 16 }, false)) continue;
      ctx.fillText(pl.name, p.x, p.y);
      if (g.survey > 0.72 && pl.elev) {
        ctx.save();
        ctx.font = "500 9px 'IBM Plex Sans Condensed', sans-serif";
        ctx.fillStyle = pal.faint;
        ctx.fillText(pl.elev, p.x, p.y + 12);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

function visitaMark(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
  ctx.save();
  ctx.translate(w * 0.78, h * 0.58);
  ctx.rotate(-0.42);
  ctx.font = "600 64px 'IBM Plex Sans Condensed', sans-serif";
  ctx.letterSpacing = "0.28em";
  ctx.strokeStyle = pal.rust;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.14;
  ctx.textAlign = "center";
  ctx.strokeText("VISITA", 0, 0);
  ctx.letterSpacing = "0";
  ctx.restore();
}

function vecinal(ctx: CanvasRenderingContext2D, f: Frame, pal: Palette): void {
  ctx.save();
  strokePts(ctx, f, PATH);
  ctx.setLineDash([2, 7]);
  ctx.strokeStyle = pal.faint;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

const M_PER = 2;
const LAT0 = 18 + 29 / 60 + 14 / 3600;
const LON0 = -69.8561111111111;
const EAST0 = 412086;
const NORTH0 = 2184320;

export function coordOf(x: number, y: number) {
  const east = EAST0 + (x - STAKE.x) * M_PER;
  const north = NORTH0 + (STAKE.y - y) * M_PER;
  const lat = LAT0 + ((STAKE.y - y) * M_PER) / 110540;
  const lon = LON0 + ((x - STAKE.x) * M_PER) / (111320 * Math.cos((LAT0 * Math.PI) / 180));
  return {
    east,
    north,
    lat,
    lon,
    latLabel: dms(lat, "N", "S"),
    lonLabel: dms(lon, "E", "O"),
    utm: `19N  ${east.toFixed(0)} m E  ·  ${north.toFixed(0)} m N`,
  };
}

function dms(v: number, pos: string, neg: string): string {
  const hemi = v >= 0 ? pos : neg;
  const abs = Math.abs(v);
  const deg = Math.floor(abs);
  const minRaw = (abs - deg) * 60;
  const min = Math.floor(minRaw);
  const sec = ((minRaw - min) * 60).toFixed(1).replace(".", ",");
  return `${deg}° ${String(min).padStart(2, "0")}′ ${sec}″ ${hemi}`;
}

export function drawSheet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  game: Game,
  pal: Palette,
  cursor: Pt | null,
  opts?: { visita?: boolean },
): void {
  ctx.clearRect(0, 0, w, h);
  cropMarks(ctx, w, h, pal);
  const f = sheetFrame(w, h);
  ctx.strokeStyle = pal.rule;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 0.85;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  ctx.globalAlpha = 1;
  grid(ctx, f, game, pal);
  contours(ctx, f, game, pal);
  floodZone(ctx, f, game, pal);
  river(ctx, f, game, pal);
  rice(ctx, f, game, pal);
  trees(ctx, f, game, pal);
  vecinal(ctx, f, pal);
  drawRoad(ctx, f, game, pal);
  drawWall(ctx, f, game, pal);
  drawBox(ctx, f, "cimentacion", game, pal);
  drawBox(ctx, f, "planta", game, pal);
  drawViaduct(ctx, f, game, pal);
  drawBridge(ctx, f, game, pal);
  stake(ctx, f, pal, game.survey < 1);
  crews(ctx, f, game, pal);
  labels(ctx, f, game, pal);
  if (opts?.visita) visitaMark(ctx, w, h, pal);
  north(ctx, f.x + f.w - 32, f.y + 40, pal);
  scalebar(ctx, f.x + 12, f.y + f.h - 44, pal);
  if (cursor) {
    const map = { x: ((cursor.x - f.x) / f.w) * MAP_W, y: ((cursor.y - f.y) / f.h) * MAP_H };
    const c = coordOf(map.x, map.y);
    ctx.font = "500 12px 'IBM Plex Sans Condensed', sans-serif";
    ctx.fillStyle = pal.ink;
    ctx.textAlign = "left";
    ctx.fillText(`${c.latLabel}  ·  ${c.lonLabel}`, cursor.x + 10, cursor.y - 20);
    ctx.fillStyle = pal.graphite;
    ctx.fillText(c.utm, cursor.x + 10, cursor.y - 6);
  }
  if (game.selected) {
    const p = P(f, STRUCTURES[game.selected]);
    ctx.strokeStyle = pal.rust;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export type Hit =
  | { type: "instruction" }
  | { type: "stake" }
  | { type: "structure"; id: StructureId }
  | null;

export function hitTest(x: number, y: number, w: number, h: number, g: Game): Hit {
  const f = sheetFrame(w, h);
  const bottom = f.y + f.h - 18;
  if (
    g.instruction === "levanta" &&
    g.survey < 1 &&
    Math.abs(y - bottom) < 28 &&
    Math.abs(x - (f.x + f.w / 2)) < 240
  ) {
    return { type: "instruction" };
  }
  const stakePt = P(f, STAKE);
  if (dist({ x, y }, stakePt) < 44) return { type: "stake" };
  let best: { id: StructureId; d: number } | null = null;
  for (const id of STRUCTURE_IDS) {
    const d = STRUCTURES[id];
    const opened = g.structures[id].opened;
    if ((!isPliego(id) && !opened && g.instruction !== "dirige") || (revealed(d, g.survey) < 0.35 && !opened)) {
      continue;
    }
    const p = P(f, d);
    const dd = dist({ x, y }, p);
    if (dd < 44 && (!best || dd < best.d)) best = { id, d: dd };
  }
  return best ? { type: "structure", id: best.id } : null;
}

export { MAP_W, MAP_H, PLIEGO_IDS };
