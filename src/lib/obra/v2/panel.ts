/**
 * Panel Cantidad de NUEVA OBRA. Totales de escena o del elemento SEL.
 * Hormigón/acero de escena = takeoffScene (la misma cifra que PRESUPUESTO).
 * Al cambiar de pieza, el caller pinta solo los campos de `kind` — cero restos.
 */
import type { Columna, Hueco, Losa, Muro, Viga, Zapata } from "./geometry.ts";
import { muroHiladas } from "./geometry.ts";
import {
  takeoffColumna,
  takeoffLosa,
  takeoffMuro,
  takeoffScene,
  takeoffViga,
  takeoffZapata,
} from "./quantity.ts";
import { V2_COLUMNA, V2_LOSA_PLANTA, V2_MURO, V2_VIGA, V2_ZAPATA } from "./tables.ts";

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
  parentWallId: string | null;
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
  parentWallId: null,
};

function fmtSeccion(a: number, b: number): string {
  return `${a.toFixed(2)} × ${b.toFixed(2)} m`;
}

export function panelCantidad(scene: PanelScene, selectedId: string | null): PanelCantidad {
  const openings = scene.openings ?? [];
  const columns = scene.columns ?? [];
  const footings = scene.footings ?? [];
  const beams = scene.beams ?? [];
  const slabs = scene.slabs ?? [];
  const walls = scene.walls;
  const qty = takeoffScene(scene);
  const has =
    walls.length + openings.length + columns.length + footings.length + beams.length + slabs.length > 0;

  if (!selectedId) {
    return {
      kind: "obra",
      title: has ? "OBRA" : "MURO",
      largo: qty.largoM,
      alto: walls.length ? V2_MURO.altoM : null,
      hiladas: walls.length ? muroHiladas(V2_MURO.altoM) : null,
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
      parentWallId: null,
    };
  }

  const hueco = openings.find((h) => h.id === selectedId);
  if (hueco) {
    const padre = walls.find((w) => w.id === hueco.wallId);
    let blocksDelta = 0;
    if (padre) {
      const withAll = takeoffMuro(padre, undefined, openings);
      const without = takeoffMuro(
        padre,
        undefined,
        openings.filter((h) => h.id !== hueco.id),
      );
      blocksDelta = withAll.blocksEst - without.blocksEst;
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
      huecoAncho: hueco.ancho,
      parentWallId: padre?.id ?? hueco.wallId,
    };
  }

  const muro = walls.find((w) => w.id === selectedId);
  if (muro) {
    const q = takeoffMuro(muro, undefined, openings);
    const gross = takeoffMuro(muro, undefined, []);
    const vanos = openings.filter((h) => h.wallId === muro.id).length;
    return {
      kind: "muro",
      title: muro.id,
      largo: q.largoM,
      alto: q.altoM,
      hiladas: muroHiladas(q.altoM),
      areaNeta: q.areaNetaM2,
      blocks: q.blocksEst,
      blocksDelta: q.blocksEst - gross.blocksEst,
      vanos,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: null,
      espesor: muro.espesor,
      seccion: null,
      huecoAncho: null,
      parentWallId: null,
    };
  }

  const col = columns.find((c) => c.id === selectedId);
  if (col) {
    const q = takeoffColumna(col);
    return {
      kind: "columna",
      title: col.id,
      largo: null,
      alto: V2_COLUMNA.altoM,
      hiladas: null,
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      vanos: null,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: null,
      espesor: null,
      seccion: fmtSeccion(col.lado, col.lado),
      huecoAncho: null,
      parentWallId: null,
    };
  }

  const zap = footings.find((z) => z.id === selectedId);
  if (zap) {
    const q = takeoffZapata(zap);
    return {
      kind: "zapata",
      title: zap.id,
      largo: null,
      alto: null,
      hiladas: null,
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      vanos: null,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: null,
      espesor: V2_ZAPATA.cantoM,
      seccion: fmtSeccion(zap.lado, zap.lado),
      huecoAncho: null,
      parentWallId: null,
    };
  }

  const viga = beams.find((v) => v.id === selectedId);
  if (viga) {
    const q = takeoffViga(viga);
    return {
      kind: "viga",
      title: viga.id,
      largo: q.largoM,
      alto: null,
      hiladas: null,
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      vanos: null,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: null,
      espesor: null,
      seccion: fmtSeccion(viga.ancho, V2_VIGA.cantoM),
      huecoAncho: null,
      parentWallId: null,
    };
  }

  const losa = slabs.find((l) => l.id === selectedId);
  if (losa) {
    const q = takeoffLosa(losa);
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
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: q.areaM2,
      espesor: V2_LOSA_PLANTA.espesorM,
      seccion: null,
      huecoAncho: null,
      parentWallId: null,
    };
  }

  return {
    ...EMPTY,
    title: has ? "OBRA" : "MURO",
    hormigonM3: qty.hormigonM3,
    aceroT: qty.aceroT,
    largo: qty.largoM,
    areaNeta: qty.areaNetaM2,
    blocks: qty.blocksEst,
    blocksDelta: qty.blocksDelta,
    losaM2: qty.losaM2,
  };
}
