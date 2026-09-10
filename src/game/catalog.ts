import type {
  Bottle,
  Contract,
  Crew,
  EventKind,
  NoteKind,
  Page,
  PliegoId,
  Role,
  RolePlural,
  Stage,
  StructureId,
} from "./types.ts";

export const MANDANTE = "Consorcio Municipal del Valle del Yuna";
export const CARGO = "Jefe de obra";
export const PROYECTO = "Proyecto 001";
export const VALLE = "Valle del Yuna";
export const RIO = "Río Yuna";

export const FLOOD = {
  day: 12,
  cota: "+31,2 m",
  q: "Q50",
  label: "CRECIDA Q50",
} as const;

export const PLIEGO_LINE =
  "Conectar la terraza aluvial con el cerro norte antes de la crecida.";
export const MOTTO =
  "El tiempo construye. Tú decides qué merece ser construido.";

export const PLIEGO_BULLETS = [
  `Mandante · ${MANDANTE}`,
  `Cargo · ${CARGO} del ${PROYECTO}`,
  PLIEGO_LINE,
  `Amenaza · ${FLOOD.label} · cota ${FLOOD.cota} · día ${FLOOD.day} de sitio`,
  "Tres frentes del pliego: CAMINO (llegar) · PUENTE (cruzar el Yuna) · MURO (sostener la ladera).",
  "Tú diriges. El reloj no espera. Sin hormigón no se vierte; sin acero no se arma.",
  MOTTO,
];

export const COPY = {
  received: "VALLE DEL YUNA · ENCARGO RECIBIDO",
  pliego: `PLIEGO: ${PLIEGO_LINE} Tú diriges la obra. El tiempo construye.`,
  levanta: "LEVANTA EL TERRENO",
  flood: `ZONA DE INUNDACIÓN · cota ${FLOOD.cota} · no fundar a ciegas`,
  define:
    "DEFINE EL PRIMER FRENTE · Camino, puente o muro · la cuadrilla nace sola",
  regime: "TURNO DE OBRA 07–18 · o sella SIEMPRE ABIERTA si el plazo aprieta",
  after:
    "El valle ya tiene frente. Asigna, pide hormigón, decide qué merece el siguiente trazo.",
  merece: "¿Merece el valle este frente ahora?",
  forzada: "Jornada forzada — la obra avanza; la gente no.",
  archivo: "Pieza admitida al archivo del valle.",
};

export const STORAGE = {
  jefe: { live: "obra.jefe", bak: "obra.jefe.bak" },
  visita: { live: "obra.visita", bak: "obra.visita.bak" },
} as const;

export const LEGACY_KEYS = ["obra.proyecto001.v1", "obra.proyecto001.v1.bak"];
export const DRAFT_KEY = (slot: string) => `obra.${slot}.draft`;
export const CATCHUP_CAP_MS = 28_800_000;

export const SITE = {
  valle: VALLE,
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

export const STAGE_LABEL: Record<Stage, string> = {
  vacio: "SIN LEVANTAR",
  levantado: "LEVANTADO",
  trazado: "TRAZADO",
  excavacion: "EXCAVACIÓN",
  armado: "ARMADO",
  encofrado: "ENCOFRADO",
  estructura: "ESTRUCTURA",
  conexion: "CONECTADO",
};

export const STAGE_NEXT: Record<Stage, string> = {
  vacio: "AUTORIZAR FRENTE",
  levantado: "TRAZADO",
  trazado: "EXCAVACIÓN",
  excavacion: "ARMADO",
  armado: "ENCOFRADO",
  encofrado: "ESTRUCTURA",
  estructura: "CONEXIÓN",
  conexion: "ARCHIVO",
};

export const STRUCT_NAME: Record<StructureId, string> = {
  camino: "Camino de acceso",
  puente: "Puente",
  muro: "Muro de contención",
  cimentacion: "Cimentación",
  planta: "Planta de hormigón",
  viaducto: "Viaducto",
};

export const STRUCT_SHORT: Record<StructureId, string> = {
  camino: "CAMINO",
  puente: "PUENTE",
  muro: "MURO",
  cimentacion: "CIMENT.",
  planta: "PLANTA",
  viaducto: "VIADUCTO",
};

export const STAGE_SHORT: Record<Stage, string> = {
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

export const HINTS: Record<string, string> = {
  Dinero: "Paga salarios y pedidos al valle. Firmar un frente no cobra peaje.",
  "Horas-hombre":
    "Jornada que queda. Al amanecer (07 h) se reponen. Si llega a cero, el ritmo baja y la nómina sube.",
  Hormigón:
    "Para verter encofrados y estructura. Pídelo aquí: no se fabrica solo.",
  Acero: "Para armar. Pídelo aquí si el almacén se acaba.",
  Conocimiento:
    "Se gana levantando, con ingenieros en un frente y al terminar una pieza. No se compra.",
  Prestigio:
    "Se gana al archivar un frente del pliego. A medias si el plazo del frente se pasó.",
  "CRECIDA Q50":
    "Cota de diseño del Yuna. El mismo N en cabecera. No es el plazo de un frente.",
  OBR: "Obreros. Sin ellos el frente se detiene.",
  CAP: "Capataces. Mejoran el ritmo de los obreros.",
  ING: "Ingenieros. Suben el ritmo y el conocimiento.",
  TOP: "Topógrafos. Hacen falta en levantado y trazado.",
};

export const REGIME_HINT = {
  turno: "07–18 h · de noche la obra espera. Tocar para jornada forzada.",
  siempre: "No cierra. De noche se paga más y cansa. Tocar para volver al turno.",
};

export const CLOCK_HINT =
  "El sitio no para salvo que tú pauses el reloj.";

export const BOTTLE_HINT: Record<Bottle, string> = {
  "SIN AUTORIZAR":
    "Este frente aún no está firmado. Sella CAMINO, PUENTE o MURO, o firma en CONTRATOS.",
  "SIN CUADRILLA": "Nadie trabaja aquí. Asigna desde disponibles o abre OBRA.",
  "FALTA TOPÓGRAFO":
    "El trazado pide quien mida. Pasa un topógrafo desde disponibles, o quítalo de otro frente en OBRA.",
  "FALTAN OBREROS":
    "No hay manos. Pasa obreros desde disponibles, o quítalos de otro frente en OBRA.",
  "FALTA ACERO":
    "Sin acero no se arma. Pide un lote en el cajetín (cifra de Acero).",
  "FALTA HORMIGÓN":
    "Sin hormigón no se vierte. Pide un viaje en el cajetín (cifra de Hormigón).",
  "LLUVIA — NO SE VIERTE":
    "Llueve. El hormigón fresco no se vierte. Espera a que escampe.",
  "LLUVIA EN ESTE FRENTE":
    "Llueve aquí. El ritmo baja. No hay gesto: el frente espera.",
  "ARMADO DETENIDO — MATERIAL":
    "Falta material de armado. Pide acero en el cajetín.",
  "FUERA DE TURNO": "Fuera de 07–18. Espera el alba o sella SIEMPRE ABIERTA.",
  "JORNADA EXTRA": "Se acabaron las horas-hombre. Amanece y se reponen.",
  "CRECIDA EN EL SITIO":
    "Llegó la Q50. El ritmo baja. El pliego se incumplió. Sigue o NUEVA PARTIDA.",
};

export const BOTTLE_ACT: Partial<Record<Bottle, string>> = {
  "FALTA ACERO": "Pedir acero en el cajetín.",
  "ARMADO DETENIDO — MATERIAL": "Pedir acero en el cajetín.",
  "FALTA HORMIGÓN": "Pedir hormigón en el cajetín.",
  "SIN CUADRILLA": "Asignar desde disponibles, o abre OBRA.",
  "FALTA TOPÓGRAFO": "Asignar desde disponibles, o abre OBRA.",
  "FALTAN OBREROS": "Asignar desde disponibles, o abre OBRA.",
  "FUERA DE TURNO": "Espera el alba o sella SIEMPRE ABIERTA.",
  "SIN AUTORIZAR": "Firmar el frente: sello o CONTRATOS.",
  "JORNADA EXTRA": "Amanece y se reponen las horas-hombre.",
  "CRECIDA EN EL SITIO": "Sigue la obra o sella NUEVA PARTIDA.",
};

export const ORDER = {
  hormigon: { qty: 20, cost: 4800, unit: "m³", noun: "viaje de hormigón" },
  acero: { qty: 8, cost: 6400, unit: "t", noun: "lote de acero" },
} as const;

type StageMap<T> = Partial<Record<Stage, T>>;

export type StructureDef = {
  id: StructureId;
  x: number;
  y: number;
  knowledgeMin: number;
  method: string;
  stageHours: StageMap<number>;
  steel: StageMap<number>;
  concrete: StageMap<number>;
  excavate: StageMap<number>;
  requires: Partial<Record<StructureId, Stage>>;
};

export const STRUCTURES: Record<StructureId, StructureDef> = {
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

export const CONTRACT_SPEC: Record<
  PliegoId,
  {
    title: string;
    body: string;
    purpose: string;
    threat: string;
    durationDays: number;
    cost: number;
    prestigio: number;
    difficulty: number;
  }
> = {
  camino: {
    title: "Camino de acceso al predio",
    body: "Vía de 1,2 km desde el camino vecinal hasta la terraza de trabajo.",
    purpose: "Sin camino no llega el hormigón. El valle queda a pie.",
    threat: "Si la crecida llega antes, el predio queda aislado.",
    durationDays: 4,
    cost: 42_000,
    prestigio: 8,
    difficulty: 1,
  },
  puente: {
    title: "Puente sobre el Yuna",
    body: "Paso de 48 m. El río corta el valle; el cerro norte queda al otro lado.",
    purpose: "Sin puente el encargo no existe: no hay cruce.",
    threat: "La crecida Q50 se lleva el vado. Después no hay paso.",
    durationDays: 6,
    cost: 86_000,
    prestigio: 14,
    difficulty: 2,
  },
  muro: {
    title: "Muro de la ladera norte",
    body: "Contención anclada. La terraza no sostiene carga de obra sin él.",
    purpose: "Sostiene el cerro. Sin muro, el acceso se lava.",
    threat: "La crecida socava la ladera. El camino no sirve.",
    durationDays: 5,
    cost: 64_000,
    prestigio: 11,
    difficulty: 2,
  },
};

export function makeContract(id: PliegoId, cid: string): Contract {
  const n = CONTRACT_SPEC[id];
  return {
    id: cid,
    title: n.title,
    body: n.body,
    purpose: n.purpose,
    threat: n.threat,
    cost: n.cost,
    durationDays: n.durationDays,
    difficulty: n.difficulty,
    requiredKnowledge: STRUCTURES[id].knowledgeMin,
    prestigio: n.prestigio,
    structureId: id,
    status: "bloqueado",
    acceptedDay: null,
  };
}

export const INITIAL_CONTRACTS: Contract[] = [
  makeContract("camino", "c-002"),
  makeContract("puente", "c-003"),
  makeContract("muro", "c-004"),
];

export const INITIAL_CREWS: Crew[] = [
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

export const WAGE: Record<Role, number> = {
  obrero: 18,
  capataz: 36,
  ingeniero: 54,
  topografo: 42,
};

export const ROLE_PLURAL: Record<Role, RolePlural> = {
  obrero: "obreros",
  capataz: "capataces",
  ingeniero: "ingenieros",
  topografo: "topografos",
};

export const FRONT_LABEL: Record<string, string> = {
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

export const NOTE_KINDS: { id: NoteKind; hint: string }[] = [
  { id: "BUG", hint: "Algo que falla en el sitio o en la lámina." },
  { id: "MEJORA", hint: "Lo que el valle pide." },
  { id: "DUDA", hint: "Lo que no está claro." },
  { id: "NOTA", hint: "Comentario libre." },
];

export const PAGES: Page[] = ["plano", "obra", "contratos", "archivo"];

export const HALT_BOTTLES = new Set<Bottle>([
  "SIN CUADRILLA",
  "FALTA TOPÓGRAFO",
  "FALTAN OBREROS",
  "FALTA ACERO",
  "FALTA HORMIGÓN",
  "LLUVIA — NO SE VIERTE",
  "ARMADO DETENIDO — MATERIAL",
  "FUERA DE TURNO",
]);

export const EVENT_POOL: {
  kind: EventKind;
  title: string;
  body: string;
  factor: number;
  minutes: number;
}[] = [
  {
    kind: "lluvia",
    title: "LLUVIA CONTINUA",
    body: "Llueve sobre este frente. A cielo abierto el ritmo baja. El hormigón fresco no se vierte.",
    factor: 0.52,
    minutes: 220,
  },
  {
    kind: "suelo",
    title: "SUELO IMPREVISTO",
    body: "La cata encuentra un estrato no cartografiado. Se corrige el trazado de este frente.",
    factor: 0.7,
    minutes: 140,
  },
  {
    kind: "material",
    title: "FALTA DE MATERIAL",
    body: "El almacén declara un faltante. El armado de este frente se detiene hasta pedir acero.",
    factor: 0,
    minutes: 90,
  },
  {
    kind: "inspeccion",
    title: "INSPECCIÓN DE OBRA",
    body: "Visita de control. Se revisan encofrados, anclajes y el régimen de jornada.",
    factor: 0.8,
    minutes: 80,
  },
  {
    kind: "diseno",
    title: "CAMBIO DE DISEÑO",
    body: "Una nota de revisión obliga a rehacer un tramo de encofrado.",
    factor: 0.75,
    minutes: 120,
  },
];

export const MAP_W = 1000;
export const MAP_H = 620;
export const STAKE = { x: 168, y: 448 };
