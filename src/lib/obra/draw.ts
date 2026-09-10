import { MAP_STAGE, NEXT_HITO, RIVER_NAME, SITE_GEO, STAGE_LABEL, STRUCTURE_DEF, STRUCTURE_NAME_UP, stageIndex } from "./catalog";
import { clockParts } from "./format";
import { bottleneckOf, crewsOn, frontPosting, peopleOn, ritmoLabel } from "./sim";
import {
  CAMINO,
  CONTOURS,
  FOREST,
  MAP_H,
  MAP_W,
  MURO,
  RIVER,
  STAKE,
  TRACE,
  VIADUCTO,
  type Pt,
  dist,
  mapToGeo,
  surveyCover,
} from "./terrain";
import type { GameState, StructureId, StructureStage } from "./types";
import { STRUCTURE_IDS, V1_CONTRACT_IDS } from "./types";

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

type Frame = { x: number; y: number; w: number; h: number };

function frameOf(w: number, h: number): Frame {
  const m = w < 720 ? 18 : 36;
  return { x: m, y: m * 0.7, w: w - m * 2, h: h - m * 1.6 };
}

function sx(f: Frame, x: number) {
  return f.x + (x / MAP_W) * f.w;
}
function sy(f: Frame, y: number) {
  return f.y + (y / MAP_H) * f.h;
}
function toS(f: Frame, p: Pt): Pt {
  return { x: sx(f, p.x), y: sy(f, p.y) };
}

function strokePoly(ctx: CanvasRenderingContext2D, f: Frame, pts: Pt[], closed = false) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(sx(f, pts[0]!.x), sy(f, pts[0]!.y));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(sx(f, pts[i]!.x), sy(f, pts[i]!.y));
  if (closed) ctx.closePath();
}

function surveyCross(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette) {
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

function frontFlag(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette) {
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

function crewCircles(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, pal: Palette) {
  const marks = Math.min(3, Math.max(0, n));
  ctx.save();
  ctx.strokeStyle = pal.graphite;
  ctx.lineWidth = 1;
  for (let i = 0; i < marks; i++) {
    ctx.beginPath();
    ctx.arc(x + (i - (marks - 1) / 2) * 9, y, 3.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function cropMarks(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette) {
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 0.8;
  const L = 14;
  const m = 8;
  const corners: [number, number][] = [
    [m, m],
    [w - m, m],
    [m, h - m],
    [w - m, h - m],
  ];
  for (const [x, y] of corners) {
    const dx = x < w / 2 ? 1 : -1;
    const dy = y < h / 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x + dx * L, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * L);
    ctx.stroke();
  }
}

function northArrow(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette) {
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

function scaleBar(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette) {
  ctx.save();
  ctx.translate(x, y);
  const unit = 48;
  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(unit * 4, 0);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(i * unit, i % 2 === 0 ? -7 : 0, unit, 7);
    ctx.strokeRect(i * unit, -7, unit, 7);
  }
  ctx.font = "600 12px 'IBM Plex Sans Condensed', sans-serif";
  ctx.fillStyle = pal.ink;
  ctx.textAlign = "center";
  ctx.fillText("0", 0, 20);
  ctx.fillText("100", unit * 2, 20);
  ctx.fillText("200 m", unit * 4, 20);
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  if (s.survey < 0.35) return;
  ctx.save();
  ctx.strokeStyle = pal.rule;
  ctx.lineWidth = 0.5;
  const step = 100;
  for (let x = 0; x <= MAP_W; x += step) {
    ctx.globalAlpha = x % 200 === 0 ? 0.28 : 0.14;
    ctx.beginPath();
    ctx.moveTo(sx(f, x), sy(f, 0));
    ctx.lineTo(sx(f, x), sy(f, MAP_H));
    ctx.stroke();
  }
  for (let y = 0; y <= MAP_H; y += step) {
    ctx.globalAlpha = y % 200 === 0 ? 0.28 : 0.14;
    ctx.beginPath();
    ctx.moveTo(sx(f, 0), sy(f, y));
    ctx.lineTo(sx(f, MAP_W), sy(f, y));
    ctx.stroke();
  }
  ctx.restore();
}

function drawRiver(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  const cover = s.survey;
  ctx.save();
  strokePoly(ctx, f, RIVER);
  ctx.strokeStyle = pal.cyan;
  ctx.globalAlpha = 0.18 + cover * 0.45;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.35 + cover * 0.55;
  ctx.stroke();
  if (cover > 0.35) {
    const puenteDone = stageIndex(s.structures.puente.stage) >= 6;
    ctx.font = "italic 500 12px 'Cormorant Garamond', serif";
    ctx.fillStyle = pal.cyan;
    ctx.globalAlpha = 0.85;
    const p = toS(f, RIVER[4] ?? RIVER[0]!);
    ctx.fillText(RIVER_NAME, p.x + 10, p.y - 8 + (puenteDone ? 16 : 0));
  }
  ctx.restore();
}

function drawContours(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  ctx.save();
  ctx.lineCap = "round";
  for (const c of CONTOURS) {
    const major = c.level % 0.12 < 0.01;
    for (const [a, b] of c.segs) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const cov = surveyCover(mid, s.survey);
      if (cov < 0.05) {
        const h = Math.abs(Math.sin(a.x * 0.017 + a.y * 0.011 + c.level * 8));
        if (h > 0.55) {
          ctx.globalAlpha = 0.28 + h * 0.12;
          ctx.strokeStyle = pal.graphite;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(sx(f, a.x), sy(f, a.y));
          const t = 0.4 + h * 0.25;
          ctx.lineTo(sx(f, a.x + (b.x - a.x) * t), sy(f, a.y + (b.y - a.y) * t));
          ctx.stroke();
        }
        continue;
      }
      ctx.globalAlpha = 0.25 + cov * (major ? 0.55 : 0.35);
      ctx.strokeStyle = pal.graphite;
      ctx.lineWidth = major ? 1.05 : 0.65;
      ctx.beginPath();
      ctx.moveTo(sx(f, a.x), sy(f, a.y));
      ctx.lineTo(sx(f, b.x), sy(f, b.y));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawForest(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  if (s.survey < 0.2) return;
  ctx.save();
  ctx.strokeStyle = pal.graphite;
  ctx.lineWidth = 0.8;
  for (const p of FOREST) {
    const cov = surveyCover(p, s.survey);
    if (cov < 0.4) continue;
    ctx.globalAlpha = 0.25 * cov;
    const x = sx(f, p.x);
    const y = sy(f, p.y);
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

function drawSoil(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  if (s.survey < 0.45) return;
  ctx.save();
  ctx.strokeStyle = pal.faint;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.28;
  for (let y = 300; y < 540; y += 10) {
    for (let x = 480; x < 820; x += 14) {
      if (surveyCover({ x, y }, s.survey) < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(sx(f, x), sy(f, y));
      ctx.lineTo(sx(f, x + 6), sy(f, y + 4));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFlood(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  if (s.survey < 0.55 && s.floodStatus !== "incumplido") return;
  ctx.save();
  strokePoly(ctx, f, RIVER);
  ctx.strokeStyle = pal.cyan;
  const hot = s.floodStatus === "incumplido" || (s.floodStatus === "pendiente" && clockParts(s.siteMinutes).day >= 10);
  ctx.globalAlpha = hot ? 0.22 : 0.12;
  ctx.lineWidth = hot ? 36 : 28;
  ctx.lineCap = "round";
  ctx.stroke();
  if (s.floodStatus === "incumplido") {
    strokePoly(ctx, f, RIVER);
    ctx.strokeStyle = pal.rust;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 52;
    ctx.stroke();
    strokePoly(ctx, f, RIVER);
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
  const p = toS(f, { x: 520, y: 500 });
  ctx.fillText("ZONA DE INUNDACIÓN · COTA +31,2", p.x, p.y);
  ctx.letterSpacing = "0";
  ctx.restore();

  if (s.floodStatus === "incumplido") {
    ctx.save();
    ctx.translate(sx(f, 500), sy(f, 350));
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

function roadStyle(stage: StructureStage): { w: number; dash: number[]; alpha: number } {
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

function drawCamino(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  const st = s.structures.camino;
  const proposed = s.survey < 1 && !st.opened;
  ctx.save();
  strokePoly(ctx, f, CAMINO);
  if (proposed || st.stage === "vacio") {
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    return;
  }
  const rs = roadStyle(st.stage);
  ctx.setLineDash(rs.dash);
  ctx.strokeStyle = st.stage === "conexion" || st.stage === "estructura" ? pal.ink : pal.graphite;
  ctx.globalAlpha = rs.alpha;
  ctx.lineWidth = rs.w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  if (st.stage === "conexion") {
    ctx.strokeStyle = pal.cyan;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBridge(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  const st = s.structures.puente;
  const p = toS(f, STRUCTURE_DEF.puente);
  const cov = surveyCover(STRUCTURE_DEF.puente, s.survey);
  if (cov < 0.4 && !st.opened) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-0.45);
  ctx.strokeStyle = pal.ink;
  ctx.globalAlpha = 0.4 + cov * 0.6;
  ctx.lineWidth = 1;
  const k = stageIndex(st.stage);
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

function drawWall(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  const st = s.structures.muro;
  if (surveyCover(STRUCTURE_DEF.muro, s.survey) < 0.35 && !st.opened) return;
  ctx.save();
  strokePoly(ctx, f, MURO);
  const k = stageIndex(st.stage);
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

function laterWorks(s: GameState): boolean {
  return s.instruction === "dirige";
}

function drawPad(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  id: "cimentacion" | "planta",
  s: GameState,
  pal: Palette,
) {
  const st = s.structures[id];
  if (!laterWorks(s) && !st.opened) return;
  const def = STRUCTURE_DEF[id];
  if (surveyCover(def, s.survey) < 0.35 && !st.opened) return;
  const p = toS(f, def);
  const k = stageIndex(st.stage);
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

function drawViaduct(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  const st = s.structures.viaducto;
  if (!laterWorks(s) && !st.opened) return;
  if (surveyCover(STRUCTURE_DEF.viaducto, s.survey) < 0.4 && !st.opened) return;
  const k = stageIndex(st.stage);
  ctx.save();
  strokePoly(ctx, f, VIADUCTO);
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

function drawStake(ctx: CanvasRenderingContext2D, f: Frame, pal: Palette, active: boolean) {
  const p = toS(f, STAKE);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -18);
  ctx.stroke();
  ctx.restore();
  surveyCross(ctx, p.x, p.y - 18, pal);
  if (active) {
    ctx.save();
    ctx.strokeStyle = pal.rust;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCrewMarks(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  for (const id of STRUCTURE_IDS) {
    const st = s.structures[id];
    if (!st.opened) continue;
    const people = peopleOn(s, id);
    const heads = people.obreros + people.capataces + people.ingenieros + people.topografos;
    const def = STRUCTURE_DEF[id];
    const p = toS(f, def);
    frontFlag(ctx, p.x + 18, p.y - 4, pal);
    const circles = Math.min(3, heads === 0 ? 0 : Math.max(1, Math.ceil(heads / 5)));
    crewCircles(ctx, p.x, p.y + 14, circles, pal);
  }
  if (s.surveying && s.survey < 1) {
    const p = toS(f, STAKE);
    crewCircles(ctx, p.x + 16, p.y + 8, 2, pal);
  }
}

type Box = { l: number; t: number; r: number; b: number };

function overlaps(a: Box, b: Box) {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

function labels(ctx: CanvasRenderingContext2D, f: Frame, s: GameState, pal: Palette) {
  ctx.save();
  ctx.font = "500 10px 'IBM Plex Sans Condensed', sans-serif";
  ctx.fillStyle = pal.graphite;
  ctx.globalAlpha = 0.85;
  ctx.textAlign = "left";
  ctx.letterSpacing = "0.06em";
  ctx.fillText(`${SITE_GEO.valle.toUpperCase()}  ·  ${SITE_GEO.municipio.toUpperCase()}`, f.x + 4, f.y + 14);
  ctx.letterSpacing = "0.03em";
  ctx.fillText(`${SITE_GEO.lat}   ${SITE_GEO.lon}`, f.x + 4, f.y + 28);
  ctx.fillText(`UTM ${SITE_GEO.utmZone}  ${SITE_GEO.easting}  ${SITE_GEO.northing}`, f.x + 4, f.y + 42);
  ctx.fillText(`${SITE_GEO.datum}  ·  cota est. ${SITE_GEO.cota}  ·  ${SITE_GEO.scale}`, f.x + 4, f.y + 56);
  ctx.fillText(`declinación ${SITE_GEO.declinacion}`, f.x + 4, f.y + 70);
  const clock = clockParts(s.siteMinutes);
  ctx.textAlign = "right";
  ctx.fillText("HOJA 1 DE 1", f.x + f.w - 4, f.y + f.h - 8);
  ctx.fillText(`${SITE_GEO.valle.toUpperCase()}  ·  ${clock.label}`, f.x + f.w - 4, f.y + f.h + 8);
  ctx.letterSpacing = "0";
  ctx.restore();

  if (s.survey < 0.2) {
    ctx.save();
    ctx.font = "500 13px 'IBM Plex Sans Condensed', sans-serif";
    ctx.fillStyle = pal.faint;
    ctx.textAlign = "center";
    ctx.letterSpacing = "0.28em";
    ctx.fillText("TERRENO SIN LEVANTAR", f.x + f.w / 2, f.y + f.h * 0.44);
    ctx.letterSpacing = "0";
    ctx.restore();
  }

  const occupied: Box[] = [];
  const claim = (box: Box, force: boolean) => {
    if (!force && occupied.some((o) => overlaps(box, o))) return false;
    occupied.push(box);
    return true;
  };

  const ids = [...STRUCTURE_IDS].sort((a, b) => {
    if (s.selected === a) return -1;
    if (s.selected === b) return 1;
    const ao = s.structures[a].opened ? 0 : 1;
    const bo = s.structures[b].opened ? 0 : 1;
    return ao - bo;
  });

  for (const id of ids) {
    const st = s.structures[id];
    const def = STRUCTURE_DEF[id];
    const v1 = (V1_CONTRACT_IDS as readonly string[]).includes(id);
    if (!v1 && !st.opened && s.instruction !== "dirige") continue;
    if (s.survey < 1 && surveyCover(def, s.survey) < 0.5 && !st.opened) continue;
    const p = toS(f, def);
    const active = s.selected === id;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = active ? "600 11px 'IBM Plex Sans Condensed', sans-serif" : "600 10px 'IBM Plex Sans Condensed', sans-serif";
    ctx.letterSpacing = "0.1em";
    const name = STRUCTURE_NAME_UP[id];
    const nw = Math.max(48, ctx.measureText(name).width + 8);
    const box: Box = { l: p.x - nw / 2, t: p.y - 36, r: p.x + nw / 2, b: p.y - 4 };
    if (!claim(box, active || st.opened)) {
      ctx.restore();
      continue;
    }
    ctx.fillStyle = st.opened ? pal.ink : pal.graphite;
    ctx.fillText(name, p.x, p.y - 24);
    ctx.font = "500 9px 'IBM Plex Sans Condensed', sans-serif";
    ctx.letterSpacing = "0.08em";
    if (st.opened) {
      ctx.fillStyle = pal.cyan;
      ctx.fillText(MAP_STAGE[st.stage], p.x, p.y - 12);
      const bottle = bottleneckOf(s, id);
      if (bottle) {
        ctx.fillStyle = pal.rust;
        ctx.fillText(bottle, p.x, p.y + 24);
      }
    } else if (s.survey >= 1) {
      ctx.fillStyle = pal.faint;
      ctx.fillText(MAP_STAGE.vacio, p.x, p.y - 12);
    }
    ctx.letterSpacing = "0";
    ctx.restore();
  }

  if (s.survey > 0.5) {
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
      const p = toS(f, pl);
      const w = ctx.measureText(pl.name).width + 8;
      const box: Box = { l: p.x, t: p.y - 12, r: p.x + w, b: p.y + 16 };
      if (!claim(box, false)) continue;
      ctx.fillText(pl.name, p.x, p.y);
      if (s.survey > 0.72 && pl.elev) {
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

function instruction(_ctx: CanvasRenderingContext2D, _f: Frame, _s: GameState, _pal: Palette) {
  /* DOM stamps own the first gesture. */
}

function visitaMark(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette) {
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

function trace(ctx: CanvasRenderingContext2D, f: Frame, pal: Palette) {
  ctx.save();
  strokePoly(ctx, f, TRACE);
  ctx.setLineDash([2, 7]);
  ctx.strokeStyle = pal.faint;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

export function drawSheet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: GameState,
  pal: Palette,
  hover: Pt | null,
  opts?: { visita?: boolean },
) {
  ctx.clearRect(0, 0, w, h);
  cropMarks(ctx, w, h, pal);
  const f = frameOf(w, h);
  ctx.strokeStyle = pal.rule;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 0.85;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  ctx.globalAlpha = 1;

  drawGrid(ctx, f, s, pal);
  drawContours(ctx, f, s, pal);
  drawFlood(ctx, f, s, pal);
  drawRiver(ctx, f, s, pal);
  drawSoil(ctx, f, s, pal);
  drawForest(ctx, f, s, pal);
  trace(ctx, f, pal);
  drawCamino(ctx, f, s, pal);
  drawWall(ctx, f, s, pal);
  drawPad(ctx, f, "cimentacion", s, pal);
  drawPad(ctx, f, "planta", s, pal);
  drawViaduct(ctx, f, s, pal);
  drawBridge(ctx, f, s, pal);
  drawStake(ctx, f, pal, s.survey < 1);
  drawCrewMarks(ctx, f, s, pal);
  labels(ctx, f, s, pal);
  instruction(ctx, f, s, pal);
  if (opts?.visita) visitaMark(ctx, w, h, pal);
  northArrow(ctx, f.x + f.w - 32, f.y + 40, pal);
  scaleBar(ctx, f.x + 12, f.y + f.h - 44, pal);

  if (hover) {
    const map = { x: ((hover.x - f.x) / f.w) * MAP_W, y: ((hover.y - f.y) / f.h) * MAP_H };
    const geo = mapToGeo(map.x, map.y);
    ctx.font = "500 12px 'IBM Plex Sans Condensed', sans-serif";
    ctx.fillStyle = pal.ink;
    ctx.textAlign = "left";
    ctx.fillText(`${geo.latLabel}  ·  ${geo.lonLabel}`, hover.x + 10, hover.y - 20);
    ctx.fillStyle = pal.graphite;
    ctx.fillText(geo.utm, hover.x + 10, hover.y - 6);
  }

  if (s.selected) {
    const def = STRUCTURE_DEF[s.selected];
    const p = toS(f, def);
    ctx.strokeStyle = pal.rust;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export type Hit = { type: "stake" | "structure" | "instruction"; id?: StructureId };

export function hitTest(x: number, y: number, w: number, h: number, s: GameState): Hit | null {
  const f = frameOf(w, h);
  const instY = f.y + f.h - 18;
  if (s.instruction === "levanta" && s.survey < 1 && Math.abs(y - instY) < 28 && Math.abs(x - (f.x + f.w / 2)) < 240) {
    return { type: "instruction" };
  }
  const stake = toS(f, STAKE);
  if (dist({ x, y }, stake) < 44) return { type: "stake" };
  let best: { id: StructureId; d: number } | null = null;
  for (const id of STRUCTURE_IDS) {
    const def = STRUCTURE_DEF[id];
    const opened = s.structures[id].opened;
    const v1 = (V1_CONTRACT_IDS as readonly string[]).includes(id);
    if (!v1 && !opened && s.instruction !== "dirige") continue;
    if (surveyCover(def, s.survey) < 0.35 && !opened) continue;
    const p = toS(f, def);
    const d = dist({ x, y }, p);
    if (d < 44 && (!best || d < best.d)) best = { id, d };
  }
  if (best) return { type: "structure", id: best.id };
  return null;
}

export function commandLines(s: GameState, id: StructureId) {
  const st = s.structures[id];
  const people = peopleOn(s, id);
  const crews = crewsOn(s, id);
  return {
    name: STRUCTURE_NAME_UP[id],
    stage: STAGE_LABEL[st.stage],
    next: NEXT_HITO[st.stage],
    crew: crews[0] ? `${crews[0].name} · ${frontPosting(id)}` : "SIN CUADRILLA",
    people: `${people.obreros} OBR.  ·  ${people.capataces} CAP.  ·  ${people.ingenieros} ING.  ·  ${people.topografos} TOP.`,
    prod: ritmoLabel(s, id),
    bottle: bottleneckOf(s, id),
    opened: st.opened,
  };
}
