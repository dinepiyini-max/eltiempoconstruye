/**
 * Pliego de encargo — por qué existe este valle.
 *
 * No es tutorial. Es el documento que te contrató.
 * sim.ts lee FLOOD.day y MANDANTE; la UI solo pinta estas cadenas.
 *
 * Tesis: el tiempo construye; tú decides qué merece ser construido.
 */
import type { StructureId, V1ContractId } from "./types";

export const MANDANTE = "Consorcio Municipal del Valle del Yuna";
export const CARGO = "Jefe de obra";
export const PROYECTO = "Proyecto 001";

/** Crecida de diseño. El reloj de sitio la alcanza en FLOOD.day. */
export const FLOOD = {
  day: 12,
  cota: "+31,2 m",
  q: "Q50",
  label: "CRECIDA Q50",
} as const;

export const ENCARGO_LINE =
  "Conectar la terraza aluvial con el cerro norte antes de la crecida.";

export const TESIS = "El tiempo construye. Tú decides qué merece ser construido.";

export const PLIEGO_LINES: readonly string[] = [
  `Mandante · ${MANDANTE}`,
  `Cargo · ${CARGO} del ${PROYECTO}`,
  ENCARGO_LINE,
  `Amenaza · ${FLOOD.label} · cota ${FLOOD.cota} · día ${FLOOD.day} de sitio`,
  "Tres frentes del pliego: CAMINO (llegar) · PUENTE (cruzar el Yuna) · MURO (sostener la ladera).",
  "Tú diriges. El reloj no espera. Sin hormigón no se vierte; sin acero no se arma.",
  TESIS,
];

export type FrentePurpose = {
  id: V1ContractId;
  title: string;
  body: string;
  purpose: string;
  threat: string;
  durationDays: number;
  cost: number;
  prestigio: number;
  difficulty: 1 | 2 | 3;
};

/** Cada contrato es un frente del pliego, no un ítem de tienda. */
export const FRENTE_PLIEGO: Record<V1ContractId, FrentePurpose> = {
  camino: {
    id: "camino",
    title: "Camino de acceso al predio",
    body: "Vía de 1,2 km desde el camino vecinal hasta la terraza de trabajo.",
    purpose: "Sin camino no llega el hormigón. El valle queda a pie.",
    threat: "Si la crecida llega antes, el predio queda aislado.",
    durationDays: 4,
    cost: 42000,
    prestigio: 8,
    difficulty: 1,
  },
  puente: {
    id: "puente",
    title: "Puente sobre el Yuna",
    body: "Paso de 48 m. El río corta el valle; el cerro norte queda al otro lado.",
    purpose: "Sin puente el encargo no existe: no hay cruce.",
    threat: "La crecida Q50 se lleva el vado. Después no hay paso.",
    durationDays: 6,
    cost: 86000,
    prestigio: 14,
    difficulty: 2,
  },
  muro: {
    id: "muro",
    title: "Muro de la ladera norte",
    body: "Contención anclada. La terraza no sostiene carga de obra sin él.",
    purpose: "Sostiene el cerro. Sin muro, el acceso se lava.",
    threat: "La crecida socava la ladera. El camino no sirve.",
    durationDays: 5,
    cost: 64000,
    prestigio: 11,
    difficulty: 2,
  },
};

export const SCRIPT_60 = {
  received: "VALLE DEL YUNA · ENCARGO RECIBIDO",
  pliego: `PLIEGO: ${ENCARGO_LINE} Tú diriges la obra. El tiempo construye.`,
  levanta: "LEVANTA EL TERRENO",
  flood: `ZONA DE INUNDACIÓN · cota ${FLOOD.cota} · no fundar a ciegas`,
  define: "DEFINE EL PRIMER FRENTE · Camino, puente o muro · la cuadrilla nace sola",
  regime: "TURNO DE OBRA 07–18 · o sella SIEMPRE ABIERTA si el plazo aprieta",
  after: "El valle ya tiene frente. Asigna, pide hormigón, decide qué merece el siguiente trazo.",
  merece: "¿Merece el valle este frente ahora?",
  forzada: "Jornada forzada — la obra avanza; la gente no.",
  archivo: "Pieza admitida al archivo del valle.",
} as const;

export function purposeOf(id: StructureId): FrentePurpose | null {
  if (id === "camino" || id === "puente" || id === "muro") return FRENTE_PLIEGO[id];
  return null;
}
