/**
 * Quantity V2 — takeoff. Tablas propias. No lee STRUCTURE_DEF.
 */
import type { Columna, Hueco, Losa, Measured, Muro, Viga, Zapata } from "./geometry.ts";
import { losaArea, muroLargo, vigaLargo } from "./geometry.ts";
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

const MED_EPS = 1e-9;

export type MedicionEstado = "completa" | "recortada" | "incompleta" | "supuesto" | "vacia";

export type VanoMedido = {
  id: string;
  /** Ancho que realmente pisa el muro, m. */
  anchoEnMuro: number;
  /** Alto usado en el descuento, nunca mayor que el muro. */
  altoEnMuro: number;
  /** ancho × alto nominal. null si falta una dimensión. */
  nominalM2: number | null;
  /** Rectángulo recortado al muro, antes de unir con otros vanos. */
  recortadoM2: number;
  solapa: boolean;
  fuera: boolean;
  altoExcede: boolean;
  incompleto: boolean;
};

export type MedicionMuro = {
  largoM: number;
  altoM: number | null;
  espesorM: number | null;
  areaBrutaM2: number | null;
  /** Unión de vanos. Nunca supera el área bruta. Nunca es negativa. */
  vanoM2: number;
  areaNetaM2: number | null;
  volumenM3: number | null;
  estado: MedicionEstado;
  notas: string[];
  vanos: VanoMedido[];
};

export type DescuentoVano = {
  areaM2: number | null;
  volumenM3: number | null;
  estado: MedicionEstado;
  notas: string[];
};

function positivo(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

function resolveAltoMuro(m: Muro, altoM?: number): number | null {
  return positivo(altoM != null ? altoM : m.alto);
}

/**
 * Medición del muro en metros.
 * Cada vano es un rectángulo de planta (eje del muro) por alto, sin antepecho:
 * el modelo no guarda la cota del alféizar.
 * Los que se solapan se unen (el solape cuenta una vez).
 * Lo que cae fuera del muro no se descuenta.
 * Si falta una dimensión, esa parte queda en null y el estado es incompleta.
 */
export function medicionMuro(m: Muro, huecos: readonly Hueco[] = [], altoM?: number): MedicionMuro {
  const largo = muroLargo(m);
  const largoOk = Number.isFinite(largo) && largo > MED_EPS;
  const alto = resolveAltoMuro(m, altoM);
  const espesor = positivo(m.espesor);
  const notas: string[] = [];
  if (!largoOk) notas.push("Largo no medible. No hay área.");
  if (alto == null) notas.push("Falta el alto del muro. No hay área.");
  if (largoOk && alto != null && espesor == null) notas.push("Falta el espesor. No hay volumen.");

  if (!largoOk || alto == null) {
    return {
      largoM: Number.isFinite(largo) ? Math.max(0, largo) : 0,
      altoM: alto,
      espesorM: espesor,
      areaBrutaM2: null,
      vanoM2: 0,
      areaNetaM2: null,
      volumenM3: null,
      estado: "incompleta",
      notas,
      vanos: [],
    };
  }

  const areaBruta = largo * alto;
  const propios = huecos.filter((h) => h.wallId === m.id);
  const vanos: VanoMedido[] = [];
  const rects: { id: string; lo: number; hi: number; h: number }[] = [];

  for (const h of propios) {
    const ancho = positivo(h.ancho);
    const altoNominal = positivo(h.alto);
    const alongOk = typeof h.alongM === "number" && Number.isFinite(h.alongM);
    if (ancho == null || altoNominal == null || !alongOk) {
      vanos.push({
        id: h.id,
        anchoEnMuro: 0,
        altoEnMuro: 0,
        nominalM2: null,
        recortadoM2: 0,
        solapa: false,
        fuera: false,
        altoExcede: false,
        incompleto: true,
      });
      notas.push(`${h.id}: falta ancho o alto. No se descuenta.`);
      continue;
    }
    const rawLo = h.alongM - ancho / 2;
    const rawHi = h.alongM + ancho / 2;
    const lo = Math.max(0, rawLo);
    const hi = Math.min(largo, rawHi);
    const anchoEn = Math.max(0, hi - lo);
    const altoExcede = altoNominal > alto + MED_EPS;
    const fuera = rawLo < -MED_EPS || rawHi > largo + MED_EPS;
    const altoEn = Math.min(altoNominal, alto);
    const recortado = anchoEn * altoEn;
    vanos.push({
      id: h.id,
      anchoEnMuro: anchoEn,
      altoEnMuro: altoEn,
      nominalM2: ancho * altoNominal,
      recortadoM2: recortado,
      solapa: false,
      fuera,
      altoExcede,
      incompleto: false,
    });
    if (anchoEn > MED_EPS) rects.push({ id: h.id, lo, hi, h: altoEn });
    if (anchoEn <= MED_EPS) notas.push(`${h.id}: no pisa el muro. Descuento 0.`);
    else if (fuera || altoExcede) {
      notas.push(
        `${h.id}: ${ancho.toFixed(2)}×${altoNominal.toFixed(2)} m nominal; en el muro entran ${anchoEn.toFixed(2)}×${altoEn.toFixed(2)} m.`,
      );
    }
  }

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      if (Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > MED_EPS) {
        const va = vanos.find((v) => v.id === a.id);
        const vb = vanos.find((v) => v.id === b.id);
        if (va) va.solapa = true;
        if (vb) vb.solapa = true;
      }
    }
  }
  if (vanos.some((v) => v.solapa)) notas.push("Los vanos se solapan. El descuento es la unión, no la suma.");

  const vanoM2 = Math.min(areaBruta, Math.max(0, unionArea(rects)));
  const areaNeta = Math.max(0, areaBruta - vanoM2);
  const volumen = espesor == null ? null : areaNeta * espesor;
  let estado: MedicionEstado = "completa";
  if (espesor == null || vanos.some((v) => v.incompleto)) estado = "incompleta";
  else if (vanos.some((v) => v.solapa || v.fuera || v.altoExcede)) estado = "recortada";

  return {
    largoM: largo,
    altoM: alto,
    espesorM: espesor,
    areaBrutaM2: areaBruta,
    vanoM2,
    areaNetaM2: areaNeta,
    volumenM3: volumen,
    estado,
    notas,
    vanos,
  };
}

/** Área de la unión de rectángulos apoyados en la base del muro. */
function unionArea(rects: readonly { lo: number; hi: number; h: number }[]): number {
  if (!rects.length) return 0;
  const xs = [...new Set(rects.flatMap((r) => [r.lo, r.hi]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1]!;
    const x1 = xs[i]!;
    const w = x1 - x0;
    if (w <= MED_EPS) continue;
    const mid = (x0 + x1) / 2;
    let h = 0;
    for (const r of rects) {
      if (r.lo <= mid && mid <= r.hi && r.h > h) h = r.h;
    }
    area += w * h;
  }
  return area;
}

/**
 * Descuento marginal de un vano: unión con él menos unión sin él.
 * null si no se puede medir. Nunca negativo.
 */
export function descuentoVano(m: Muro, huecos: readonly Hueco[], id: string, altoM?: number): DescuentoVano {
  const med = medicionMuro(m, huecos, altoM);
  if (med.areaBrutaM2 == null) {
    return {
      areaM2: null,
      volumenM3: null,
      estado: "incompleta",
      notas: med.notas.length ? med.notas : ["El muro no se puede medir. No se descuenta."],
    };
  }
  const uno = med.vanos.find((v) => v.id === id);
  if (!uno) {
    return {
      areaM2: null,
      volumenM3: null,
      estado: "incompleta",
      notas: [`${id}: no está en ese muro. No se descuenta.`],
    };
  }
  if (uno.incompleto) {
    return {
      areaM2: null,
      volumenM3: null,
      estado: "incompleta",
      notas: med.notas.filter((n) => n.startsWith(`${id}:`)),
    };
  }
  const sin = medicionMuro(
    m,
    huecos.filter((h) => h.id !== id),
    altoM,
  );
  const area = Math.max(0, med.vanoM2 - sin.vanoM2);
  const volumen = med.espesorM == null ? null : area * med.espesorM;
  const estado: MedicionEstado = uno.solapa || uno.fuera || uno.altoExcede ? "recortada" : "completa";
  const notas = med.notas.filter((n) => n.startsWith(`${id}:`) || (uno.solapa && n.startsWith("Los vanos")));
  if (uno.solapa && area <= MED_EPS) notas.push("Solapa por completo. Este vano no descuenta de nuevo.");
  return { areaM2: area, volumenM3: volumen, estado, notas };
}

export function takeoffMuro(m: Muro, altoM?: number, huecos: readonly Hueco[] = []): TakeoffMuro {
  const med = medicionMuro(m, huecos, altoM);
  const largoM = med.largoM;
  const espesorM = med.espesorM ?? (positivo(m.espesor) ?? 0);
  const alto = med.altoM ?? 0;
  const areaM2 = med.areaBrutaM2 ?? 0;
  const vanoM2 = med.vanoM2;
  const areaNetaM2 = med.areaNetaM2 ?? 0;
  const volumenM3 = med.volumenM3 ?? 0;
  const blocksEst = med.areaNetaM2 == null ? 0 : Math.ceil(areaNetaM2 / V2_MURO.blockFaceM2 - 1e-9);
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
  const canto = v.canto;
  const ancho = v.ancho;
  if (!(largoM > 0) || !(ancho > 0) || !(canto > 0)) {
    return { largoM: Number.isFinite(largoM) ? Math.max(0, largoM) : 0, hormigonM3: 0, aceroT: 0 };
  }
  const hormigonM3 = largoM * ancho * canto;
  return { largoM, hormigonM3, aceroT: hormigonM3 * V2_VIGA.steelTPerM3 };
}

export function takeoffLosa(l: Losa): { areaM2: number; hormigonM3: number; aceroT: number } {
  const areaM2 = Math.max(0, losaArea(l));
  const espesor = l.espesor;
  if (!(areaM2 > 0) || !(espesor > 0)) return { areaM2, hormigonM3: 0, aceroT: 0 };
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