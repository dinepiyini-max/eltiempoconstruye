/** Formas de una partida. El reloj vive en sim.ts; esto solo describe datos. */

export type PageId = "plano" | "obra" | "contratos" | "archivo";
export type Phase = 1 | 2 | 3;
export type Regime = "turno" | "siempre";
export type SaveSlot = "jefe" | "visita";
export type ClockPace = "normal" | "lento" | "pausa";

/** Pendiente hasta que los tres frentes V1 cierran o llega el día de crecida. */
export type FloodStatus = "pendiente" | "a-salvo" | "incumplido";

export const STRUCTURE_IDS = [
  "camino",
  "puente",
  "muro",
  "cimentacion",
  "planta",
  "viaducto",
] as const;

export type StructureId = (typeof STRUCTURE_IDS)[number];

export const V1_CONTRACT_IDS = ["camino", "puente", "muro"] as const;
export type V1ContractId = (typeof V1_CONTRACT_IDS)[number];

export const STAGES = [
  "vacio",
  "levantado",
  "trazado",
  "excavacion",
  "armado",
  "encofrado",
  "estructura",
  "conexion",
] as const;

export type StructureStage = (typeof STAGES)[number];

export const OFICIOS = ["obrero", "capataz", "ingeniero", "topografo"] as const;
export type Oficio = (typeof OFICIOS)[number];

export const PROTO_KIND_IDS = ["casa", "nave", "torre", "muelle", "puente"] as const;
export type ProtoKind = (typeof PROTO_KIND_IDS)[number];

export type FrontId = StructureId | "survey" | "reserva" | "ensayo";

export type Crew = {
  id: string;
  name: string;
  front: FrontId;
  obreros: number;
  capataces: number;
  ingenieros: number;
  topografos: number;
};

export type StructureState = {
  id: StructureId;
  stage: StructureStage;
  progress: number;
  opened: boolean;
  hoursWorked: number;
  costAccrued: number;
  /** Etapa cuyo acero/hormigón ya se cargó al frente. Null = aún no se pagó. */
  paidStage: StructureStage | null;
};

export type Prototype = {
  name: string;
  kind: ProtoKind;
  stage: StructureStage;
  progress: number;
  opened: boolean;
  hoursWorked: number;
  costAccrued: number;
};

export type ContractStatus = "bloqueado" | "disponible" | "activo" | "cumplido";

export type Contract = {
  id: string;
  title: string;
  body: string;
  /** Por qué este frente existe en el valle. */
  purpose: string;
  /** Qué se pierde si la crecida llega antes. */
  threat: string;
  /** Presupuesto de obra (no es peaje al firmar). */
  cost: number;
  durationDays: number;
  difficulty: 1 | 2 | 3;
  requiredKnowledge: number;
  prestigio: number;
  structureId: StructureId;
  status: ContractStatus;
  acceptedDay: number | null;
};

export type ArchivePlate = {
  id: string;
  structureId: StructureId | "ensayo" | "valle";
  name: string;
  completedDay: number;
  completedClock: string;
  materials: string;
  workforce: string;
  method: string;
  cost: number;
  seal?: "a-salvo" | "incumplido" | "tardio";
};

export type EventKind = "lluvia" | "suelo" | "material" | "inspeccion" | "diseno" | "crecida";

export type EventNote = {
  id: string;
  day: number;
  clock: string;
  kind: EventKind;
  title: string;
  body: string;
  minutesLeft: number;
  target: StructureId | "site" | null;
};

export type AbsenceReport = {
  realHours: number;
  line: string;
} | null;

export type LibretaKind = "BUG" | "MEJORA" | "DUDA" | "NOTA";

export type LibretaNote = {
  id: string;
  kind: LibretaKind;
  line: string;
  siteMinutes: number;
  at: number;
  page: PageId;
  front: StructureId | null;
  regime: Regime;
  coords: { x: number; y: number } | null;
};

export type Totals = {
  excavado: number;
  acero: number;
  hormigon: number;
  horasHombre: number;
};

export type Slowdown = {
  target: StructureId | "site";
  minutesLeft: number;
  factor: number;
  kind: EventKind;
};

export type GameState = {
  version: 1;
  page: PageId;
  phase: Phase;
  regime: Regime;
  siteMinutes: number;
  siteRemainder: number;
  realLastSeen: number;
  seed: number;
  survey: number;
  surveying: boolean;
  instruction: "levanta" | "define" | "dirige";
  selected: StructureId | null;
  structures: Record<StructureId, StructureState>;
  crews: Crew[];
  resources: {
    dinero: number;
    horasHombre: number;
    hormigon: number;
    acero: number;
    conocimiento: number;
  };
  prestigio: number;
  fatigue: number;
  contracts: Contract[];
  archive: ArchivePlate[];
  events: EventNote[];
  minutesSinceEvent: number;
  slowdowns: Slowdown[];
  totals: Totals;
  absence: AbsenceReport;
  lastNotice: string | null;
  prototype: Prototype | null;
  cartaRead: boolean;
  libreta: LibretaNote[];
  /** Reloj de la crecida. No es game-over arcade. */
  floodStatus: FloodStatus;
  clockPace: ClockPace;
  libretaOpen: boolean;
  libretaPinned: boolean;
};

export type ObraSnapshot = Omit<GameState, "absence">;
