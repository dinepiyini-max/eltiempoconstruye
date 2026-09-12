/**
 * Quantity V2 — takeoff. Tablas propias. No lee STRUCTURE_DEF.
 */
import type { Measured, Muro } from "./geometry.ts";
import { muroLargo } from "./geometry.ts";
import { V2_MURO, V2_SECTIONS, type V2Kind } from "./tables.ts";

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
  volumenM3: number;
  blocksEst: number;
  hormigonM3: number;
  aceroT: number;
};

export function takeoffMuro(m: Muro, altoM = V2_MURO.altoM): TakeoffMuro {
  const largoM = muroLargo(m);
  const espesorM = m.espesor;
  const areaM2 = Math.max(0, largoM * altoM);
  const volumenM3 = Math.max(0, largoM * altoM * espesorM);
  const blocksEst = Math.ceil(areaM2 / V2_MURO.blockFaceM2 - 1e-9);
  const hormigonM3 = volumenM3;
  const aceroT = hormigonM3 * V2_SECTIONS.contencion.steelTPerM3;
  return { largoM, espesorM, altoM, areaM2, volumenM3, blocksEst, hormigonM3, aceroT };
}

export function takeoffMuros(muros: readonly Muro[], altoM = V2_MURO.altoM): TakeoffMuro {
  const empty: TakeoffMuro = {
    largoM: 0,
    espesorM: V2_MURO.espesorM,
    altoM,
    areaM2: 0,
    volumenM3: 0,
    blocksEst: 0,
    hormigonM3: 0,
    aceroT: 0,
  };
  return muros.reduce((acc, m) => {
    const q = takeoffMuro(m, altoM);
    return {
      largoM: acc.largoM + q.largoM,
      espesorM: q.espesorM,
      altoM,
      areaM2: acc.areaM2 + q.areaM2,
      volumenM3: acc.volumenM3 + q.volumenM3,
      blocksEst: acc.blocksEst + q.blocksEst,
      hormigonM3: acc.hormigonM3 + q.hormigonM3,
      aceroT: acc.aceroT + q.aceroT,
    };
  }, empty);
}

/** Puente al presupuesto V2 (qty × precio). Sin excavación: lote vacío. */
export function takeoffAsCost(q: TakeoffMuro): Takeoff {
  return {
    kind: "contencion",
    largoM: q.largoM,
    excavacionM3: 0,
    hormigonM3: q.hormigonM3,
    aceroT: q.aceroT,
  };
}
