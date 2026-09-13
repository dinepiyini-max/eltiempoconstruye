/**
 * Panel Cantidad de NUEVA OBRA. Totales de escena o del elemento SEL.
 * Hormigón/acero de escena = takeoffScene (la misma cifra que PRESUPUESTO).
 */
import type { Columna, Hueco, Losa, Muro, Viga, Zapata } from "./geometry.ts";
import {
  takeoffColumna,
  takeoffLosa,
  takeoffMuro,
  takeoffScene,
  takeoffViga,
  takeoffZapata,
} from "./quantity.ts";

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
  areaNeta: number | null;
  blocks: number | null;
  blocksDelta: number;
  hormigonM3: number | null;
  aceroT: number | null;
  losaM2: number | null;
  huecoAncho: number | null;
  parentWallId: string | null;
};

const EMPTY: PanelCantidad = {
  kind: "obra",
  title: "MURO",
  largo: 0,
  areaNeta: 0,
  blocks: 0,
  blocksDelta: 0,
  hormigonM3: 0,
  aceroT: 0,
  losaM2: 0,
  huecoAncho: null,
  parentWallId: null,
};

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
      areaNeta: qty.areaNetaM2,
      blocks: qty.blocksEst,
      blocksDelta: qty.blocksDelta,
      hormigonM3: qty.hormigonM3,
      aceroT: qty.aceroT,
      losaM2: qty.losaM2,
      huecoAncho: null,
      parentWallId: null,
    };
  }

  const hueco = openings.find((h) => h.id === selectedId);
  if (hueco) {
    const padre = walls.find((w) => w.id === hueco.wallId);
    return {
      kind: "hueco",
      title: hueco.id,
      largo: null,
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      hormigonM3: null,
      aceroT: null,
      losaM2: null,
      huecoAncho: hueco.ancho,
      parentWallId: padre?.id ?? hueco.wallId,
    };
  }

  const muro = walls.find((w) => w.id === selectedId);
  if (muro) {
    const q = takeoffMuro(muro, undefined, openings);
    const gross = takeoffMuro(muro, undefined, []);
    return {
      kind: "muro",
      title: muro.id,
      largo: q.largoM,
      areaNeta: q.areaNetaM2,
      blocks: q.blocksEst,
      blocksDelta: q.blocksEst - gross.blocksEst,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: null,
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
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: null,
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
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: null,
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
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: null,
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
      areaNeta: null,
      blocks: null,
      blocksDelta: 0,
      hormigonM3: q.hormigonM3,
      aceroT: q.aceroT,
      losaM2: q.areaM2,
      huecoAncho: null,
      parentWallId: null,
    };
  }

  return { ...EMPTY, title: has ? "OBRA" : "MURO", hormigonM3: qty.hormigonM3, aceroT: qty.aceroT, largo: qty.largoM, areaNeta: qty.areaNetaM2, blocks: qty.blocksEst, blocksDelta: qty.blocksDelta, losaM2: qty.losaM2 };
}
