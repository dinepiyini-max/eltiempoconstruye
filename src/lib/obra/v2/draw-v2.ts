/**
 * Dibujo de NUEVA OBRA. Canvas propio. No es draw.ts del Yuna.
 */
import {
  cornersOf,
  distToSegment,
  formatMeters,
  muroLargo,
  muroPoly,
  type Muro,
  type Pt,
  type SnapKind,
} from "./geometry.ts";
import { V2_SHEET } from "./tables.ts";
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

export type DrawNuevaInput = {
  walls: readonly Muro[];
  selectedId: string | null;
  draft: Draft | null;
  view: V2View;
};

function strokePoly(ctx: CanvasRenderingContext2D, pts: Pt[], view: V2View, closed: boolean) {
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

function drawCota(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, view: V2View, pal: Palette, label: string) {
  const L = muroLargo({ a, b });
  if (L < 0.05) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = -dy / L;
  const ny = dx / L;
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

function drawWall(ctx: CanvasRenderingContext2D, m: Muro, view: V2View, pal: Palette, selected: boolean) {
  const poly = muroPoly(m);
  ctx.save();
  strokePoly(ctx, poly, view, true);
  ctx.fillStyle = selected ? pal.cyan : pal.graphite;
  ctx.globalAlpha = selected ? 0.28 : 0.18;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = selected ? pal.cyan : pal.ink;
  ctx.lineWidth = selected ? 2 : 1.2;
  ctx.stroke();
  if (selected) {
    for (const p of [m.a, m.b]) {
      const s = toScreen(view, p);
      ctx.fillStyle = pal.paper;
      ctx.strokeStyle = pal.cyan;
      ctx.lineWidth = 1.4;
      ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
      ctx.strokeRect(s.x - 4, s.y - 4, 8, 8);
    }
    drawCota(ctx, m.a, m.b, view, pal, formatMeters(muroLargo(m)));
  }
  ctx.restore();
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
  ctx.fillText("NUEVA OBRA · LÁMINA 01 · MUROS", w - 16, 22);
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
  for (const m of input.walls) {
    drawWall(ctx, m, input.view, pal, m.id === input.selectedId);
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
