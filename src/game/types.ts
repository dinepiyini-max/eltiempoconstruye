export type Slot = "jefe" | "visita";
export type Page = "plano" | "obra" | "contratos" | "archivo";
export type ClockPace = "normal" | "lento" | "pausa";
export type Regime = "turno" | "siempre";
export type FloodStatus = "pendiente" | "a-salvo" | "incumplido";
export type Instruction = "levanta" | "define" | "dirige";
export type NoteKind = "BUG" | "MEJORA" | "DUDA" | "NOTA";
export type CrewFront =
  | "reserva"
  | "survey"
  | "ensayo"
  | StructureId;
export type Role = "obrero" | "capataz" | "ingeniero" | "topografo";
export type RolePlural = "obreros" | "capataces" | "ingenieros" | "topografos";
export type EventKind =
  | "lluvia"
  | "suelo"
  | "material"
  | "inspeccion"
  | "diseno"
  | "crecida";
export type ContractStatus = "bloqueado" | "disponible" | "activo" | "cumplido";
export type OrderKind = "hormigon" | "acero";

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
export type Stage = (typeof STAGES)[number];

export const STRUCTURE_IDS = [
  "camino",
  "puente",
  "muro",
  "cimentacion",
  "planta",
  "viaducto",
] as const;
export type StructureId = (typeof STRUCTURE_IDS)[number];

export const PLIEGO_IDS = ["camino", "puente", "muro"] as const;
export type PliegoId = (typeof PLIEGO_IDS)[number];

export type CrewCount = {
  obreros: number;
  capataces: number;
  ingenieros: number;
  topografos: number;
};

export type Crew = CrewCount & {
  id: string;
  name: string;
  front: CrewFront;
};

export type StructureState = {
  id: StructureId;
  stage: Stage;
  progress: number;
  opened: boolean;
  hoursWorked: number;
  costAccrued: number;
  /** Stage whose materials were already taken from the almacén. */
  paidStage: Stage | null;
};

export type Contract = {
  id: string;
  title: string;
  body: string;
  purpose: string;
  threat: string;
  cost: number;
  durationDays: number;
  difficulty: number;
  requiredKnowledge: number;
  prestigio: number;
  structureId: PliegoId;
  status: ContractStatus;
  acceptedDay: number | null;
};

export type SiteEvent = {
  id: string;
  day: number;
  clock: string;
  kind: EventKind;
  title: string;
  body: string;
  minutesLeft: number;
  target: StructureId | "site";
};

export type Slowdown = {
  target: StructureId | "site";
  minutesLeft: number;
  factor: number;
  kind: EventKind;
};

export type ArchivePiece = {
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

export type Note = {
  id: string;
  kind: NoteKind;
  line: string;
  siteMinutes: number;
  at: number;
  page: Page;
  front: StructureId | null;
  regime: Regime;
  coords: { x: number; y: number } | null;
};

export type Prototype = {
  name: string;
  kind: string;
  stage: Stage;
  progress: number;
  opened: boolean;
  hoursWorked: number;
  costAccrued: number;
};

export type Resources = {
  dinero: number;
  horasHombre: number;
  hormigon: number;
  acero: number;
  conocimiento: number;
};

export type Totals = {
  excavado: number;
  acero: number;
  hormigon: number;
  horasHombre: number;
};

export type Absence = { realHours: number; line: string } | null;

export type Game = {
  version: 1;
  page: Page;
  phase: 1 | 2 | 3;
  regime: Regime;
  siteMinutes: number;
  siteRemainder: number;
  realLastSeen: number;
  seed: number;
  survey: number;
  surveying: boolean;
  instruction: Instruction;
  selected: StructureId | null;
  structures: Record<StructureId, StructureState>;
  crews: Crew[];
  resources: Resources;
  prestigio: number;
  fatigue: number;
  contracts: Contract[];
  archive: ArchivePiece[];
  events: SiteEvent[];
  minutesSinceEvent: number;
  slowdowns: Slowdown[];
  totals: Totals;
  absence: Absence;
  lastNotice: string | null;
  prototype: Prototype | null;
  cartaRead: boolean;
  libreta: Note[];
  floodStatus: FloodStatus;
  clockPace: ClockPace;
  libretaOpen: boolean;
  libretaPinned: boolean;
};

export type Bottle =
  | "SIN AUTORIZAR"
  | "SIN CUADRILLA"
  | "FALTA TOPÓGRAFO"
  | "FALTAN OBREROS"
  | "FALTA ACERO"
  | "FALTA HORMIGÓN"
  | "LLUVIA — NO SE VIERTE"
  | "LLUVIA EN ESTE FRENTE"
  | "ARMADO DETENIDO — MATERIAL"
  | "FUERA DE TURNO"
  | "JORNADA EXTRA"
  | "CRECIDA EN EL SITIO";

export type StaffCheck = { ok: boolean; reason: string };

export type Clock = {
  day: number;
  hour: number;
  minute: number;
  label: string;
  short: string;
};
