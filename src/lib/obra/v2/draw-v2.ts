/**
 * Dibujo de NUEVA OBRA. Canvas propio. No es draw.ts del Yuna.
 */
import {
  cornersOf,
  distToSegment,
  formatM2,
  formatMeters,
  huecoEnds,
  hitSquare,
  losaArea,
  muroDir,
  muroLargo,
  muroParts,
  pointInPoly,
  polygonCentroid,
  rectPoly,
  squarePoly,
  thickPoly,
  vigaLargo,
  type Columna,
  type Hueco,
  type Losa,
  type Muro,
  type Pt,
  type SnapKind,
  type Viga,
  type Zapata,
} from "./geometry.ts";
import { V2_MURO, V2_SHEET } from "./tables.ts";
import type { V2View } from "./persist-v2.ts";

export type Palette = {
  paper: string;
  ink: string;
  graphite: string;
  faint: string;
  cyan: string;
  rust: string;
  rule: string;
};

export function paletteFrom(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const read = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    paper: read("--color-paper", "#efe6d0"),
    ink: read("--color-ink", "#2c2a26"),
    graphite: read("--color-graphite", "#3f3c36"),
    faint: read("--color-faint", "#b9ad93"),
    cyan: read("--color-cyan", "#2f6a78"),
    rust: read("--color-rust", "#c45c26"),
    rule: read("--color-rule", "#c4b79a"),
  };
}

export function toScreen(view: V2View, p: Pt): Pt {
  return { x: (p.x - view.panX) * view.ppm, y: (p.y - view.panY) * view.ppm };
}

export function toWorld(view: V2View, p: Pt): Pt {
  return { x: view.panX + p.x / view.ppm, y: view.panY + p.y / view.ppm };
}

export function fitView(w: number, h: number): V2View {
  const pad = 36;
  const ppm = Math.max(8, Math.min((w - pad * 2) / V2_SHEET.widthM, (h - pad * 2) / V2_SHEET.heightM));
  return { panX: -pad / ppm, panY: -pad / ppm, ppm };
}

export function zoomAt(view: V2View, screen: Pt, factor: number): V2View {
  const world = toWorld(view, screen);
  const ppm = Math.max(8, Math.min(96, view.ppm * factor));
  return {
    ppm,
    panX: world.x - screen.x / ppm,
    panY: world.y - screen.y / ppm,
  };
}

export type Draft = { a: Pt; b: Pt; kind: SnapKind };

export type HuecoPreview = Pick<Hueco, "kind" | "wallId" | "alongM" | "ancho">;

export type DrawNuevaInput = {
  walls: readonly Muro[];
  openings: readonly Hueco[];
  columns?: readonly Columna[];
  footings?: readonly Zapata[];
  beams?: readonly Viga[];
  slabs?: readonly Losa[];
  selectedId: string | null;
  draft: Draft | null;
  polyDraft?: readonly Pt[];
  rectPreview?: { a: Pt; b: Pt } | null;
  view: V2View;
  hover?: HuecoPreview | null;
  cursor?: Pt | null;
};

function strokePoly(ctx: CanvasRenderingContext2D, pts: readonly Pt[], view: V2View, closed: boolean) {
  if (pts.length < 2) return;
  const s0 = toScreen(view, pts[0]!);
  ctx.beginPath();
  ctx.moveTo(s0.x, s0.y);
  for (let i = 1; i < pts.length; i++) {
    const s = toScreen(view, pts[i]!);
    ctx.lineTo(s.x, s.y);
  }
  if (closed) ctx.closePath();
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, view: V2View, pal: Palette) {
  const a = toWorld(view, { x: 0, y: 0 });
  const b = toWorld(view, { x: w, y: h });
  const x0 = Math.floor(a.x) - 1;
  const y0 = Math.floor(a.y) - 1;
  const x1 = Math.ceil(b.x) + 1;
  const y1 = Math.ceil(b.y) + 1;

  ctx.save();
  for (let x = x0; x <= x1; x++) {
    const s = toScreen(view, { x, y: 0 });
    ctx.beginPath();
    ctx.moveTo(s.x, 0);
    ctx.lineTo(s.x, h);
    ctx.strokeStyle = x % 5 === 0 ? pal.rule : pal.faint;
    ctx.globalAlpha = x % 5 === 0 ? 0.7 : 0.35;
    ctx.lineWidth = x === 0 ? 1.4 : 1;
    ctx.stroke();
  }
  for (let y = y0; y <= y1; y++) {
    const s = toScreen(view, { x: 0, y });
    ctx.beginPath();
    ctx.moveTo(0, s.y);
    ctx.lineTo(w, s.y);
    ctx.strokeStyle = y % 5 === 0 ? pal.rule : pal.faint;
    ctx.globalAlpha = y % 5 === 0 ? 0.7 : 0.35;
    ctx.lineWidth = y === 0 ? 1.4 : 1;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.2;
  const sheet = [
    { x: 0, y: 0 },
    { x: V2_SHEET.widthM, y: 0 },
    { x: V2_SHEET.widthM, y: V2_SHEET.heightM },
    { x: 0, y: V2_SHEET.heightM },
  ];
  strokePoly(ctx, sheet, view, true);
  ctx.stroke();
  ctx.restore();
}

function drawCota(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  view: V2View,
  pal: Palette,
  label: string,
  side: 1 | -1 = 1,
) {
  const L = muroLargo({ a, b });
  if (L < 0.05) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = (-dy / L) * side;
  const ny = (dx / L) * side;
  const off = Math.max(0.35, 14 / view.ppm);
  const a2 = { x: a.x + nx * off, y: a.y + ny * off };
  const b2 = { x: b.x + nx * off, y: b.y + ny * off };
  const sa = toScreen(view, a2);
  const sb = toScreen(view, b2);
  ctx.save();
  ctx.strokeStyle = pal.cyan;
  ctx.fillStyle = pal.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  const tick = 5;
  const hyp = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
  const tx = ((sb.x - sa.x) / hyp) * tick;
  const ty = ((sb.y - sa.y) / hyp) * tick;
  ctx.beginPath();
  ctx.moveTo(sa.x - ty, sa.y + tx);
  ctx.lineTo(sa.x + ty, sa.y - tx);
  ctx.moveTo(sb.x - ty, sb.y + tx);
  ctx.lineTo(sb.x + ty, sb.y - tx);
  ctx.stroke();
  const mid = toScreen(view, { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 });
  ctx.font = "600 12px 'IBM Plex Sans Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = pal.paper;
  const tw = ctx.measureText(label).width + 8;
  ctx.fillRect(mid.x - tw / 2, mid.y - 16, tw, 16);
  ctx.fillStyle = pal.ink;
  ctx.fillText(label, mid.x, mid.y - 2);
  ctx.restore();
}

function drawHiladas(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  espesor: number,
  view: V2View,
  pal: Palette,
) {
  const step = V2_MURO.hiladaM;
  if (view.ppm * step < 6) return;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < step) return;
  const ux = (b.x - a.x) / L;
  const uy = (b.y - a.y) / L;
  const nx = -uy;
  const ny = ux;
  const half = (espesor / 2) * 0.72;
  const n = Math.floor(L / step);
  ctx.save();
  ctx.strokeStyle = pal.faint;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  for (let i = 1; i < n; i++) {
    const t = i * step;
    const px = a.x + ux * t;
    const py = a.y + uy * t;
    const s1 = toScreen(view, { x: px + nx * half, y: py + ny * half });
    const s2 = toScreen(view, { x: px - nx * half, y: py - ny * half });
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  espesor: number,
  view: V2View,
  pal: Palette,
  selected: boolean,
) {
  const poly = thickPoly(a, b, espesor);
  strokePoly(ctx, poly, view, true);
  ctx.fillStyle = selected ? pal.cyan : pal.graphite;
  ctx.globalAlpha = selected ? 0.28 : 0.18;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = selected ? pal.cyan : pal.ink;
  ctx.lineWidth = selected ? 2 : 1.2;
  ctx.stroke();
  drawHiladas(ctx, a, b, espesor, view, pal);
}

function drawJamb(
  ctx: CanvasRenderingContext2D,
  m: Muro,
  p: Pt,
  view: V2View,
  pal: Palette,
  selected: boolean,
) {
  const { nx, ny } = muroDir(m);
  const half = m.espesor / 2 + 0.04;
  const a = { x: p.x + nx * half, y: p.y + ny * half };
  const b = { x: p.x - nx * half, y: p.y - ny * half };
  const sa = toScreen(view, a);
  const sb = toScreen(view, b);
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.strokeStyle = selected ? pal.cyan : pal.ink;
  ctx.lineWidth = selected ? 2 : 1.4;
  ctx.stroke();
}

function drawHueco(
  ctx: CanvasRenderingContext2D,
  m: Muro,
  h: Hueco | HuecoPreview,
  view: V2View,
  pal: Palette,
  selected: boolean,
  preview: boolean,
) {
  const ends = huecoEnds(m, h);
  if (!ends) return;
  ctx.save();
  if (preview) ctx.globalAlpha = 0.55;
  drawJamb(ctx, m, ends.a, view, pal, selected);
  drawJamb(ctx, m, ends.b, view, pal, selected);

  const { nx, ny, dx, dy } = muroDir(m);
  if (h.kind === "ventana") {
    const inset = Math.max(0.03, m.espesor * 0.22);
    const a1 = { x: ends.a.x + nx * inset, y: ends.a.y + ny * inset };
    const b1 = { x: ends.b.x + nx * inset, y: ends.b.y + ny * inset };
    const a2 = { x: ends.a.x - nx * inset, y: ends.a.y - ny * inset };
    const b2 = { x: ends.b.x - nx * inset, y: ends.b.y - ny * inset };
    ctx.strokeStyle = selected ? pal.cyan : pal.graphite;
    ctx.lineWidth = 1;
    const sA1 = toScreen(view, a1);
    const sB1 = toScreen(view, b1);
    const sA2 = toScreen(view, a2);
    const sB2 = toScreen(view, b2);
    ctx.beginPath();
    ctx.moveTo(sA1.x, sA1.y);
    ctx.lineTo(sB1.x, sB1.y);
    ctx.moveTo(sA2.x, sA2.y);
    ctx.lineTo(sB2.x, sB2.y);
    ctx.stroke();
  } else {
    const hinge = ends.a;
    const leaf = ends.b;
    const radius = h.ancho;
    const open = { x: hinge.x + nx * radius, y: hinge.y + ny * radius };
    ctx.strokeStyle = selected ? pal.cyan : pal.ink;
    ctx.lineWidth = 1;
    ctx.setLineDash(preview ? [5, 4] : []);
    const sH = toScreen(view, hinge);
    const sL = toScreen(view, leaf);
    const sO = toScreen(view, open);
    ctx.beginPath();
    ctx.moveTo(sH.x, sH.y);
    ctx.lineTo(sO.x, sO.y);
    ctx.stroke();
    ctx.beginPath();
    const start = Math.atan2(sL.y - sH.y, sL.x - sH.x);
    const end = Math.atan2(sO.y - sH.y, sO.x - sH.x);
    const rPx = radius * view.ppm;
    const cross = dx * ny - dy * nx;
    ctx.arc(sH.x, sH.y, rPx, start, end, cross > 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (!preview) drawCota(ctx, ends.a, ends.b, view, pal, formatMeters(h.ancho), -1);
  ctx.restore();
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  m: Muro,
  openings: readonly Hueco[],
  view: V2View,
  pal: Palette,
  selected: boolean,
  selectedHuecoId: string | null,
  showMeta: boolean,
) {
  const mine = openings.filter((h) => h.wallId === m.id);
  const parts = muroParts(m, mine);
  ctx.save();
  for (const p of parts) {
    drawBody(ctx, p.a, p.b, m.espesor, view, pal, selected);
  }
  if (parts.length === 0 && mine.length === 0) {
    drawBody(ctx, m.a, m.b, m.espesor, view, pal, selected);
  }
  for (const h of mine) {
    const hid = "id" in h ? h.id : "";
    drawHueco(ctx, m, h, view, pal, hid === selectedHuecoId, false);
  }
  if (showMeta) {
    for (const p of [m.a, m.b]) {
      const s = toScreen(view, p);
      ctx.fillStyle = pal.paper;
      ctx.strokeStyle = pal.cyan;
      ctx.lineWidth = 1.4;
      ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
      ctx.strokeRect(s.x - 4, s.y - 4, 8, 8);
    }
    drawCota(ctx, m.a, m.b, view, pal, formatMeters(muroLargo(m)), 1);
  }
  ctx.restore();
}

function drawSquare(
  ctx: CanvasRenderingContext2D,
  c: Pt,
  lado: number,
  view: V2View,
  pal: Palette,
  selected: boolean,
  fill: boolean,
) {
  const poly = squarePoly(c, lado);
  strokePoly(ctx, poly, view, true);
  ctx.save();
  ctx.fillStyle = selected ? pal.cyan : pal.graphite;
  ctx.globalAlpha = fill ? (selected ? 0.4 : 0.28) : selected ? 0.12 : 0.06;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = selected ? pal.cyan : pal.ink;
  ctx.lineWidth = selected ? 2 : fill ? 1.4 : 1.1;
  if (!fill) ctx.setLineDash([5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawVigaBeam(
  ctx: CanvasRenderingContext2D,
  v: Viga,
  view: V2View,
  pal: Palette,
  selected: boolean,
) {
  drawBody(ctx, v.a, v.b, v.ancho, view, pal, selected);
  if (selected) drawCota(ctx, v.a, v.b, view, pal, formatMeters(vigaLargo(v)), 1);
}

function drawSlab(
  ctx: CanvasRenderingContext2D,
  l: Losa,
  view: V2View,
  pal: Palette,
  selected: boolean,
) {
  if (l.poly.length < 3) return;
  strokePoly(ctx, l.poly, view, true);
  ctx.save();
  ctx.fillStyle = selected ? pal.cyan : pal.graphite;
  ctx.globalAlpha = selected ? 0.22 : 0.1;
  ctx.fill();
  ctx.clip();
  const screens = l.poly.map((p) => toScreen(view, p));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of screens) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x);
    maxY = Math.max(maxY, s.y);
  }
  ctx.strokeStyle = pal.cyan;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  const step = 10;
  for (let x = minX - (maxY - minY); x < maxX + (maxY - minY); x += step) {
    ctx.beginPath();
    ctx.moveTo(x, minY);
    ctx.lineTo(x + (maxY - minY), maxY);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = selected ? pal.cyan : pal.ink;
  ctx.lineWidth = selected ? 2 : 1.2;
  strokePoly(ctx, l.poly, view, true);
  ctx.stroke();
  if (selected) {
    const mid = polygonCentroid(l.poly);
    const s = toScreen(view, mid);
    const label = formatM2(losaArea(l));
    ctx.font = "600 12px 'IBM Plex Sans Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = pal.paper;
    ctx.fillRect(s.x - tw / 2, s.y - 8, tw, 16);
    ctx.fillStyle = pal.ink;
    ctx.fillText(label, s.x, s.y);
  }
  ctx.restore();
}

function drawPolyDraft(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  cursor: Pt | null,
  view: V2View,
  pal: Palette,
) {
  if (!pts.length) return;
  const drawPts = cursor ? pts.concat([cursor]) : pts;
  ctx.save();
  ctx.strokeStyle = pal.cyan;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.6;
  strokePoly(ctx, drawPts, view, false);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = pal.cyan;
  for (const p of pts) {
    const s = toScreen(view, p);
    ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
  }
  ctx.restore();
  if (drawPts.length >= 3) {
    const area = Math.abs(
      drawPts.reduce((acc, p, i) => {
        const n = drawPts[(i + 1) % drawPts.length]!;
        return acc + p.x * n.y - n.x * p.y;
      }, 0) / 2,
    );
    if (area > 0.05) {
      const a = pts[0]!;
      const b = cursor ?? pts[pts.length - 1]!;
      drawCota(ctx, a, b, view, pal, formatM2(area), 1);
    }
  }
}

function drawScale(ctx: CanvasRenderingContext2D, w: number, h: number, view: V2View, pal: Palette) {
  const meters = view.ppm >= 28 ? 5 : 10;
  const x = 18;
  const y = h - 22;
  const len = meters * view.ppm;
  ctx.save();
  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.moveTo(x + len, y - 5);
  ctx.lineTo(x + len, y + 5);
  ctx.stroke();
  ctx.font = "500 11px 'IBM Plex Sans Condensed', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${meters}.00 m`, x, y - 8);
  ctx.textAlign = "right";
  ctx.globalAlpha = 0.7;
  ctx.fillText("NUEVA OBRA · LÁMINA 01", w - 16, 22);
  ctx.restore();
}

export function drawNueva(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  input: DrawNuevaInput,
  pal: Palette,
) {
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h, input.view, pal);
  const columns = input.columns ?? [];
  const footings = input.footings ?? [];
  const beams = input.beams ?? [];
  const slabs = input.slabs ?? [];
  const selectedHueco = input.openings.find((o) => o.id === input.selectedId) ?? null;

  for (const l of slabs) {
    drawSlab(ctx, l, input.view, pal, l.id === input.selectedId);
  }
  for (const z of footings) {
    drawSquare(ctx, z.c, z.lado, input.view, pal, z.id === input.selectedId, false);
  }
  for (const m of input.walls) {
    const self = m.id === input.selectedId;
    const parent = selectedHueco?.wallId === m.id;
    drawWall(ctx, m, input.openings, input.view, pal, self || parent, selectedHueco?.id ?? null, self);
  }
  for (const v of beams) {
    drawVigaBeam(ctx, v, input.view, pal, v.id === input.selectedId);
  }
  for (const c of columns) {
    drawSquare(ctx, c.c, c.lado, input.view, pal, c.id === input.selectedId, true);
  }
  if (input.hover) {
    const m = input.walls.find((w) => w.id === input.hover!.wallId);
    if (m) drawHueco(ctx, m, input.hover, input.view, pal, true, true);
  }
  if (input.rectPreview) {
    const poly = rectPoly(input.rectPreview.a, input.rectPreview.b);
    ctx.save();
    ctx.strokeStyle = pal.cyan;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.6;
    strokePoly(ctx, poly, input.view, true);
    ctx.stroke();
    ctx.fillStyle = pal.cyan;
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.restore();
    const area =
      Math.abs(input.rectPreview.b.x - input.rectPreview.a.x) * Math.abs(input.rectPreview.b.y - input.rectPreview.a.y);
    if (area > 0.05) {
      drawCota(
        ctx,
        input.rectPreview.a,
        { x: input.rectPreview.b.x, y: input.rectPreview.a.y },
        input.view,
        pal,
        formatM2(area),
        1,
      );
    }
  } else if (input.polyDraft && input.polyDraft.length) {
    drawPolyDraft(ctx, input.polyDraft, input.cursor ?? null, input.view, pal);
  }
  if (input.draft) {
    const { a, b } = input.draft;
    ctx.save();
    ctx.strokeStyle = pal.cyan;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.6;
    const sa = toScreen(input.view, a);
    const sb = toScreen(input.view, b);
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = pal.cyan;
    ctx.fillRect(sa.x - 3, sa.y - 3, 6, 6);
    ctx.fillRect(sb.x - 3, sb.y - 3, 6, 6);
    ctx.restore();
    drawCota(ctx, a, b, input.view, pal, formatMeters(muroLargo({ a, b })));
  }
  const corners = cornersOf(input.walls);
  ctx.save();
  ctx.fillStyle = pal.faint;
  for (const c of corners) {
    const s = toScreen(input.view, c);
    ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
  }
  ctx.restore();
  drawScale(ctx, w, h, input.view, pal);
}

export function hitTestWalls(world: Pt, walls: readonly Muro[], ppm: number): string | null {
  const slack = Math.max(0.12, 14 / ppm);
  let best: { id: string; d: number } | null = null;
  for (const m of walls) {
    const d = distToSegment(world, m.a, m.b);
    if (d <= m.espesor / 2 + slack && (!best || d < best.d)) best = { id: m.id, d };
  }
  return best?.id ?? null;
}

export function hitTestHuecos(
  world: Pt,
  walls: readonly Muro[],
  openings: readonly Hueco[],
  ppm: number,
): string | null {
  const slack = Math.max(0.1, 12 / ppm);
  let best: { id: string; d: number } | null = null;
  for (const h of openings) {
    const m = walls.find((w) => w.id === h.wallId);
    if (!m) continue;
    const ends = huecoEnds(m, h);
    if (!ends) continue;
    const d = distToSegment(world, ends.a, ends.b);
    if (d <= m.espesor / 2 + slack && (!best || d < best.d)) best = { id: h.id, d };
  }
  return best?.id ?? null;
}

export function hitTestColumns(world: Pt, columns: readonly Columna[], ppm: number): string | null {
  const slack = Math.max(0.08, 10 / ppm);
  let best: { id: string; d: number } | null = null;
  for (const c of columns) {
    if (!hitSquare(world, c.c, c.lado, slack)) continue;
    const d = Math.hypot(world.x - c.c.x, world.y - c.c.y);
    if (!best || d < best.d) best = { id: c.id, d };
  }
  return best?.id ?? null;
}

export function hitTestFootings(world: Pt, footings: readonly Zapata[], ppm: number): string | null {
  const slack = Math.max(0.08, 10 / ppm);
  let best: { id: string; d: number } | null = null;
  for (const z of footings) {
    if (!hitSquare(world, z.c, z.lado, slack)) continue;
    const d = Math.hypot(world.x - z.c.x, world.y - z.c.y);
    if (!best || d < best.d) best = { id: z.id, d };
  }
  return best?.id ?? null;
}

export function hitTestBeams(world: Pt, beams: readonly Viga[], ppm: number): string | null {
  const slack = Math.max(0.12, 14 / ppm);
  let best: { id: string; d: number } | null = null;
  for (const v of beams) {
    const d = distToSegment(world, v.a, v.b);
    if (d <= v.ancho / 2 + slack && (!best || d < best.d)) best = { id: v.id, d };
  }
  return best?.id ?? null;
}

export function hitTestSlabs(world: Pt, slabs: readonly Losa[]): string | null {
  for (let i = slabs.length - 1; i >= 0; i--) {
    const l = slabs[i]!;
    if (pointInPoly(world, l.poly)) return l.id;
  }
  return null;
}

export function hitTestAll(
  world: Pt,
  scene: {
    walls: readonly Muro[];
    openings: readonly Hueco[];
    columns: readonly Columna[];
    footings: readonly Zapata[];
    beams: readonly Viga[];
  } & { slabs: readonly Losa[] },
  ppm: number,
): string | null {
  return (
    hitTestHuecos(world, scene.walls, scene.openings, ppm) ??
    hitTestColumns(world, scene.columns, ppm) ??
    hitTestBeams(world, scene.beams, ppm) ??
    hitTestWalls(world, scene.walls, ppm) ??
    hitTestFootings(world, scene.footings, ppm) ??
    hitTestSlabs(world, scene.slabs)
  );
}
