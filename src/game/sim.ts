import {
  BOTTLE_ACT,
  BOTTLE_HINT,
  CATCHUP_CAP_MS,
  CONTRACT_SPEC,
  COPY,
  EVENT_POOL,
  FLOOD,
  FRONT_LABEL,
  HALT_BOTTLES,
  INITIAL_CONTRACTS,
  INITIAL_CREWS,
  ORDER,
  ROLE_PLURAL,
  STAGE_LABEL,
  STAGE_NEXT,
  STRUCTURES,
  STRUCT_NAME,
  WAGE,
} from "./catalog.ts";
import {
  STAGES,
  STRUCTURE_IDS,
  type ArchivePiece,
  type Bottle,
  type Clock,
  type ClockPace,
  type Contract,
  type Crew,
  type CrewCount,
  type CrewFront,
  type FloodStatus,
  type Game,
  type Note,
  type OrderKind,
  type Page,
  type PliegoId,
  PLIEGO_IDS,
  type Role,
  type RolePlural,
  type Slowdown,
  type StaffCheck,
  type Stage,
  type StructureId,
  type StructureState,
} from "./types.ts";

const DAY = 1440;

export function emptyStructure(id: StructureId): StructureState {
  return {
    id,
    stage: "vacio",
    progress: 0,
    opened: false,
    hoursWorked: 0,
    costAccrued: 0,
    paidStage: null,
  };
}

export function newGame(now = Date.now()): Game {
  const structures = {} as Game["structures"];
  for (const id of STRUCTURE_IDS) structures[id] = emptyStructure(id);
  return {
    version: 1,
    page: "plano",
    phase: 1,
    regime: "turno",
    siteMinutes: 420,
    siteRemainder: 0,
    realLastSeen: now,
    seed: 1729,
    survey: 0,
    surveying: false,
    instruction: "levanta",
    selected: null,
    structures,
    crews: INITIAL_CREWS.map((c) => ({ ...c })),
    resources: {
      dinero: 620_000,
      horasHombre: 2400,
      hormigon: 28,
      acero: 74,
      conocimiento: 4,
    },
    prestigio: 0,
    fatigue: 0,
    contracts: INITIAL_CONTRACTS.map((c) => ({ ...c })),
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

export function stageIndex(s: Stage): number {
  return STAGES.indexOf(s);
}

export function nextStage(s: Stage): Stage | null {
  const i = stageIndex(s);
  if (i < 0 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1] ?? null;
}

export function isPliego(id: StructureId): id is PliegoId {
  return (PLIEGO_IDS as readonly string[]).includes(id);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function clockOf(minutes: number): Clock {
  const t = Math.max(0, Math.floor(minutes));
  const day = Math.floor(t / DAY) + 1;
  const rem = t % DAY;
  const hour = Math.floor(rem / 60);
  const minute = rem % 60;
  return {
    day,
    hour,
    minute,
    label: `DÍA ${pad2(day)}  ·  ${pad2(hour)}:${pad2(minute)}`,
    short: `${pad2(hour)}:${pad2(minute)}`,
  };
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

/** Single flood counter. Same N everywhere it is allowed to appear. */
export function floodLine(game: Game): string {
  if (game.floodStatus === "a-salvo") return "OBRA A SALVO";
  if (game.floodStatus === "incumplido") return "PLAZO INCUMPLIDO";
  const left = Math.max(0, FLOOD.day - clockOf(game.siteMinutes).day);
  if (left === 0) return `${FLOOD.label} · hoy`;
  return `${FLOOD.label} · faltan ${left} ${left === 1 ? "día" : "días"}`;
}

export function daysToFlood(game: Game): number {
  return FLOOD.day - clockOf(game.siteMinutes).day;
}

export function hourOf(minutes: number): number {
  return Math.floor((minutes % DAY) / 60);
}

function crossedHour(from: number, dt: number, hour: number): boolean {
  const target = Math.floor(from / DAY) * DAY + hour * 60;
  return from < target && from + dt >= target;
}

export function inShift(game: Game): boolean {
  if (game.regime === "siempre") return true;
  const h = hourOf(game.siteMinutes);
  return h >= 7 && h < 18;
}

export function shiftFactor(game: Game): number {
  const h = hourOf(game.siteMinutes);
  if (h < 7 || h >= 18) return game.regime === "turno" ? 0.08 : 0.72;
  return 1;
}

export function crewsAt(game: Game, front: CrewFront): Crew[] {
  return game.crews.filter((c) => c.front === front);
}

export function crewHeadcount(c: CrewCount): number {
  return c.obreros + c.capataces + c.ingenieros + c.topografos;
}

export function crewAt(game: Game, front: CrewFront): CrewCount {
  return crewsAt(game, front).reduce(
    (acc, c) => ({
      obreros: acc.obreros + c.obreros,
      capataces: acc.capataces + c.capataces,
      ingenieros: acc.ingenieros + c.ingenieros,
      topografos: acc.topografos + c.topografos,
    }),
    { obreros: 0, capataces: 0, ingenieros: 0, topografos: 0 },
  );
}

export function reserve(game: Game): CrewCount {
  return crewAt(game, "reserva");
}

export function outputOf(c: CrewCount, kind: "survey" | "build"): number {
  if (kind === "survey") {
    return c.topografos * 0.2 + c.obreros * 0.03 + c.ingenieros * 0.06;
  }
  const cap = 1 + 0.16 * Math.min(c.capataces, Math.max(1, Math.ceil(c.obreros / 8)));
  let r = c.obreros * 1 * cap;
  if (c.ingenieros > 0) r *= 1 + 0.12 * Math.min(c.ingenieros, 2);
  return r;
}

export function slowdownsAt(game: Game, target: CrewFront | "site"): Slowdown[] {
  return game.slowdowns.filter(
    (s) => s.minutesLeft > 0 && s.target === target,
  );
}

export function pliegoDone(game: Game): boolean {
  return PLIEGO_IDS.every((id) => game.structures[id].stage === "conexion");
}

export function frontDue(game: Game, c: Contract): {
  remaining: number;
  late: boolean;
  dueDay: number | null;
} {
  if (c.status !== "activo" || c.acceptedDay == null) {
    return { remaining: c.durationDays, late: false, dueDay: null };
  }
  const day = clockOf(game.siteMinutes).day;
  const due = c.acceptedDay + c.durationDays;
  return { remaining: due - day, late: day > due, dueDay: due };
}

export function whereFront(front: CrewFront): string {
  if (front === "reserva") return "en disponibles";
  if (front === "survey") return "en levantamiento";
  if (front === "ensayo") return "en ensayo";
  return `en frente ${FRONT_LABEL[front]}`;
}

export function rateAt(game: Game, front: CrewFront): number {
  let n = outputOf(crewAt(game, front), front === "survey" ? "survey" : "build") / 9.4;
  n *= 1 - game.fatigue * 0.42;
  n *= shiftFactor(game);
  if (game.regime === "siempre") n *= 1.1;
  for (const s of slowdownsAt(game, front)) {
    if (s.kind !== "material") n *= s.factor;
  }
  if (game.resources.horasHombre <= 0) n *= 0.55;
  if (game.floodStatus === "incumplido") n *= 0.62;
  return Math.max(0, n);
}

export function rateWord(n: number): string {
  if (n <= 0.02) return "DETENIDA";
  if (n < 0.35) return "BAJA";
  if (n < 0.75) return "MEDIA";
  if (n < 1.15) return "ALTA";
  return "MUY ALTA";
}

export function rateLine(game: Game, id: StructureId): string {
  const w = rateWord(rateAt(game, id));
  const b = bottle(game, id);
  return (w === "BAJA" || w === "DETENIDA") && b ? `${w} · ${b}` : w;
}

export function stageNeed(
  id: StructureId,
  stage: Stage,
): { acero: number; hormigon: number } {
  const d = STRUCTURES[id];
  return { acero: d.steel[stage] ?? 0, hormigon: d.concrete[stage] ?? 0 };
}

/** Materials already taken for this stage — inventory may be 0 and that is not FALTA. */
export function materialsPaid(s: StructureState): boolean {
  return s.paidStage === s.stage;
}

export function bottle(game: Game, id: StructureId): Bottle | null {
  const n = game.structures[id];
  if (!n.opened) return "SIN AUTORIZAR";
  if (n.stage === "conexion") return null;
  const r = crewAt(game, id);
  if (crewHeadcount(r) === 0) return "SIN CUADRILLA";
  if ((n.stage === "levantado" || n.stage === "trazado") && r.topografos < 1) {
    return "FALTA TOPÓGRAFO";
  }
  if (r.obreros < 1) return "FALTAN OBREROS";

  const need = stageNeed(id, n.stage);
  const paid = materialsPaid(n);
  // Fe: if the almacén has the material, never say FALTA.
  // Fe: if this stage already paid, never say FALTA (stock was consumed).
  if (!paid && need.acero > 0 && game.resources.acero < need.acero) {
    return "FALTA ACERO";
  }
  if (!paid && need.hormigon > 0 && game.resources.hormigon < need.hormigon) {
    return "FALTA HORMIGÓN";
  }

  const slows = slowdownsAt(game, id);
  const rain = slows.find((s) => s.kind === "lluvia");
  if (rain && (n.stage === "estructura" || n.stage === "encofrado")) {
    return "LLUVIA — NO SE VIERTE";
  }
  if (rain) return "LLUVIA EN ESTE FRENTE";
  const mat = slows.find((s) => s.kind === "material");
  if (
    mat &&
    n.stage === "armado" &&
    !paid &&
    game.resources.acero < Math.max(1, need.acero)
  ) {
    return "ARMADO DETENIDO — MATERIAL";
  }
  if (game.regime === "turno" && !inShift(game)) return "FUERA DE TURNO";
  if (game.resources.horasHombre <= 0) return "JORNADA EXTRA";
  if (game.floodStatus === "incumplido") return "CRECIDA EN EL SITIO";
  return null;
}

export function bottleHint(b: Bottle | null): string | null {
  return b ? (BOTTLE_HINT[b] ?? null) : null;
}

export function bottleAct(b: Bottle | null): string | null {
  return b ? (BOTTLE_ACT[b] ?? null) : null;
}

export function needsStaff(game: Game, id: StructureId): boolean {
  const b = bottle(game, id);
  return b === "SIN CUADRILLA" || b === "FALTA TOPÓGRAFO" || b === "FALTAN OBREROS";
}

/** Assign button: disabled + one-line reason when nobody is in reserva. */
export function staffCheck(game: Game, id: StructureId): StaffCheck {
  if (!game.structures[id]?.opened) {
    return { ok: false, reason: "Autoriza el frente primero." };
  }
  const b = bottle(game, id);
  const r = reserve(game);
  const n = crewHeadcount(r);
  if (b === "FALTA TOPÓGRAFO" && r.topografos < 1) {
    return {
      ok: false,
      reason: "Sin topógrafo en reserva · quita uno de otro frente en OBRA",
    };
  }
  if (b === "FALTAN OBREROS" && r.obreros < 1) {
    return {
      ok: false,
      reason: "Sin obreros en reserva · quita de otro frente en OBRA",
    };
  }
  if (b === "SIN CUADRILLA" && n < 1) {
    return {
      ok: false,
      reason: "Disponibles vacíos · mueve una cuadrilla en OBRA",
    };
  }
  if (needsStaff(game, id)) {
    if (n < 1 && !game.crews.some((c) => c.front === id)) {
      return {
        ok: false,
        reason: "Sin personal en reserva · quita de otro frente en OBRA",
      };
    }
    return { ok: true, reason: "" };
  }
  return { ok: false, reason: "Este frente ya tiene gente." };
}

export function contractOf(game: Game, id: StructureId): Contract | undefined {
  return game.contracts.find((c) => c.structureId === id);
}

export function gateOf(game: Game, id: StructureId): string | null {
  if (game.survey < 1) return "Sin levantamiento";
  const d = STRUCTURES[id];
  if (game.resources.conocimiento < d.knowledgeMin) {
    return `Falta conocimiento (${d.knowledgeMin})`;
  }
  for (const [dep, st] of Object.entries(d.requires) as [StructureId, Stage][]) {
    const s = game.structures[dep];
    if (stageIndex(s.stage) < stageIndex(st)) {
      return `Requiere ${STRUCT_NAME[dep].toLowerCase()} en ${st}`;
    }
  }
  return null;
}

export function gateHint(g: string | null): string | null {
  if (!g) return null;
  if (g === "Sin levantamiento") {
    return "El pliego pide reconocer el valle antes de fundar. Sella LEVANTA EL TERRENO.";
  }
  if (g.startsWith("Falta conocimiento")) {
    return "El conocimiento se gana levantando el terreno, con ingenieros en un frente y al terminar una pieza. No se compra.";
  }
  if (g.startsWith("Requiere")) {
    return "El valle se construye en orden. Primero avanza la pieza de la que esta depende.";
  }
  return null;
}

export function refreshContracts(game: Game): void {
  for (const c of game.contracts) {
    if (c.status === "activo" || c.status === "cumplido") continue;
    c.requiredKnowledge = STRUCTURES[c.structureId].knowledgeMin;
    c.status = gateOf(game, c.structureId) ? "bloqueado" : "disponible";
  }
}

export function wageOf(game: Game, c: CrewCount): number {
  let n =
    c.obreros * WAGE.obrero +
    c.capataces * WAGE.capataz +
    c.ingenieros * WAGE.ingeniero +
    c.topografos * WAGE.topografo;
  if (game.regime === "siempre") n *= 1.55;
  if (game.resources.horasHombre <= 0) n *= 1.7;
  return n;
}

function rng(game: Game): number {
  game.seed = (Math.imul(game.seed, 1664525) + 1013904223) >>> 0;
  return game.seed / 4294967296;
}

function payStage(game: Game, id: StructureId, stage: Stage): boolean {
  const need = stageNeed(id, stage);
  if (game.resources.acero < need.acero || game.resources.hormigon < need.hormigon) {
    return false;
  }
  game.resources.acero -= need.acero;
  game.resources.hormigon -= need.hormigon;
  game.totals.acero += need.acero;
  game.totals.hormigon += need.hormigon;
  const s = game.structures[id];
  s.paidStage = stage;
  if (s.progress < 0.021) s.progress = 0.021;
  return true;
}

function archivePiece(game: Game, piece: Omit<ArchivePiece, "id" | "completedDay" | "completedClock">): void {
  const t = clockOf(game.siteMinutes);
  game.archive.push({
    id: `A-${pad2(game.archive.length + 1)}`,
    completedDay: t.day,
    completedClock: t.label,
    ...piece,
  });
}

function floodEvent(game: Game, title: string, body: string): void {
  const t = clockOf(game.siteMinutes);
  game.events.unshift({
    id: `crecida-${game.siteMinutes}-${game.seed}`,
    day: t.day,
    clock: t.short,
    kind: "crecida",
    title,
    body,
    minutesLeft: 2160,
    target: "site",
  });
  game.events = game.events.slice(0, 14);
}

export function resolveFlood(game: Game, why: "day" | "complete"): void {
  if (game.floodStatus !== "pendiente") return;
  const done = pliegoDone(game);
  const day = clockOf(game.siteMinutes).day;
  if (done && day <= FLOOD.day) {
    game.floodStatus = "a-salvo";
    game.lastNotice = "OBRA A SALVO. El pliego se cumplió antes de la crecida.";
    floodEvent(
      game,
      "OBRA A SALVO",
      "Los tres frentes del pliego están conectados. La Q50 no se lleva el valle.",
    );
    if (!game.archive.some((a) => a.structureId === "valle")) {
      archivePiece(game, {
        structureId: "valle",
        name: "Valle del Yuna",
        materials: `${Math.round(game.totals.hormigon)} m³ hormigón · ${Math.round(game.totals.acero)} t acero`,
        workforce: `${Math.round(game.totals.horasHombre)} h-h`,
        method: "Pliego cumplido. Terraza unida al cerro norte.",
        cost: Math.round(620_000 - game.resources.dinero),
        seal: "a-salvo",
      });
    }
    return;
  }
  if (why === "day" && day >= FLOOD.day) {
    game.floodStatus = done ? "a-salvo" : "incumplido";
    if (game.floodStatus === "a-salvo") {
      game.lastNotice = "Llegó la crecida. El valle estaba a salvo.";
      floodEvent(
        game,
        "CRECIDA Q50",
        "Llegó la crecida. Los tres frentes ya estaban conectados.",
      );
    } else {
      game.lastNotice = "Llegó la crecida. PLAZO INCUMPLIDO.";
      floodEvent(
        game,
        "PLAZO INCUMPLIDO",
        "La Q50 entra al valle. El ritmo baja. Las piezas que falten aún se pueden archivar — tarde.",
      );
      if (!game.archive.some((a) => a.structureId === "valle")) {
        archivePiece(game, {
          structureId: "valle",
          name: "Valle del Yuna",
          materials: `${Math.round(game.totals.hormigon)} m³ hormigón · ${Math.round(game.totals.acero)} t acero`,
          workforce: `${Math.round(game.totals.horasHombre)} h-h`,
          method: "Plazo incumplido. La crecida llegó antes que el pliego.",
          cost: Math.round(620_000 - game.resources.dinero),
          seal: "incumplido",
        });
      }
    }
  }
}

function finishStructure(game: Game, id: StructureId): void {
  const n = game.structures[id];
  n.stage = "conexion";
  n.progress = 1;
  n.paidStage = "conexion";
  const d = STRUCTURES[id];
  const c = contractOf(game, id);
  const late = c ? frontDue(game, c).late : false;
  if (c && c.status !== "cumplido") {
    c.status = "cumplido";
    game.prestigio += late ? Math.ceil(c.prestigio / 2) : c.prestigio;
  }
  game.resources.conocimiento += 8 + (c?.difficulty ?? 1) * 3;
  if (!game.archive.some((a) => a.structureId === id)) {
    const crew = crewsAt(game, id)[0];
    const steel = Object.values(d.steel).reduce((a, b) => a + (b ?? 0), 0);
    archivePiece(game, {
      structureId: id,
      name: STRUCT_NAME[id],
      materials: `${d.concrete.estructura ?? 0} m³ hormigón · ${steel} t acero`,
      workforce: crew
        ? `${crew.name} · ${Math.round(n.hoursWorked)} h-h`
        : `${Math.round(n.hoursWorked)} h-h`,
      method: d.method,
      cost: Math.round(n.costAccrued),
      seal: late ? "tardio" : undefined,
    });
  }
  game.lastNotice = late ? `${STRUCT_NAME[id]} al archivo — tarde.` : COPY.archivo;
  if (
    game.phase < 2 &&
    (id === "camino" ||
      STRUCTURE_IDS.filter((s) => stageIndex(game.structures[s].stage) >= 3)
        .length >= 2)
  ) {
    game.phase = 2;
  }
  if (
    game.phase < 3 &&
    (id === "planta" || id === "viaducto" || game.archive.length >= 3)
  ) {
    game.phase = 3;
  }
  refreshContracts(game);
  if (pliegoDone(game)) resolveFlood(game, "complete");
}

function workFront(game: Game, id: StructureId, hours: number): void {
  const s = game.structures[id];
  if (!s.opened || s.stage === "conexion") return;
  const b = bottle(game, id);
  if (b && HALT_BOTTLES.has(b)) return;
  const people = crewAt(game, id);
  const rate = rateAt(game, id);
  if (rate <= 0.01) return;
  const d = STRUCTURES[id];
  const needH = d.stageHours[s.stage] ?? 4;
  const need = stageNeed(id, s.stage);
  if ((need.acero > 0 || need.hormigon > 0) && !materialsPaid(s)) {
    if (!payStage(game, id, s.stage)) return;
  }
  const work = hours * rate;
  s.progress += work / needH;
  s.hoursWorked += work;
  const pay = wageOf(game, people) * hours;
  s.costAccrued += pay;
  game.resources.dinero = Math.max(0, game.resources.dinero - pay);
  const heads = crewHeadcount(people);
  game.resources.horasHombre = Math.max(0, game.resources.horasHombre - heads * hours);
  game.totals.horasHombre += heads * hours;
  game.resources.conocimiento += people.ingenieros * 0.08 * hours;
  const dig = d.excavate[s.stage] ?? 0;
  if (dig > 0) game.totals.excavado += (dig * work) / needH;
  while (s.progress >= 1) {
    const nx = nextStage(s.stage);
    if (!nx || nx === "conexion") {
      finishStructure(game, id);
      break;
    }
    s.stage = nx;
    s.progress -= 1;
    if (s.progress < 0) s.progress = 0;
    s.paidStage = null;
    if (game.phase < 2 && stageIndex(s.stage) >= 4) game.phase = 2;
    if (
      game.phase < 3 &&
      (id === "planta" || id === "viaducto") &&
      stageIndex(s.stage) >= 5
    ) {
      game.phase = 3;
    }
  }
}

function tickSurvey(game: Game, hours: number): void {
  if (game.survey >= 1 || !game.surveying) return;
  game.survey = Math.min(1, game.survey + hours * 4);
  const c = crewAt(game, "survey");
  const n = crewHeadcount(c);
  if (n > 0) {
    game.resources.horasHombre = Math.max(0, game.resources.horasHombre - n * hours);
    game.totals.horasHombre += n * hours;
    game.resources.dinero = Math.max(0, game.resources.dinero - wageOf(game, c) * hours);
  }
  if (game.survey >= 1) {
    game.survey = 1;
    game.surveying = false;
    if (game.instruction === "levanta") game.instruction = "define";
    game.resources.conocimiento += 6;
    for (const cr of game.crews) if (cr.front === "survey") cr.front = "reserva";
    refreshContracts(game);
    game.lastNotice = COPY.define;
  }
}

function tickPlant(game: Game, hours: number): void {
  const p = game.structures.planta;
  if (stageIndex(p.stage) < stageIndex("estructura")) return;
  if (
    game.slowdowns.some(
      (s) => s.minutesLeft > 0 && s.kind === "lluvia" && s.target === "planta",
    )
  ) {
    return;
  }
  const f = shiftFactor(game) * (game.regime === "siempre" ? 1.15 : 1);
  game.resources.hormigon += 2.4 * hours * f;
}

function tickSlow(game: Game, minutes: number): void {
  for (const s of game.slowdowns) s.minutesLeft -= minutes;
  game.slowdowns = game.slowdowns.filter((s) => s.minutesLeft > 0);
  for (const e of game.events) if (e.minutesLeft > 0) e.minutesLeft -= minutes;
}

function maybeEvent(game: Game): boolean {
  if (game.survey < 0.35 || game.events.filter((e) => e.minutesLeft > 0).length >= 2) {
    return false;
  }
  const p = game.regime === "siempre" ? 0.58 : 0.3;
  if (rng(game) > p) {
    game.minutesSinceEvent = 40 + rng(game) * 80;
    return false;
  }
  let pool = EVENT_POOL;
  if (game.regime === "siempre") {
    const insp = EVENT_POOL.find((e) => e.kind === "inspeccion");
    if (insp) pool = [...EVENT_POOL, insp, insp];
  }
  const ev = pool[Math.floor(rng(game) * pool.length)]!;
  const t = clockOf(game.siteMinutes);
  const open = STRUCTURE_IDS.filter(
    (id) => game.structures[id].opened && game.structures[id].stage !== "conexion",
  );
  let target: StructureId | "site";
  if (
    ev.kind === "lluvia" ||
    ev.kind === "material" ||
    ev.kind === "suelo" ||
    ev.kind === "diseno"
  ) {
    if (!open.length) return false;
    target = open[Math.floor(rng(game) * open.length)]!;
  } else {
    target =
      open.length && rng(game) > 0.35
        ? open[Math.floor(rng(game) * open.length)]!
        : "site";
  }
  game.events.unshift({
    id: `n-${game.siteMinutes}-${game.seed}`,
    day: t.day,
    clock: t.short,
    kind: ev.kind,
    title: ev.title,
    body: ev.body,
    minutesLeft: ev.minutes,
    target,
  });
  game.events = game.events.slice(0, 14);
  if (ev.kind === "material") {
    game.resources.acero = Math.max(0, game.resources.acero - (6 + rng(game) * 8));
  }
  if (ev.kind === "diseno" && target !== "site") {
    const s = game.structures[target];
    s.progress = Math.max(0, s.progress - 0.22);
  }
  if (ev.kind === "inspeccion" && game.regime === "siempre") {
    game.resources.dinero = Math.max(0, game.resources.dinero - 4200);
  }
  game.slowdowns.push({
    target,
    minutesLeft: ev.minutes,
    factor: ev.factor,
    kind: ev.kind,
  });
  game.minutesSinceEvent = 0;
  return true;
}

function tickFatigue(game: Game, minutes: number): void {
  game.fatigue =
    game.regime === "siempre"
      ? Math.min(0.82, game.fatigue + 0.00018 * minutes)
      : Math.max(0, game.fatigue - 0.00028 * minutes);
}

export function tickMinutes(game: Game, minutes: number): void {
  const from = game.siteMinutes;
  game.siteMinutes += minutes;
  if (crossedHour(from, minutes, 7)) {
    game.resources.horasHombre += game.regime === "turno" ? 110 : 70;
  }
  tickFatigue(game, minutes);
  tickSlow(game, minutes);
  const hours = minutes / 60;
  tickSurvey(game, hours);
  for (const id of STRUCTURE_IDS) workFront(game, id, hours);
  tickPlant(game, hours);
  refreshContracts(game);
  if (game.phase < 2 && game.survey >= 1 && game.structures.camino.opened) {
    game.phase = 2;
  }
  if (game.phase < 3 && game.structures.planta.stage === "conexion") {
    game.phase = 3;
  }
  resolveFlood(game, "day");
}

export function advanceMinutes(
  game: Game,
  minutes: number,
  opts?: { eventBudget?: number },
): void {
  if (minutes <= 0) return;
  const budget = opts?.eventBudget ?? 99;
  let used = 0;
  const step = minutes > 900 ? 15 : minutes > 240 ? 5 : 1;
  let left = minutes;
  while (left > 0) {
    const n = Math.min(step, left);
    left -= n;
    tickMinutes(game, n);
    game.minutesSinceEvent += n;
    const wait = game.regime === "siempre" ? 110 : 220;
    if (used < budget && game.minutesSinceEvent > wait) {
      if (maybeEvent(game)) used += 1;
      else game.minutesSinceEvent = wait * 0.4;
    }
  }
}

function absenceLine(
  deltas: { name: string; delta: string }[],
  dayChanged: boolean,
  from: number,
  to: number,
): string {
  const i = deltas[0];
  if (i?.delta === "incumplido") return "Llegó la crecida. Plazo incumplido.";
  if (i?.delta === "a-salvo") return "El valle quedó a salvo.";
  if (i?.delta === "archivo") return `${i.name} entró al archivo.`;
  if (i?.delta === "noche") return "Noche. El turno esperó.";
  if (i?.name === "Yuna") return "El Yuna siguió.";
  if (i && (i.delta === "sin hormigón" || i.delta === "sin acero")) {
    return `${i.name} ${i.delta}.`;
  }
  if (i?.delta === "avanzó") return `Sin ti: ${i.name} avanzó.`;
  if (i) return `Sin ti: ${i.name} en ${i.delta}.`;
  return dayChanged ? `Día ${from} al ${to}.` : "El Yuna siguió.";
}

export function catchUp(game: Game, now: number): Game {
  if (game.clockPace === "pausa") {
    game.realLastSeen = now;
    game.absence = null;
    return game;
  }
  const dt = Math.min(Math.max(0, now - game.realLastSeen), CATCHUP_CAP_MS);
  game.realLastSeen = now;
  if (dt < 12_000) {
    game.absence = null;
    return game;
  }
  const pace = game.clockPace === "lento" ? 0.25 : 1;
  const snap = {
    stages: Object.fromEntries(
      STRUCTURE_IDS.map((id) => [
        id,
        { stage: game.structures[id].stage, p: game.structures[id].progress },
      ]),
    ) as Record<StructureId, { stage: Stage; p: number }>,
    day: clockOf(game.siteMinutes).day,
    flood: game.floodStatus,
  };
  advanceMinutes(game, (dt / 1000) * 8 * pace, {
    eventBudget: dt > 300_000 ? 2 : 0,
  });
  const day = clockOf(game.siteMinutes).day;
  const deltas = STRUCTURE_IDS.map((id) => {
    const a = snap.stages[id];
    const b = game.structures[id];
    if (b.stage === "conexion" && a.stage !== "conexion") {
      return { name: STRUCT_NAME[id], delta: "archivo" };
    }
    if (a.stage === b.stage) {
      if (b.progress - a.p <= 0.08) return null;
      return { name: STRUCT_NAME[id], delta: "avanzó" };
    }
    return { name: STRUCT_NAME[id], delta: STAGE_LABEL[b.stage] };
  }).filter((x): x is { name: string; delta: string } => !!x);
  if (snap.flood === "pendiente" && game.floodStatus === "incumplido") {
    deltas.unshift({ name: "Crecida", delta: "incumplido" });
  } else if (snap.flood === "pendiente" && game.floodStatus === "a-salvo") {
    deltas.unshift({ name: "Crecida", delta: "a-salvo" });
  }
  if (!deltas.length) {
    const stuck = STRUCTURE_IDS.find((id) => {
      const b = bottle(game, id);
      return (
        b === "FALTA HORMIGÓN" ||
        b === "FALTA ACERO" ||
        b === "SIN CUADRILLA" ||
        b === "FALTA TOPÓGRAFO"
      );
    });
    const b = stuck ? bottle(game, stuck) : null;
    if (b === "FALTA HORMIGÓN") {
      deltas.push({ name: STRUCT_NAME[stuck!], delta: "sin hormigón" });
    } else if (b === "FALTA ACERO") {
      deltas.push({ name: STRUCT_NAME[stuck!], delta: "sin acero" });
    } else if (game.regime === "turno" && !inShift(game)) {
      deltas.push({ name: "Régimen", delta: "noche" });
    } else {
      deltas.push({ name: "Yuna", delta: day > snap.day ? "siguió" : "esperó" });
    }
  }
  game.absence =
    dt > 90_000
      ? {
          realHours: dt / 3_600_000,
          line: absenceLine(deltas, day > snap.day, snap.day, day),
        }
      : null;
  return game;
}

export function clockMultiplier(game: Game, noteFocus: boolean): number {
  if (noteFocus || game.clockPace === "pausa") return 0;
  if (game.clockPace === "lento") return 0.25;
  return 1;
}

/** UI-only. Changing sheets must not spend site minutes. */
export function setPage(game: Game, page: Page): void {
  game.page = page;
  if (game.libretaPinned) game.libretaOpen = true;
}

export function startSurvey(game: Game): void {
  if (game.survey >= 1) return;
  game.surveying = true;
  const c = game.crews.find(
    (c) => c.topografos > 0 && (c.front === "reserva" || c.front === "survey"),
  );
  if (c) c.front = "survey";
}

export function assignCrew(
  game: Game,
  crewId: string,
  front: CrewFront,
): { ok: boolean; reason?: string } {
  const c = game.crews.find((x) => x.id === crewId);
  if (!c) return { ok: false, reason: "Cuadrilla no existe" };
  if (front === "ensayo") {
    if (!game.prototype?.opened || game.prototype.stage === "conexion") {
      game.lastNotice = "No hay ensayo abierto.";
      return { ok: false, reason: game.lastNotice };
    }
  } else if (front !== "reserva" && front !== "survey" && !game.structures[front as StructureId]?.opened) {
    game.lastNotice = "Ese frente aún no está autorizado.";
    return { ok: false, reason: game.lastNotice };
  }
  c.front = front;
  game.lastNotice = `${c.name} ${whereFront(front)}.`;
  return { ok: true };
}

export function shiftRole(
  game: Game,
  crewId: string,
  role: Role,
  dir: number,
): void {
  const c = game.crews.find((x) => x.id === crewId);
  if (!c) return;
  const key = ROLE_PLURAL[role];
  const other =
    game.crews.find((x) => x.id !== crewId && x.front === "reserva") ??
    game.crews.find((x) => x.id !== crewId);
  if (!other) {
    game.lastNotice = "No hay reserva a la que devolver.";
    return;
  }
  if (dir < 0) {
    if (c[key] < 1) {
      game.lastNotice = "Nada que quitar.";
      return;
    }
    const lastTopo =
      role === "topografo" &&
      c.front !== "reserva" &&
      c.front !== "survey" &&
      c.topografos === 1 &&
      (game.structures[c.front as StructureId]?.stage === "levantado" ||
        game.structures[c.front as StructureId]?.stage === "trazado");
    const lastObr =
      role === "obrero" &&
      c.front !== "reserva" &&
      c.front !== "survey" &&
      c.obreros === 1;
    c[key] -= 1;
    other[key] += 1;
    game.lastNotice = lastTopo || lastObr ? "Este frente quedará detenido." : null;
    return;
  }
  if (other[key] < 1) {
    game.lastNotice = "Nada en disponibles.";
    return;
  }
  other[key] -= 1;
  c[key] += 1;
}

function takeFromReserve(
  game: Game,
  dest: Crew,
  key: RolePlural,
  want: number,
): number {
  let left = want;
  for (const c of game.crews) {
    if (c.id === dest.id || c.front !== "reserva") continue;
    const n = Math.min(left, c[key]);
    c[key] -= n;
    dest[key] += n;
    left -= n;
    if (left <= 0) break;
  }
  return want - left;
}

export function staffFront(
  game: Game,
  id: StructureId,
): { ok: boolean; reason: string } {
  const chk = staffCheck(game, id);
  if (!chk.ok) {
    game.lastNotice = chk.reason;
    return chk;
  }
  let crew = game.crews.find((c) => c.front === id);
  if (!crew) {
    crew = game.crews.find((c) => c.front === "reserva" && crewHeadcount(c) > 0);
    if (crew) crew.front = id;
  }
  if (!crew) {
    game.lastNotice = "No hay cuadrilla en disponibles.";
    return { ok: false, reason: game.lastNotice };
  }
  if (crew.topografos < 1) takeFromReserve(game, crew, "topografos", 1);
  if (crew.capataces < 1) takeFromReserve(game, crew, "capataces", 1);
  if (crew.obreros < 4) takeFromReserve(game, crew, "obreros", 4 - crew.obreros);
  const at = crewAt(game, id);
  if (at.obreros + at.topografos + at.capataces === 0) {
    game.lastNotice = "Disponibles vacíos.";
    return { ok: false, reason: game.lastNotice };
  }
  game.lastNotice = `${crew.name} ${whereFront(id)}.`;
  return { ok: true, reason: "" };
}

function autoStaff(game: Game, id: StructureId): void {
  const c =
    game.crews.find((x) => x.front === "reserva" && x.obreros >= 4) ??
    game.crews.find((x) => x.front === "reserva" && crewHeadcount(x) > 0);
  if (!c) {
    game.lastNotice = "Sin personal en reserva.";
    return;
  }
  c.front = id;
  if (c.topografos < 1) takeFromReserve(game, c, "topografos", 1);
  if (c.capataces < 1) takeFromReserve(game, c, "capataces", 1);
  if (c.obreros < 4) takeFromReserve(game, c, "obreros", 4 - c.obreros);
}

export function openFront(game: Game, id: StructureId): void {
  const s = game.structures[id];
  if (s.opened) {
    game.selected = id;
    return;
  }
  s.opened = true;
  s.stage = game.survey >= 1 ? "levantado" : "vacio";
  s.progress = 0;
  s.paidStage = null;
  autoStaff(game, id);
  game.selected = id;
  if (game.instruction === "define" || game.instruction === "levanta") {
    game.instruction = "dirige";
  }
  if (game.phase < 2 && (id === "camino" || isPliego(id))) game.phase = 2;
  refreshContracts(game);
}

export function signFirst(
  game: Game,
  id: StructureId,
): { ok: boolean; reason?: string } {
  if (game.survey < 1) return { ok: false, reason: "Sin levantar" };
  if (!isPliego(id)) return { ok: false, reason: "Fuera de pliego" };
  if (game.structures[id].opened) {
    game.selected = id;
    game.instruction = "dirige";
    return { ok: true };
  }
  const c = game.contracts.find((x) => x.structureId === id);
  if (c && c.status !== "cumplido" && c.status !== "activo") {
    c.status = "activo";
    c.acceptedDay = clockOf(game.siteMinutes).day;
  }
  openFront(game, id);
  game.instruction = "dirige";
  game.lastNotice = COPY.after;
  return { ok: true };
}

export function acceptContract(
  game: Game,
  cid: string,
): { ok: boolean; reason?: string } {
  const c = game.contracts.find((x) => x.id === cid);
  if (!c) return { ok: false, reason: "No existe" };
  return signFirst(game, c.structureId);
}

export function toggleRegime(game: Game): void {
  game.regime = game.regime === "turno" ? "siempre" : "turno";
  game.lastNotice =
    game.regime === "siempre"
      ? game.fatigue > 0.28
        ? COPY.forzada
        : "SIEMPRE ABIERTA. Noche de pago. El plazo aprieta."
      : "TURNO DE OBRA 07–18. De noche la obra espera.";
}

export function cycleFront(game: Game, crewId: string): void {
  const c = game.crews.find((x) => x.id === crewId);
  if (!c) return;
  const opts: CrewFront[] = [
    "reserva",
    ...STRUCTURE_IDS.filter((id) => game.structures[id].opened),
  ];
  if (game.prototype?.opened && game.prototype.stage !== "conexion") {
    opts.push("ensayo");
  }
  const i = opts.indexOf(c.front);
  assignCrew(game, crewId, opts[(i + 1) % opts.length] ?? "reserva");
}

export function orderMaterial(
  game: Game,
  kind: OrderKind,
): { ok: boolean; reason?: string } {
  const spec = ORDER[kind];
  if (game.resources.dinero < spec.cost) {
    game.lastNotice = `Fondos insuficientes para el ${spec.noun} (${spec.cost}).`;
    return { ok: false, reason: game.lastNotice };
  }
  game.resources.dinero -= spec.cost;
  if (kind === "hormigon") game.resources.hormigon += spec.qty;
  else game.resources.acero += spec.qty;
  if (kind === "acero") {
    game.slowdowns = game.slowdowns.filter((s) => {
      if (s.kind !== "material") return true;
      if (s.target === "site") return false;
      const st = game.structures[s.target];
      if (!st) return false;
      const need = stageNeed(s.target, st.stage);
      return game.resources.acero < Math.max(1, need.acero);
    });
  }
  const focus =
    game.selected && game.structures[game.selected]?.opened
      ? game.selected
      : STRUCTURE_IDS.find((id) => {
          const b = bottle(game, id);
          return (
            b === "FALTA ACERO" ||
            b === "FALTA HORMIGÓN" ||
            b === "ARMADO DETENIDO — MATERIAL"
          );
        });
  const b = focus ? bottle(game, focus) : null;
  const arrived = `Llegó un ${spec.noun}: ${spec.qty} ${spec.unit}`;
  if (b === "FALTA ACERO" || b === "ARMADO DETENIDO — MATERIAL") {
    const need = focus ? stageNeed(focus, game.structures[focus].stage).acero : 0;
    game.lastNotice = `${arrived} · este frente aún necesita ${Math.max(0, need - game.resources.acero) || need} t.`;
  } else if (b === "FALTA HORMIGÓN") {
    const need = focus ? stageNeed(focus, game.structures[focus].stage).hormigon : 0;
    game.lastNotice = `${arrived} · este frente aún necesita ${Math.max(0, need - game.resources.hormigon) || need} m³.`;
  } else {
    game.lastNotice = b
      ? `${arrived} · este frente aún: ${b}.`
      : kind === "hormigon"
        ? `${arrived}. Ya se puede verter.`
        : `${arrived}. Ya se puede armar.`;
  }
  return { ok: true };
}

export function addNote(
  game: Game,
  kind: Note["kind"],
  line: string,
  coords: { x: number; y: number } | null,
): void {
  const text = line.trim().slice(0, 240);
  if (!text) return;
  game.libreta.push({
    id: `n-${Date.now()}-${game.libreta.length}-${game.seed}`,
    kind,
    line: text,
    siteMinutes: game.siteMinutes,
    at: Date.now(),
    page: game.page,
    front: game.selected,
    regime: game.regime,
    coords,
  });
}

export function setClockPace(game: Game, pace: ClockPace): void {
  game.clockPace = pace;
  game.lastNotice =
    pace === "pausa"
      ? "Reloj en pausa. El sitio espera."
      : pace === "lento"
        ? "Reloj lento. El sitio anda a un cuarto."
        : "Reloj normal. El sitio no para salvo que tú pauses.";
}

export function noteStamp(n: {
  siteMinutes: number;
  page?: Page;
  front?: StructureId | null;
  regime?: Game["regime"];
  coords?: { x: number; y: number } | null;
}): string {
  const t = clockOf(n.siteMinutes);
  const page = (n.page ?? "plano").toUpperCase();
  const front = n.front ? String(n.front).toUpperCase() : "—";
  const regime = n.regime === "siempre" ? "SIEMPRE" : "TURNO";
  const xy = n.coords
    ? ` · ${Math.round(n.coords.x)},${Math.round(n.coords.y)}`
    : "";
  return `${t.label} · ${page} · ${front} · ${regime}${xy}`;
}

export function notesPlain(notes: Note[], valle = "Valle del Yuna"): string {
  const head = `OBRA · ${valle}`;
  if (!notes.length) return `${head}\n\nLibreta vacía.`;
  return `${head}\n\n${notes.map((n) => `${noteStamp(n)}\n${n.kind}\n${n.line}`).join("\n\n")}\n`;
}

export function notesMarkdown(notes: Note[], valle = "Valle del Yuna"): string {
  const head = `# OBRA · ${valle}\n\nLibreta de campo.\n`;
  if (!notes.length) return `${head}\n*Libreta vacía.*\n`;
  return `${head}\n${notes.map((n) => `## ${n.kind}\n\n\`${noteStamp(n)}\`\n\n${n.line}\n`).join("\n")}`;
}

export function fichaOf(game: Game, id: StructureId) {
  const s = game.structures[id];
  const r = crewAt(game, id);
  const crew = crewsAt(game, id);
  return {
    name: STRUCT_NAME[id],
    stage: STAGE_LABEL[s.stage],
    next: STAGE_NEXT[s.stage],
    crew: crew[0] ? `${crew[0].name} · ${whereFront(id)}` : "SIN CUADRILLA",
    people: `${r.obreros} OBR.  ·  ${r.capataces} CAP.  ·  ${r.ingenieros} ING.  ·  ${r.topografos} TOP.`,
    prod: rateLine(game, id),
    bottle: bottle(game, id),
    opened: s.opened,
  };
}

export { STAGE_LABEL, STAGE_NEXT, STRUCT_NAME, CONTRACT_SPEC };
