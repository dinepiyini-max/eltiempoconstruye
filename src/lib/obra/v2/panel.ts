/**
 * Panel Cantidad de NUEVA OBRA. Totales de escena o del elemento SEL.
 * Hormigón/acero de escena = takeoffScene (la misma cifra que PRESUPUESTO).
 * Al cambiar de pieza, el caller pinta solo los campos de `kind` — cero restos.
 */
import type { Columna, Hueco, Losa, Muro, Viga, Zapata } from "./geometry.ts";
import { losaLados, muroHiladas } from "./geometry.ts";
import {
  descuentoVano,
  medicionMuro,
  takeoffColumna,
  takeoffLosa,
  takeoffMuro,
  takeoffScene,
  takeoffViga,
  takeoffZapata,
  type MedicionEstado,
} from "./quantity.ts";
import { V2_COLUMNA, V2_ZAPATA } from "./tables.ts";

export type PanelKind = "obra" | "muro" | "losa" | "columna" | "zapata" | "viga" | "hueco";

export type PanelScene = {
  walls: readonly Muro[];
  openings?: readonly Hueco[];
  columns?: readonly Columna[];
  footings?: readonly Zapata[];
  beams?: readonly Viga[];
  slabs?: readonly Losa[];
};

export type PanelCantidad = {
  kind: PanelKind;
  title: string;
  /** null → «—». */
  largo: number | null;
  alto: number | null;
  hiladas: number | null;
  areaNeta: number | null;
  blocks: number | null;
  blocksDelta: number;
  vanos: number | null;
  hormigonM3: number | null;
  aceroT: number | null;
  losaM2: number | null;
  espesor: number | null;
  seccion: string | null;
  huecoAncho: number | null;
  huecoAlto: number | null;
  parentWallId: string | null;
  losaLargo: number | null;
  losaAncho: number | null;
  canto: number | null;
  estado: MedicionEstado;
  notas: string[];
  /** Cantidad principal de la medición. null si no hay una sola cifra honesta. */
  cantidad: number | null;
  unidad: string | null;
  /** Área medida, m². null si falta una dimensión. */
  area: number | null;
  /** Volumen medido, m³. null si falta una dimensión. */
  volumen: number | null;
};

const EMPTY: PanelCantidad = {
  kind: "obra",
  title: "MURO",
  largo: 0,
  alto: null,
  hiladas: null,
  areaNeta: 0,
  blocks: 0,
  blocksDelta: 0,
  vanos: null,
  hormigonM3: 0,
  aceroT: 0,
  losaM2: 0,
  espesor: null,
  seccion: null,
  huecoAncho: null,
  huecoAlto: null,
  parentWallId: null,
  losaLargo: null,
  losaAncho: null,
  canto: null,
  estado: "vacia",
  notas: [],
  cantidad: null,
  unidad: null,
  area: null,
  volumen: null,
};

function fmtSeccion(a: number, b: number): string {
  return `${a.toFixed(2)} × ${b.toFixed(2)} m`;
}

function altoComun(walls: readonly Muro[]): number | null {
  if (!walls.length) return null;
  const h = walls[0]!.alto;
  if (!Number.isFinite(h) || h <= 0) return null;
  for (const w of walls) {
    if (!Number.isFinite(w.alto) || Math.abs(w.alto - h) > 1e-6) return null;
  }
  return h;
}

function panelObra(scene: PanelScene): PanelCantidad {
  const openings = scene.openings ?? [];
  const columns = scene.columns ?? [];
  const footings = scene.footings ?? [];
  const beams = scene.beams ?? [];
  const slabs = scene.slabs ?? [];
  const walls = scene.walls;
  const qty = takeoffScene(scene);
  const has = walls.length + openings.length + columns.length + footings.length + beams.length + slabs.length > 0;
  if (!has) {
    return {
      ...EMPTY,
      kind: "obra",
      title: "MURO",
      largo: 0,
      areaNeta: 0,
      blocks: 0,
      hormigonM3: 0,
      aceroT: 0,
      losaM2: 0,
      estado: "vacia",
    };
  }

  const notas: string[] = [];
  let incompleta = false;
  let recortada = false;
  for (const w of walls) {
    const med = medicionMuro(w, openings);
    if (med.estado === "incompleta") incompleta = true;
    if (med.estado === "recortada") recortada = true;
    for (const n of med.notas) {
      if (notas.length < 4) notas.push(n);
    }
  }
  const padres = new Set(walls.map((w) => w.id));
  const huerfanos = openings.filter((h) => !padres.has(h.wallId));
  if (huerfanos.length) {
    incompleta = true;
    const linea =
      huerfanos.length === 1
        ? `${huerfanos[0]!.id}: sin muro padre. No se descuenta.`
        : `${huerfanos.length} vanos sin muro padre. No se descuentan.`;
    if (notas.length < 4) notas.push(linea);
  }
  const supuesto = columns.length > 0 || footings.length > 0;
  if (supuesto && notas.length < 4) {
    notas.push("Columna y zapata usan alto o canto del catálogo de juego.");
  }
  const alto = altoComun(walls);
  if (walls.length > 1 && alto == null && notas.length < 4) {
    notas.push("Altos de muro distintos. No hay un solo alto de obra.");
  }
  let estado: MedicionEstado = "completa";
  if (incompleta) estado = "incompleta";
  else if (recortada) estado = "recortada";
  else if (supuesto) estado = "supuesto";

  return {
    kind: "obra",
    title: "OBRA",
    largo: qty.largoM,
    alto,
    hiladas: alto == null ? null : muroHiladas(alto),
    areaNeta: qty.areaNetaM2,
    blocks: qty.blocksEst,
    blocksDelta: qty.blocksDelta,
    vanos: openings.length,
    hormigonM3: qty.hormigonM3,
    aceroT: qty.aceroT,
    losaM2: qty.losaM2,
    espesor: null,
    seccion: null,
    huecoAncho: null,
    huecoAlto: null,
    parentWallId: null,
    losaLargo: null,
    losaAncho: null,
    canto: null,
    estado,
    notas,
    cantidad: null,
    unidad: null,
    area: qty.areaNetaM2,
    volumen: null,
  };
}

export function panelCantidad(scene: PanelScene, selectedId: string | null): PanelCantidad {
  const openings = scene.openings ?? [];
  const columns = scene.columns ?? [];
  const footings = scene.footings ?? [];
  const beams = scene.beams ?? [];
  const slabs = scene.slabs ?? [];
  const walls = scene.walls;
  const obra = panelObra(scene);

  if (!selectedId) return obra;

  const hueco = openings.find((h) => h.id === selectedId);
  if (hueco) {
    const padre = walls.find((w) => w.id === hueco.wallId);
    const anchoOk = Number.isFinite(hueco.ancho) && hueco.ancho > 0;
    const altoOk = Number.isFinite(hueco.alto) && hueco.alto > 0;
    let blocksDelta = 0;
    let estado: MedicionEstado = "incompleta";
    let notas = ["Sin muro padre. No se descuenta."];
    let area: number | null = null;
    let volumen: number | null = null;
    if (!padre) {
      estado = "incompleta";
    } else {
      const d = descuentoVano(padre, openings, hueco.id);
      const withAll = takeoffMuro(padre, undefined, openings);
      const without = takeoffMuro(
        padre,
        undefined,
        openings.filter((h) => h.id !== hueco.id),
      );
      blocksDelta = withAll.blocksEst - without.blocksEst;
      estado = d.estado;
      notas = d.notas;
      area = d.areaM2;
      volumen = d.volumenM3;
    }
    return {
      kind: "hueco",
      title: hueco.id,
      largo: null,
      alto: null,
      hiladas: null,
      areaNeta: null,
      blocks: null,
      blocksDelta,
      vanos: null,
      hormigonM3: null,
      aceroT: null,
      losaM2: null,
      espesor: null,
      seccion: null,
      huecoAncho: anchoOk ? hueco.ancho : null,
      huecoAlto: altoOk ? hueco.alto : null,
      parentWallId: padre?.id ?? hueco.wallId,
      losaLargo: null,
      losaAncho: null,
      canto: null,
      estado,
      notas,
      cantidad: area,
      unidad: area == null ? null : "m²",
      area,
      volumen,
    };
  }

  const muro = walls.find((w) => w.id === selectedId);
  if (muro) {
    const med = medicionMuro(muro, openings);
    const q = takeoffMuro(muro, undefined, openings);
    const gross = takeoffMuro(muro, undefined, []);
    const vanos = openings.filter((h) => h.wallId === muro.id).length;
    const medible = med.areaNetaM2 != null;
    return {
      kind: "muro",
      title: muro.id,
      largo: q.largoM > 0 ? q.largoM : null,
      alto: med.altoM,
      hiladas: med.altoM == null ? null : muroHiladas(med.altoM),
      areaNeta: med.areaNetaM2,
      blocks: medible ? q.blocksEst : null,
      blocksDelta: medible ? q.blocksEst - gross.blocksEst : 0,
      vanos,
      hormigonM3: med.volumenM3,
      aceroT: med.volumenM3 == null ? null : q.aceroT,
      losaM2: null,
      espesor: med.espesorM,
      seccion: null,
      huecoAncho: null,
      huecoAlto: null,
      parentWallId: null,
      losaLargo: null,
      losaAncho: null,
      canto: null,
      estado: med.estado,
      notas: med.notas,
      cantidad: med.areaNetaM2,
      unidad: med.areaNetaM2 == null ? null : "m²",
      area: med.areaNetaM2,
      volumen: med.volumenM3,
    };
  }

  const col = columns.find((c) => c.id === selectedId);
  if (col) {
    const ladoOk = Number.isFinite(col.lado) && col.lado > 0;
    const q = takeoffColumna(col);
    return {
      kind: "columna",
      title: col.id,
      largo: ladoOk ? col.lado : null,
      alto: ladoOk ? V2_COLUMNA.altoM : null,
      hiladas: null,
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      vanos: null,
      hormigonM3: ladoOk ? q.hormigonM3 : null,
      aceroT: ladoOk ? q.aceroT : null,
      losaM2: null,
      espesor: null,
      seccion: ladoOk ? fmtSeccion(col.lado, col.lado) : null,
      huecoAncho: null,
      huecoAlto: null,
      parentWallId: null,
      losaLargo: null,
      losaAncho: null,
      canto: null,
      estado: ladoOk ? "supuesto" : "incompleta",
      notas: ladoOk
        ? [`Alto ${V2_COLUMNA.altoM.toFixed(2)} m del catálogo de juego. La columna no guarda alto.`]
        : ["Falta el lado de la columna. No hay volumen."],
      cantidad: ladoOk ? q.hormigonM3 : null,
      unidad: ladoOk ? "m³" : null,
      area: ladoOk ? col.lado * col.lado : null,
      volumen: ladoOk ? q.hormigonM3 : null,
    };
  }

  const zap = footings.find((z) => z.id === selectedId);
  if (zap) {
    const ladoOk = Number.isFinite(zap.lado) && zap.lado > 0;
    const q = takeoffZapata(zap);
    return {
      kind: "zapata",
      title: zap.id,
      largo: ladoOk ? zap.lado : null,
      alto: null,
      hiladas: null,
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      vanos: null,
      hormigonM3: ladoOk ? q.hormigonM3 : null,
      aceroT: ladoOk ? q.aceroT : null,
      losaM2: null,
      espesor: ladoOk ? V2_ZAPATA.cantoM : null,
      seccion: ladoOk ? fmtSeccion(zap.lado, zap.lado) : null,
      huecoAncho: null,
      huecoAlto: null,
      parentWallId: null,
      losaLargo: null,
      losaAncho: null,
      canto: null,
      estado: ladoOk ? "supuesto" : "incompleta",
      notas: ladoOk
        ? [`Canto ${V2_ZAPATA.cantoM.toFixed(2)} m del catálogo de juego. La zapata no guarda canto.`]
        : ["Falta el lado de la zapata. No hay volumen."],
      cantidad: ladoOk ? q.hormigonM3 : null,
      unidad: ladoOk ? "m³" : null,
      area: ladoOk ? zap.lado * zap.lado : null,
      volumen: ladoOk ? q.hormigonM3 : null,
    };
  }

  const viga = beams.find((v) => v.id === selectedId);
  if (viga) {
    const q = takeoffViga(viga);
    const canto = positivo(viga.canto);
    const anchoOk = positivo(viga.ancho);
    const largoOk = q.largoM > 1e-9;
    const completa = largoOk && anchoOk != null && canto != null;
    return {
      kind: "viga",
      title: viga.id,
      largo: largoOk ? q.largoM : null,
      alto: null,
      hiladas: null,
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      vanos: null,
      hormigonM3: completa ? q.hormigonM3 : null,
      aceroT: completa ? q.aceroT : null,
      losaM2: null,
      espesor: null,
      seccion: completa && canto != null && anchoOk != null ? fmtSeccion(anchoOk, canto) : null,
      huecoAncho: null,
      huecoAlto: null,
      parentWallId: null,
      losaLargo: null,
      losaAncho: null,
      canto: completa ? canto : null,
      estado: completa ? "completa" : "incompleta",
      notas: completa ? [] : ["Falta largo o sección de la viga. No hay volumen."],
      cantidad: completa ? q.hormigonM3 : null,
      unidad: completa ? "m³" : null,
      area: null,
      volumen: completa ? q.hormigonM3 : null,
    };
  }

  const losa = slabs.find((l) => l.id === selectedId);
  if (losa) {
    const q = takeoffLosa(losa);
    const lados = losaLados(losa);
    const espesor = positivo(losa.espesor);
    const areaOk = q.areaM2 > 1e-9;
    const completa = areaOk && espesor != null;
    const notas: string[] = [];
    if (!areaOk) notas.push("Área de losa no medible.");
    if (espesor == null) notas.push("Falta el espesor de la losa. No hay volumen.");
    return {
      kind: "losa",
      title: losa.id,
      largo: null,
      alto: null,
      hiladas: null,
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      vanos: null,
      hormigonM3: completa ? q.hormigonM3 : null,
      aceroT: completa ? q.aceroT : null,
      losaM2: areaOk ? q.areaM2 : null,
      espesor,
      seccion: null,
      huecoAncho: null,
      huecoAlto: null,
      parentWallId: null,
      losaLargo: lados.largo > 0 ? lados.largo : null,
      losaAncho: lados.ancho > 0 ? lados.ancho : null,
      canto: null,
      estado: completa ? "completa" : "incompleta",
      notas,
      cantidad: areaOk ? q.areaM2 : null,
      unidad: areaOk ? "m²" : null,
      area: areaOk ? q.areaM2 : null,
      volumen: completa ? q.hormigonM3 : null,
    };
  }

  return obra;
}

function positivo(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}
