import { FRENTE_PLIEGO } from "./pliego";
import type {
  Contract,
  Crew,
  FrontId,
  GameState,
  ProtoKind,
  SaveSlot,
  StructureId,
  StructureStage,
  StructureState,
} from "./types";
import { STRUCTURE_IDS, STAGES, V1_CONTRACT_IDS } from "./types";

/** 8 minutos de sitio por segundo real. 3 min reales ≈ 1 día de obra. */
export const SITE_MINUTES_PER_REAL_SECOND = 8;
/** El valle no simula más de 8 h reales de ausencia. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

/** Dos cajas. saveState nunca escribe la otra. */
export const SLOT_KEYS: Record<SaveSlot, { live: string; bak: string }> = {
  jefe: { live: "obra.jefe", bak: "obra.jefe.bak" },
  visita: { live: "obra.visita", bak: "obra.visita.bak" },
};

/** Previous single-save keys. Migrated only into `obra.jefe`. */
export const LEGACY_SAVE_KEYS = ["obra.proyecto001.v1", "obra.proyecto001.v1.bak"] as const;

export const RIVER_NAME = "Río Yuna";
export const VALLEY_NAME = "Valle del Yuna";

export const SITE_GEO = {
  valle: VALLEY_NAME,
  municipio: "Santo Domingo Este",
  lat: "18° 29′ 14″ N",
  lon: "69° 51′ 22″ O",
  utmZone: "19N",
  easting: "412.086 m E",
  northing: "2.184.320 m N",
  datum: "WGS 84",
  scale: "1 : 2 000",
  cota: "42,8 m s.n.m.",
  declinacion: "Nm 12° 10′ O (2026)",
};

export const STAGE_LABEL: Record<StructureStage, string> = {
  vacio: "SIN LEVANTAR",
  levantado: "LEVANTADO",
  trazado: "TRAZADO",
  excavacion: "EXCAVACIÓN",
  armado: "ARMADO",
  encofrado: "ENCOFRADO",
  estructura: "ESTRUCTURA",
  conexion: "CONECTADO",
};

export const NEXT_HITO: Record<StructureStage, string> = {
  vacio: "AUTORIZAR FRENTE",
  levantado: "TRAZADO",
  trazado: "EXCAVACIÓN",
  excavacion: "ARMADO",
  armado: "ENCOFRADO",
  encofrado: "ESTRUCTURA",
  estructura: "CONEXIÓN",
  conexion: "ARCHIVO",
};

export const STRUCTURE_NAME: Record<StructureId, string> = {
  camino: "Camino de acceso",
  puente: "Puente",
  muro: "Muro de contención",
  cimentacion: "Cimentación",
  planta: "Planta de hormigón",
  viaducto: "Viaducto",
};

export const STRUCTURE_NAME_UP: Record<StructureId, string> = {
  camino: "CAMINO",
  puente: "PUENTE",
  muro: "MURO",
  cimentacion: "CIMENT.",
  planta: "PLANTA",
  viaducto: "VIADUCTO",
};

export const MAP_STAGE: Record<StructureStage, string> = {
  vacio: "—",
  levantado: "LEV.",
  trazado: "TRAZ.",
  excavacion: "EXC.",
  armado: "ARM.",
  encofrado: "ENC.",
  estructura: "ESTR.",
  conexion: "CONEX.",
};

export const PHASE_LABEL: Record<1 | 2 | 3, string> = {
  1: "FASE I  ·  RECONOCIMIENTO",
  2: "FASE II  ·  INFRAESTRUCTURA",
  3: "FASE III  ·  ESTRUCTURA",
};

export const RESOURCE_HINT: Record<string, string> = {
  Dinero: "Paga salarios y pedidos al valle. Firmar un frente no cobra peaje.",
  "Horas-hombre": "Jornada que queda. Al amanecer (07 h) se reponen. Si llega a cero, el ritmo baja y la nómina sube.",
  Hormigón: "Para verter encofrados y estructura. Pídelo aquí: no se fabrica solo.",
  Acero: "Para armar. Pídelo aquí si el almacén se acaba.",
  Conocimiento: "Se gana levantando, con ingenieros en un frente y al terminar una pieza. No se compra.",
  Prestigio: "Se gana al archivar un frente del pliego. A medias si el plazo del frente se pasó.",
  "CRECIDA Q50": "Cota de diseño del Yuna. El mismo N en cabecera, contratos y ficha. No es el plazo de un frente.",
  OBR: "Obreros. Sin ellos el frente se detiene.",
  CAP: "Capataces. Mejoran el ritmo de los obreros.",
  ING: "Ingenieros. Suben el ritmo y el conocimiento.",
  TOP: "Topógrafos. Hacen falta en levantado y trazado.",
};

export const REGIME_CAPTION = {
  turno: "07–18 h · de noche la obra espera. Tocar para jornada forzada.",
  siempre: "No cierra. De noche se paga más y cansa. Tocar para volver al turno.",
} as const;

export const PACE_CAPTION = "El sitio no para salvo que tú pauses el reloj.";

export const BOTTLE_GLOSS: Record<string, string> = {
  "SIN AUTORIZAR": "Este frente aún no está firmado. Sella CAMINO, PUENTE o MURO, o firma en CONTRATOS.",
  "SIN CUADRILLA": "Nadie trabaja aquí. Asigna desde disponibles o abre OBRA.",
  "FALTA TOPÓGRAFO": "El trazado pide quien mida. Pasa un topógrafo desde disponibles, o quítalo de otro frente en OBRA.",
  "FALTAN OBREROS": "No hay manos. Pasa obreros desde disponibles, o quítalos de otro frente en OBRA.",
  "FALTA ACERO": "Sin acero no se arma. Pide un lote en el cajetín (cifra de Acero).",
  "FALTA HORMIGÓN": "Sin hormigón no se vierte. Pide un viaje en el cajetín (cifra de Hormigón).",
  "LLUVIA — NO SE VIERTE": "Llueve. El hormigón fresco no se vierte. Espera a que escampe.",
  "LLUVIA EN ESTE FRENTE": "Llueve aquí. El ritmo baja. No hay gesto: el frente espera.",
  "ARMADO DETENIDO — MATERIAL": "Falta material de armado. Pide acero en el cajetín.",
  "FUERA DE TURNO": "Fuera de 07–18. Espera el alba o sella SIEMPRE ABIERTA.",
  "JORNADA EXTRA": "Se acabaron las horas-hombre. Amanece y se reponen.",
  "CRECIDA EN EL SITIO": "Llegó la Q50. El ritmo baja. El pliego se incumplió. Sigue o NUEVA PARTIDA.",
};

export const SUPPLY = {
  hormigon: { qty: 20, cost: 4800, unit: "m³", noun: "viaje de hormigón" },
  acero: { qty: 8, cost: 6400, unit: "t", noun: "lote de acero" },
} as const;

export type StructureDef = {
  id: StructureId;
  x: number;
  y: number;
  knowledgeMin: number;
  method: string;
  stageHours: Record<Exclude<StructureStage, "vacio" | "conexion">, number> & {
    conexion: number;
  };
  steel: Partial<Record<StructureStage, number>>;
  concrete: Partial<Record<StructureStage, number>>;
  excavate: Partial<Record<StructureStage, number>>;
  requires: Partial<Record<StructureId, StructureStage>>;
};

export const STRUCTURE_DEF: Record<StructureId, StructureDef> = {
  camino: {
    id: "camino",
    x: 210,
    y: 392,
    knowledgeMin: 0,
    method: "Terraplén compactado y capa de rodadura.",
    stageHours: {
      levantado: 1,
      trazado: 1,
      excavacion: 6,
      armado: 3,
      encofrado: 2,
      estructura: 5,
      conexion: 3,
    },
    steel: { armado: 2 },
    concrete: { estructura: 18 },
    excavate: { excavacion: 420 },
    requires: {},
  },
  puente: {
    id: "puente",
    x: 338,
    y: 328,
    knowledgeMin: 0,
    method: "Losa de hormigón sobre pilas. Luces de 16 m.",
    stageHours: {
      levantado: 1.2,
      trazado: 1.2,
      excavacion: 8,
      armado: 8,
      encofrado: 7,
      estructura: 10,
      conexion: 4,
    },
    steel: { armado: 14, estructura: 6 },
    concrete: { estructura: 64 },
    excavate: { excavacion: 180 },
    requires: {},
  },
  muro: {
    id: "muro",
    x: 456,
    y: 198,
    knowledgeMin: 0,
    method: "Muro de hormigón ciclópeo anclado a la ladera.",
    stageHours: {
      levantado: 1,
      trazado: 1,
      excavacion: 9,
      armado: 6,
      encofrado: 6,
      estructura: 8,
      conexion: 3,
    },
    steel: { armado: 8 },
    concrete: { estructura: 52 },
    excavate: { excavacion: 310 },
    requires: {},
  },
  cimentacion: {
    id: "cimentacion",
    x: 572,
    y: 408,
    knowledgeMin: 28,
    method: "Zapatas corridas sobre terraza aluvial.",
    stageHours: {
      levantado: 4,
      trazado: 4,
      excavacion: 10,
      armado: 8,
      encofrado: 6,
      estructura: 9,
      conexion: 4,
    },
    steel: { armado: 18, estructura: 4 },
    concrete: { estructura: 88 },
    excavate: { excavacion: 540 },
    requires: { muro: "trazado" },
  },
  planta: {
    id: "planta",
    x: 708,
    y: 448,
    knowledgeMin: 32,
    method: "Dosificación in situ. Dos amasadoras.",
    stageHours: {
      levantado: 3,
      trazado: 3,
      excavacion: 5,
      armado: 5,
      encofrado: 5,
      estructura: 8,
      conexion: 4,
    },
    steel: { armado: 6 },
    concrete: { estructura: 28 },
    excavate: { excavacion: 90 },
    requires: { camino: "estructura" },
  },
  viaducto: {
    id: "viaducto",
    x: 780,
    y: 318,
    knowledgeMin: 44,
    method: "Tablero continuo sobre pilas. 220 m.",
    stageHours: {
      levantado: 6,
      trazado: 6,
      excavacion: 12,
      armado: 14,
      encofrado: 12,
      estructura: 18,
      conexion: 8,
    },
    steel: { armado: 36, estructura: 16 },
    concrete: { estructura: 220 },
    excavate: { excavacion: 260 },
    requires: {
      puente: "estructura",
      cimentacion: "estructura",
      planta: "estructura",
    },
  },
};

export type ProtoDef = {
  id: ProtoKind;
  label: string;
  method: string;
  mul: number;
  steel: number;
  concrete: number;
};

export const PROTO_DEF: Record<ProtoKind, ProtoDef> = {
  casa: {
    id: "casa",
    label: "Casa",
    method: "Muros de carga y losa. Ensayo de vivienda.",
    mul: 0.55,
    steel: 2,
    concrete: 8,
  },
  nave: {
    id: "nave",
    label: "Nave",
    method: "Pórticos y cubierta ligera.",
    mul: 0.7,
    steel: 4,
    concrete: 12,
  },
  torre: {
    id: "torre",
    label: "Torre",
    method: "Núcleo y forjados. Ensayo en altura.",
    mul: 0.95,
    steel: 6,
    concrete: 16,
  },
  muelle: {
    id: "muelle",
    label: "Muelle",
    method: "Pilotes y tablero sobre el agua.",
    mul: 0.8,
    steel: 3,
    concrete: 14,
  },
  puente: {
    id: "puente",
    label: "Puente de ensayo",
    method: "Losa sobre dos apoyos. Luces cortas.",
    mul: 0.85,
    steel: 5,
    concrete: 18,
  },
};

function seedContract(id: (typeof V1_CONTRACT_IDS)[number], contractId: string): Contract {
  const f = FRENTE_PLIEGO[id];
  return {
    id: contractId,
    title: f.title,
    body: f.body,
    purpose: f.purpose,
    threat: f.threat,
    cost: f.cost,
    durationDays: f.durationDays,
    difficulty: f.difficulty,
    requiredKnowledge: STRUCTURE_DEF[id].knowledgeMin,
    prestigio: f.prestigio,
    structureId: id,
    status: "bloqueado",
    acceptedDay: null,
  };
}

export const CONTRACTS_SEED: Contract[] = [
  seedContract("camino", "c-002"),
  seedContract("puente", "c-003"),
  seedContract("muro", "c-004"),
];

export const CREWS_SEED: Crew[] = [
  {
    id: "c01",
    name: "CUADRILLA 01",
    front: "reserva",
    obreros: 2,
    capataces: 0,
    ingenieros: 0,
    topografos: 1,
  },
  {
    id: "c02",
    name: "CUADRILLA 02",
    front: "reserva",
    obreros: 8,
    capataces: 1,
    ingenieros: 1,
    topografos: 0,
  },
  {
    id: "c03",
    name: "CUADRILLA 03",
    front: "reserva",
    obreros: 6,
    capataces: 1,
    ingenieros: 1,
    topografos: 0,
  },
];

export function emptyStructure(id: StructureId): StructureState {
  return {
    id,
    stage: "vacio",
    progress: 0,
    opened: false,
    hoursWorked: 0,
    costAccrued: 0,
  };
}

export function createInitialState(): GameState {
  const structures = {} as GameState["structures"];
  for (const id of STRUCTURE_IDS) structures[id] = emptyStructure(id);
  return {
    version: 1,
    page: "plano",
    phase: 1,
    regime: "turno",
    siteMinutes: 7 * 60,
    siteRemainder: 0,
    realLastSeen: Date.now(),
    seed: 1729,
    survey: 0,
    surveying: false,
    instruction: "levanta",
    selected: null,
    structures,
    crews: CREWS_SEED.map((c) => ({ ...c })),
    resources: {
      dinero: 620000,
      horasHombre: 2400,
      hormigon: 28,
      acero: 74,
      conocimiento: 4,
    },
    prestigio: 0,
    fatigue: 0,
    contracts: CONTRACTS_SEED.map((c) => ({ ...c })),
    archive: [],
    events: [],
    minutesSinceEvent: 40,
    slowdowns: [],
    totals: { excavado: 0, acero: 0, hormigon: 0, horasHombre: 0 },
    absence: null,
    lastNotice: null,
    prototype: null,
    cartaRead: true,
    libreta: [],
    floodStatus: "pendiente",
    clockPace: "normal",
    libretaOpen: false,
    libretaPinned: false,
  };
}

export function stageIndex(stage: StructureStage): number {
  return STAGES.indexOf(stage);
}

export function nextStage(stage: StructureStage): StructureStage | null {
  const i = stageIndex(stage);
  if (i < 0 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1] ?? null;
}

export const WAGE: Record<"obrero" | "capataz" | "ingeniero" | "topografo", number> = {
  obrero: 18,
  capataz: 36,
  ingeniero: 54,
  topografo: 42,
};

export const OFICIO_KEY: Record<
  "obrero" | "capataz" | "ingeniero" | "topografo",
  "obreros" | "capataces" | "ingenieros" | "topografos"
> = {
  obrero: "obreros",
  capataz: "capataces",
  ingeniero: "ingenieros",
  topografo: "topografos",
};

export const FRONT_LABEL: Record<FrontId, string> = {
  reserva: "DISPONIBLES",
  survey: "LEVANTAMIENTO",
  ensayo: "ENSAYO",
  camino: "CAMINO",
  puente: "PUENTE",
  muro: "MURO",
  cimentacion: "CIMENTACIÓN",
  planta: "PLANTA",
  viaducto: "VIADUCTO",
};
