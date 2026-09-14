/**
 * Quantity V2 — takeoff. Tablas propias. No lee STRUCTURE_DEF.
 */
import type { Columna, Hueco, Losa, Measured, Muro, Viga, Zapata } from "./geometry.ts";
import { huecoAltoDe, losaArea, muroLargo, vigaLargo } from "./geometry.ts";
import {
  V2_COLUMNA,
  V2_LOSA_PLANTA,
  V2_MURO,
  V2_SECTIONS,
  V2_VIGA,
  V2_ZAPATA,
  type V2Kind,
} from "./tables.ts";

export type Takeoff = {
  kind: V2Kind;
  largoM: number;
  excavacionM3: number;
  hormigonM3: number;
  aceroT: number;
};

export function takeoff(m: Measured, kind: V2Kind): Takeoff {
  const sec = V2_SECTIONS[kind];
  const excavacionM3 = Math.max(0, (m.cutM2 + m.fillM2) * sec.cutWidthM);
  const hormigonM3 = Math.max(0, m.largoM * sec.hormigonM2);
  const aceroT = Math.max(0, hormigonM3 * sec.steelTPerM3);
  return { kind, largoM: m.largoM, excavacionM3, hormigonM3, aceroT };
}

export type TakeoffMuro = {
  largoM: number;
  espesorM: number;
  altoM: number;
  areaM2: number;
  areaNetaM2: number;
  vanoM2: number;
  volumenM3: number;
  blocksEst: number;
  hormigonM3: number;
  aceroT: number;
};

function vanoArea(m: Muro, huecos: readonly Hueco[], altoM: number): number {
  let a = 0;
  for (const h of huecos) {
    if (h.wallId !== m.id) continue;
    a += h.ancho * Math.min(huecoAltoDe(h), altoM);
  }
  return a;
}

export function takeoffMuro(m: Muro, altoM?: number, huecos: readonly Hueco[] = []): TakeoffMuro {
  const largoM = muroLargo(m);
  const espesorM = m.espesor;
  const alto = altoM ?? m.alto ?? V2_MURO.altoM;
  const areaM2 = Math.max(0, largoM * alto);
  const vanoM2 = Math.min(areaM2, Math.max(0, vanoArea(m, huecos, alto)));
  const areaNetaM2 = Math.max(0, areaM2 - vanoM2);
  const volumenM3 = Math.max(0, areaNetaM2 * espesorM);
  const blocksEst = Math.ceil(areaNetaM2 / V2_MURO.blockFaceM2 - 1e-9);
  const hormigonM3 = volumenM3;
  const aceroT = hormigonM3 * V2_SECTIONS.contencion.steelTPerM3;
  return { largoM, espesorM, altoM: alto, areaM2, areaNetaM2, vanoM2, volumenM3, blocksEst, hormigonM3, aceroT };
}

export function takeoffMuros(
  muros: readonly Muro[],
  altoM?: number,
  huecos: readonly Hueco[] = [],
): TakeoffMuro {
  const empty: TakeoffMuro = {
    largoM: 0,
    espesorM: V2_MURO.espesorM,
    altoM: altoM ?? V2_MURO.altoM,
    areaM2: 0,
    areaNetaM2: 0,
    vanoM2: 0,
    volumenM3: 0,
    blocksEst: 0,
    hormigonM3: 0,
    aceroT: 0,
  };
  return muros.reduce((acc, m) => {
    const q = takeoffMuro(m, altoM ?? m.alto, huecos);
    return {
      largoM: acc.largoM + q.largoM,
      espesorM: q.espesorM,
      altoM: q.altoM,
      areaM2: acc.areaM2 + q.areaM2,
      areaNetaM2: acc.areaNetaM2 + q.areaNetaM2,
      vanoM2: acc.vanoM2 + q.vanoM2,
      volumenM3: acc.volumenM3 + q.volumenM3,
      blocksEst: acc.blocksEst + q.blocksEst,
      hormigonM3: acc.hormigonM3 + q.hormigonM3,
      aceroT: acc.aceroT + q.aceroT,
    };
  }, empty);
}

export function takeoffColumna(c: Columna): { hormigonM3: number; aceroT: number } {
  const hormigonM3 = Math.max(0, c.lado * c.lado * V2_COLUMNA.altoM);
  return { hormigonM3, aceroT: hormigonM3 * V2_COLUMNA.steelTPerM3 };
}

export function takeoffZapata(z: Zapata): { hormigonM3: number; aceroT: number } {
  const hormigonM3 = Math.max(0, z.lado * z.lado * V2_ZAPATA.cantoM);
  return { hormigonM3, aceroT: hormigonM3 * V2_ZAPATA.steelTPerM3 };
}

export function takeoffViga(v: Viga): { largoM: number; hormigonM3: number; aceroT: number } {
  const largoM = vigaLargo(v);
  const canto = v.canto ?? V2_VIGA.cantoM;
  const hormigonM3 = Math.max(0, largoM * v.ancho * canto);
  return { largoM, hormigonM3, aceroT: hormigonM3 * V2_VIGA.steelTPerM3 };
}

export function takeoffLosa(l: Losa): { areaM2: number; hormigonM3: number; aceroT: number } {
  const areaM2 = Math.max(0, losaArea(l));
  const espesor = l.espesor ?? V2_LOSA_PLANTA.espesorM;
  const hormigonM3 = areaM2 * espesor;
  return { areaM2, hormigonM3, aceroT: hormigonM3 * V2_LOSA_PLANTA.steelTPerM3 };
}

export type TakeoffScene = {
  largoM: number;
  areaM2: number;
  areaNetaM2: number;
  vanoM2: number;
  blocksEst: number;
  blocksGross: number;
  blocksDelta: number;
  hormigonM3: number;
  aceroT: number;
  losaM2: number;
  morteroM3: number;
  albanilM2: number;
};

export type SceneQty = {
  walls: readonly Muro[];
  openings?: readonly Hueco[];
  columns?: readonly Columna[];
  footings?: readonly Zapata[];
  beams?: readonly Viga[];
  slabs?: readonly Losa[];
};

export function takeoffScene(s: SceneQty): TakeoffScene {
  const openings = s.openings ?? [];
  const wallsNet = takeoffMuros(s.walls, undefined, openings);
  const wallsGross = takeoffMuros(s.walls, undefined, []);
  let hormigonM3 = wallsNet.hormigonM3;
  let aceroT = wallsNet.aceroT;
  let largoM = wallsNet.largoM;
  let losaM2 = 0;
  for (const c of s.columns ?? []) {
    const q = takeoffColumna(c);
    hormigonM3 += q.hormigonM3;
    aceroT += q.aceroT;
  }
  for (const z of s.footings ?? []) {
    const q = takeoffZapata(z);
    hormigonM3 += q.hormigonM3;
    aceroT += q.aceroT;
  }
  for (const v of s.beams ?? []) {
    const q = takeoffViga(v);
    largoM += q.largoM;
    hormigonM3 += q.hormigonM3;
    aceroT += q.aceroT;
  }
  for (const l of s.slabs ?? []) {
    const q = takeoffLosa(l);
    losaM2 += q.areaM2;
    hormigonM3 += q.hormigonM3;
    aceroT += q.aceroT;
  }
  return {
    largoM,
    areaM2: wallsNet.areaM2,
    areaNetaM2: wallsNet.areaNetaM2,
    vanoM2: wallsNet.vanoM2,
    blocksEst: wallsNet.blocksEst,
    blocksGross: wallsGross.blocksEst,
    blocksDelta: wallsNet.blocksEst - wallsGross.blocksEst,
    hormigonM3,
    aceroT,
    losaM2,
    morteroM3: Math.max(0, wallsNet.areaNetaM2 * V2_MURO.morteroM3PerM2),
    albanilM2: Math.max(0, wallsNet.areaNetaM2),
  };
}

/** Puente al presupuesto V2 (qty × precio). Sin excavación: lote vacío. */
export function takeoffAsCost(q: TakeoffMuro | TakeoffScene): Takeoff {
  return {
    kind: "contencion",
    largoM: q.largoM,
    excavacionM3: 0,
    hormigonM3: q.hormigonM3,
    aceroT: q.aceroT,
  };
}