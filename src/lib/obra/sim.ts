/**
 * El reloj de OBRA. Un archivo, cuatro zonas:
 *
 *   1. REGLAS        ¿puede trabajar este frente?  bottleneckOf, productivityRatio
 *   2. TICK          un minuto de sitio            minuteTick, stepMinutes
 *   3. AUSENCIA      el valle siguió sin ti        applyElapsed
 *   4. ACCIONES      lo que el jugador firma       signFirst, acceptContract, orderSupply
 *
 * Nada aquí toca React ni localStorage. Recibe un GameState, lo muta, listo.
 *
 * El pliego (quién te contrató, la crecida) vive en pliego.ts.
 * Este archivo lo aplica: el día FLOOD.day sella a-salvo o incumplido.
 */
import {
  BOTTLE_GLOSS,
  FRONT_LABEL,
  OFICIO_KEY,
  PROTO_DEF,
  STRUCTURE_DEF,
  STRUCTURE_NAME,
  STRUCTURE_NAME_UP,
  STAGE_LABEL,
  SITE_MINUTES_PER_REAL_SECOND,
  OFFLINE_CAP_MS,
  APPLY_ELAPSED_SKIP_MS,
  SUPPLY,
  SURVEY_REAL_SECONDS,
  WAGE,
  nextStage,
  stageIndex,
} from "./catalog";
import { clockParts, pad2 } from "./format";
import { FLOOD, SCRIPT_60 } from "./pliego";
import type {
  Contract,
  Crew,
  EventKind,
  FrontId,
  GameState,
  Oficio,
  ProtoKind,
  StructureId,
  StructureStage,
} from "./types";
import { STRUCTURE_IDS, V1_CONTRACT_IDS } from "./types";

const DAY = 24 * 60;

function rnd(s: GameState): number {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

function hourOf(mins: number): number {
  return Math.floor((mins % DAY) / 60);
}

function crossedHour(from: number, dt: number, hour: number): boolean {
  const a = from;
  const b = from + dt;
  const target = Math.floor(from / DAY) * DAY + hour * 60;
  return a < target && b >= target;
}

export function isWorkTime(s: GameState): boolean {
  if (s.regime === "siempre") return true;
  const h = hourOf(s.siteMinutes);
  return h >= 7 && h < 18;
}

export function nightFactor(s: GameState): number {
  const h = hourOf(s.siteMinutes);
  const night = h < 7 || h >= 18;
  if (!night) return 1;
  if (s.regime === "turno") return 0.08;
  return 0.72;
}

export function crewsOn(s: GameState, front: FrontId): Crew[] {
  return s.crews.filter((c) => c.front === front);
}

export function crewHeadcount(c: Crew): number {
  return c.obreros + c.capataces + c.ingenieros + c.topografos;
}

export function peopleOn(s: GameState, front: FrontId) {
  return crewsOn(s, front).reduce(
    (a, c) => ({
      obreros: a.obreros + c.obreros,
      capataces: a.capataces + c.capataces,
      ingenieros: a.ingenieros + c.ingenieros,
      topografos: a.topografos + c.topografos,
    }),
    { obreros: 0, capataces: 0, ingenieros: 0, topografos: 0 },
  );
}

function outputOf(people: ReturnType<typeof peopleOn>, kind: "survey" | "build"): number {
  if (kind === "survey") {
    return people.topografos * 0.2 + people.obreros * 0.03 + people.ingenieros * 0.06;
  }
  const capBonus = 1 + 0.16 * Math.min(people.capataces, Math.max(1, Math.ceil(people.obreros / 8)));
  let p = people.obreros * 1.0 * capBonus;
  if (people.ingenieros > 0) p *= 1 + 0.12 * Math.min(people.ingenieros, 2);
  return p;
}

function slowdownsOn(s: GameState, front: FrontId) {
  return s.slowdowns.filter((sl) => sl.minutesLeft > 0 && sl.target === front);
}

export function v1Complete(s: GameState): boolean {
  return V1_CONTRACT_IDS.every((id) => s.structures[id].stage === "conexion");
}

export function daysUntilFlood(s: GameState): number {
  const day = clockParts(s.siteMinutes).day;
  return FLOOD.day - day;
}

/** Una sola cifra de crecida para cabecera, contratos, ficha y eventos. */
export function floodLine(s: GameState): string {
  if (s.floodStatus === "a-salvo") return "OBRA A SALVO";
  if (s.floodStatus === "incumplido") return "PLAZO INCUMPLIDO";
  const n = Math.max(0, daysUntilFlood(s));
  if (n === 0) return `${FLOOD.label} · hoy`;
  return `${FLOOD.label} · faltan ${n} ${n === 1 ? "día" : "días"}`;
}

export function contractClock(
  s: GameState,
  c: Contract,
): { remaining: number; late: boolean; dueDay: number | null } {
  if (c.status !== "activo" || c.acceptedDay == null) {
    return { remaining: c.durationDays, late: false, dueDay: null };
  }
  const day = clockParts(s.siteMinutes).day;
  const dueDay = c.acceptedDay + c.durationDays;
  return { remaining: dueDay - day, late: day > dueDay, dueDay };
}

export function frontPosting(front: FrontId): string {
  if (front === "reserva") return "en disponibles";
  if (front === "survey") return "en levantamiento";
  if (front === "ensayo") return "en ensayo";
  return `en frente ${FRONT_LABEL[front]}`;
}

export function hasSignedFront(s: GameState): boolean {
  return V1_CONTRACT_IDS.some((id) => s.structures[id].opened);
}

export function reservaPool(s: GameState) {
  return peopleOn(s, "reserva");
}

export function materialsNeed(s: GameState, id: StructureId): { acero: number; hormigon: number } {
  const st = s.structures[id];
  return materialsFor(id, st.stage);
}

/* -------------------------------------------------------------------------- */
/* 1. REGLAS                                                                  */
/* -------------------------------------------------------------------------- */

export function productivityRatio(s: GameState, front: FrontId): number {
  const people = peopleOn(s, front);
  const raw = outputOf(people, front === "survey" ? "survey" : "build");
  const standard = 9.4;
  let r = raw / standard;
  r *= 1 - s.fatigue * 0.42;
  r *= nightFactor(s);
  if (s.regime === "siempre") r *= 1.1;
  for (const sl of slowdownsOn(s, front)) {
    // material se trata como tope duro en bottleneckOf (armado detenido).
    // lluvia sí baja el ritmo; el vertido se corta aparte en tickFront.
    if (sl.kind === "material") continue;
    r *= sl.factor;
  }
  if (s.resources.horasHombre <= 0) r *= 0.55;
  if (s.floodStatus === "incumplido") r *= 0.62;
  return Math.max(0, r);
}

export function productivityWord(ratio: number): string {
  if (ratio <= 0.02) return "DETENIDA";
  if (ratio < 0.35) return "BAJA";
  if (ratio < 0.75) return "MEDIA";
  if (ratio < 1.15) return "ALTA";
  return "MUY ALTA";
}

export function ritmoLabel(s: GameState, id: StructureId): string {
  const w = productivityWord(productivityRatio(s, id));
  const b = bottleneckOf(s, id);
  if ((w === "BAJA" || w === "DETENIDA") && b) return `${w} · ${b}`;
  return w;
}

function materialsFor(id: StructureId, stage: StructureStage): { acero: number; hormigon: number } {
  const def = STRUCTURE_DEF[id];
  return {
    acero: def.steel[stage] ?? 0,
    hormigon: def.concrete[stage] ?? 0,
  };
}

export function isV1Contract(id: StructureId): boolean {
  return (V1_CONTRACT_IDS as readonly string[]).includes(id);
}

export function bottleneckOf(s: GameState, id: StructureId): string | null {
  const st = s.structures[id];
  if (!st.opened) return "SIN AUTORIZAR";
  if (st.stage === "conexion") return null;
  const people = peopleOn(s, id);
  if (people.obreros + people.ingenieros + people.topografos + people.capataces === 0) {
    return "SIN CUADRILLA";
  }
  if ((st.stage === "levantado" || st.stage === "trazado") && people.topografos < 1) {
    return "FALTA TOPÓGRAFO";
  }
  if (people.obreros < 1) return "FALTAN OBREROS";
  const need = materialsFor(id, st.stage);
  const unpaid = st.paidStage !== st.stage;
  if (unpaid && need.acero > 0 && s.resources.acero < need.acero) return "FALTA ACERO";
  if (unpaid && need.hormigon > 0 && s.resources.hormigon < need.hormigon) return "FALTA HORMIGÓN";

  const sls = slowdownsOn(s, id);
  const rain = sls.find((d) => d.kind === "lluvia");
  if (rain && (st.stage === "estructura" || st.stage === "encofrado")) {
    return "LLUVIA — NO SE VIERTE";
  }
  if (rain) return "LLUVIA EN ESTE FRENTE";
  const mat = sls.find((d) => d.kind === "material");
  if (mat && st.stage === "armado" && unpaid && s.resources.acero < Math.max(1, need.acero)) {
    return "ARMADO DETENIDO — MATERIAL";
  }

  if (s.regime === "turno" && !isWorkTime(s)) return "FUERA DE TURNO";
  if (s.resources.horasHombre <= 0) return "JORNADA EXTRA";
  if (s.floodStatus === "incumplido") return "CRECIDA EN EL SITIO";
  return null;
}

export function bottleGloss(bottle: string | null): string | null {
  if (!bottle) return null;
  return BOTTLE_GLOSS[bottle] ?? null;
}

/** Una línea de gesto ya cableado. El cuello no miente. */
export function bottleAction(bottle: string | null): string | null {
  if (!bottle) return null;
  switch (bottle) {
    case "FALTA ACERO":
    case "ARMADO DETENIDO — MATERIAL":
      return "Pedir acero en el cajetín.";
    case "FALTA HORMIGÓN":
      return "Pedir hormigón en el cajetín.";
    case "SIN CUADRILLA":
    case "FALTA TOPÓGRAFO":
    case "FALTAN OBREROS":
      return "Asignar desde disponibles, o abre OBRA.";
    case "FUERA DE TURNO":
      return "Espera el alba o sella SIEMPRE ABIERTA.";
    case "SIN AUTORIZAR":
      return "Firmar el frente: sello o CONTRATOS.";
    case "JORNADA EXTRA":
      return "Amanece y se reponen las horas-hombre.";
    case "CRECIDA EN EL SITIO":
      return "Sigue la obra o sella NUEVA PARTIDA.";
    default:
      return null;
  }
}

export function supplyKindFor(bottle: string | null): "hormigon" | "acero" | null {
  if (bottle === "FALTA HORMIGÓN") return "hormigon";
  if (bottle === "FALTA ACERO" || bottle === "ARMADO DETENIDO — MATERIAL") return "acero";
  return null;
}

export function needsStaff(s: GameState, id: StructureId): boolean {
  const b = bottleneckOf(s, id);
  return b === "SIN CUADRILLA" || b === "FALTA TOPÓGRAFO" || b === "FALTAN OBREROS";
}

export function staffGate(s: GameState, id: StructureId): { ok: boolean; reason: string } {
  if (!s.structures[id]?.opened) return { ok: false, reason: "Autoriza el frente primero." };
  const b = bottleneckOf(s, id);
  const pool = reservaPool(s);
  const poolHeads = pool.obreros + pool.capataces + pool.ingenieros + pool.topografos;
  if (b === "FALTA TOPÓGRAFO" && pool.topografos < 1) {
    return { ok: false, reason: "Sin topógrafo en reserva · quita uno de otro frente en OBRA" };
  }
  if (b === "FALTAN OBREROS" && pool.obreros < 1) {
    return { ok: false, reason: "Sin obreros en reserva · quita de otro frente en OBRA" };
  }
  if (b === "SIN CUADRILLA" && poolHeads < 1) {
    return { ok: false, reason: "Disponibles vacíos · mueve una cuadrilla en OBRA" };
  }
  if (!needsStaff(s, id)) return { ok: false, reason: "Este frente ya tiene gente." };
  if (poolHeads < 1 && !s.crews.some((c) => c.front === id)) {
    return { ok: false, reason: "Sin personal en reserva · quita de otro frente en OBRA" };
  }
  return { ok: true, reason: "" };
}

export function contractFor(s: GameState, id: StructureId): Contract | undefined {
  return s.contracts.find((c) => c.structureId === id);
}

export function requirementGap(s: GameState, id: StructureId): string | null {
  if (s.survey < 1) return "Sin levantamiento";
  const def = STRUCTURE_DEF[id];
  const knowledgeNeed = def.knowledgeMin;
  if (s.resources.conocimiento < knowledgeNeed) {
    return `Falta conocimiento (${knowledgeNeed})`;
  }
  for (const [needId, needStage] of Object.entries(def.requires) as [StructureId, StructureStage][]) {
    const have = s.structures[needId];
    if (stageIndex(have.stage) < stageIndex(needStage)) {
      return `Requiere ${STRUCTURE_NAME[needId].toLowerCase()} en ${needStage}`;
    }
  }
  return null;
}

export function gapGloss(gap: string | null): string | null {
  if (!gap) return null;
  if (gap === "Sin levantamiento") {
    return "El pliego pide reconocer el valle antes de fundar. Sella LEVANTA EL TERRENO.";
  }
  if (gap.startsWith("Falta conocimiento")) {
    return "El conocimiento se gana levantando el terreno, con ingenieros en un frente y al terminar una pieza. No se compra.";
  }
  if (gap.startsWith("Requiere")) {
    return "El valle se construye en orden. Primero avanza la pieza de la que esta depende.";
  }
  return null;
}

export function refreshContracts(s: GameState): void {
  for (const c of s.contracts) {
    if (c.status === "activo" || c.status === "cumplido") continue;
    c.requiredKnowledge = STRUCTURE_DEF[c.structureId].knowledgeMin;
    const gap = requirementGap(s, c.structureId);
    c.status = gap ? "bloqueado" : "disponible";
  }
}

function wagePerHour(s: GameState, people: ReturnType<typeof peopleOn>): number {
  let w =
    people.obreros * WAGE.obrero +
    people.capataces * WAGE.capataz +
    people.ingenieros * WAGE.ingeniero +
    people.topografos * WAGE.topografo;
  if (s.regime === "siempre") w *= 1.55;
  if (s.resources.horasHombre <= 0) w *= 1.7;
  return w;
}

function applyFatigue(s: GameState, dtMin: number): void {
  if (s.regime === "siempre") {
    s.fatigue = Math.min(0.82, s.fatigue + 0.00018 * dtMin);
  } else {
    s.fatigue = Math.max(0, s.fatigue - 0.00028 * dtMin);
  }
}

/* -------------------------------------------------------------------------- */
/* 2. TICK                                                                    */
/* -------------------------------------------------------------------------- */

function finishSurvey(s: GameState): void {
  s.survey = 1;
  s.surveying = false;
  s.instruction = s.instruction === "levanta" ? "define" : s.instruction;
  s.resources.conocimiento += 6;
  for (const crew of s.crews) {
    if (crew.front === "survey") crew.front = "reserva";
  }
  refreshContracts(s);
  s.lastNotice = SCRIPT_60.define;
}

function tickSurvey(s: GameState, hours: number): void {
  if (s.survey >= 1) return;
  if (!s.surveying) return;
  s.survey = Math.min(1, s.survey + hours * 4);
  const people = peopleOn(s, "survey");
  const heads = people.obreros + people.topografos + people.ingenieros + people.capataces;
  if (heads > 0) {
    s.resources.horasHombre = Math.max(0, s.resources.horasHombre - heads * hours);
    s.totals.horasHombre += heads * hours;
    s.resources.dinero = Math.max(0, s.resources.dinero - wagePerHour(s, people) * hours);
  }
  if (s.survey >= 1) finishSurvey(s);
}

/** Levante en tiempo real. El reloj de sitio sigue en PAUSA. Devuelve true al terminar. */
export function tickSurveyReal(s: GameState, dtSec: number): boolean {
  if (s.survey >= 1 || !s.surveying) return false;
  const dt = Math.max(0, dtSec);
  s.survey = Math.min(1, s.survey + dt / SURVEY_REAL_SECONDS);
  if (s.survey >= 1) {
    finishSurvey(s);
    return true;
  }
  return false;
}

function enterStageCosts(s: GameState, id: StructureId, stage: StructureStage): boolean {
  const st = s.structures[id];
  if (st.paidStage === stage) return true;
  const need = materialsFor(id, stage);
  if (s.resources.acero < need.acero || s.resources.hormigon < need.hormigon) return false;
  s.resources.acero -= need.acero;
  s.resources.hormigon -= need.hormigon;
  s.totals.acero += need.acero;
  s.totals.hormigon += need.hormigon;
  st.paidStage = stage;
  const bits: string[] = [];
  if (need.acero > 0) bits.push(`${need.acero} t de acero`);
  if (need.hormigon > 0) bits.push(`${need.hormigon} m³ de hormigón`);
  if (bits.length) {
    s.lastNotice = `${STRUCTURE_NAME[id]} · se cargan ${bits.join(" y ")} al frente.`;
  }
  return true;
}

function pushPlate(
  s: GameState,
  plate: {
    structureId: StructureId | "ensayo" | "valle";
    name: string;
    materials: string;
    workforce: string;
    method: string;
    cost: number;
    seal?: "a-salvo" | "incumplido" | "tardio";
  },
): void {
  const clock = clockParts(s.siteMinutes);
  s.archive.push({
    id: `A-${String(s.archive.length + 1).padStart(2, "0")}`,
    structureId: plate.structureId,
    name: plate.name,
    completedDay: clock.day,
    completedClock: clock.label,
    materials: plate.materials,
    workforce: plate.workforce,
    method: plate.method,
    cost: plate.cost,
    seal: plate.seal,
  });
}

function pushCrecidaEvent(s: GameState, title: string, body: string): void {
  const clock = clockParts(s.siteMinutes);
  s.events.unshift({
    id: `crecida-${s.siteMinutes}-${s.seed}`,
    day: clock.day,
    clock: clock.short,
    kind: "crecida",
    title,
    body,
    minutesLeft: 36 * 60,
    target: "site",
  });
  s.events = s.events.slice(0, 14);
}

function settleFlood(s: GameState, reason: "complete" | "day"): void {
  if (s.floodStatus !== "pendiente") return;
  const done = v1Complete(s);
  const day = clockParts(s.siteMinutes).day;
  if (done && day <= FLOOD.day) {
    s.floodStatus = "a-salvo";
    s.lastNotice = "OBRA A SALVO. El pliego se cumplió antes de la crecida.";
    pushCrecidaEvent(s, "OBRA A SALVO", "Los tres frentes del pliego están conectados. La Q50 no se lleva el valle.");
    if (!s.archive.some((a) => a.structureId === "valle")) {
      pushPlate(s, {
        structureId: "valle",
        name: "Valle del Yuna",
        materials: `${Math.round(s.totals.hormigon)} m³ hormigón · ${Math.round(s.totals.acero)} t acero`,
        workforce: `${Math.round(s.totals.horasHombre)} h-h`,
        method: "Pliego cumplido. Terraza unida al cerro norte.",
        cost: Math.round(620000 - s.resources.dinero),
        seal: "a-salvo",
      });
    }
    return;
  }
  if (reason === "day" && day >= FLOOD.day) {
    s.floodStatus = done ? "a-salvo" : "incumplido";
    if (s.floodStatus === "a-salvo") {
      s.lastNotice = "Llegó la crecida. El valle estaba a salvo.";
      pushCrecidaEvent(s, "CRECIDA Q50", "Llegó la crecida. Los tres frentes ya estaban conectados.");
    } else {
      s.lastNotice = "Llegó la crecida. PLAZO INCUMPLIDO.";
      pushCrecidaEvent(
        s,
        "PLAZO INCUMPLIDO",
        "La Q50 entra al valle. El ritmo baja. Las piezas que falten aún se pueden archivar — tarde.",
      );
      if (!s.archive.some((a) => a.structureId === "valle")) {
        pushPlate(s, {
          structureId: "valle",
          name: "Valle del Yuna",
          materials: `${Math.round(s.totals.hormigon)} m³ hormigón · ${Math.round(s.totals.acero)} t acero`,
          workforce: `${Math.round(s.totals.horasHombre)} h-h`,
          method: "Plazo incumplido. La crecida llegó antes que el pliego.",
          cost: Math.round(620000 - s.resources.dinero),
          seal: "incumplido",
        });
      }
    }
  }
}

function completeStructure(s: GameState, id: StructureId): void {
  const st = s.structures[id];
  st.stage = "conexion";
  st.progress = 1;
  const def = STRUCTURE_DEF[id];
  const c = contractFor(s, id);
  const late = c ? contractClock(s, c).late : false;
  if (c && c.status !== "cumplido") {
    c.status = "cumplido";
    s.prestigio += late ? Math.ceil(c.prestigio / 2) : c.prestigio;
  }
  s.resources.conocimiento += 8 + (c?.difficulty ?? 1) * 3;
  if (!s.archive.some((a) => a.structureId === id)) {
    const crew = crewsOn(s, id)[0];
    const steel = Object.values(def.steel).reduce((a, b) => a + (b ?? 0), 0);
    pushPlate(s, {
      structureId: id,
      name: STRUCTURE_NAME[id],
      materials: `${def.concrete.estructura ?? 0} m³ hormigón · ${steel} t acero`,
      workforce: crew ? `${crew.name} · ${Math.round(st.hoursWorked)} h-h` : `${Math.round(st.hoursWorked)} h-h`,
      method: def.method,
      cost: Math.round(st.costAccrued),
      seal: late ? "tardio" : undefined,
    });
  }
  s.lastNotice = late ? `${STRUCTURE_NAME[id]} al archivo — tarde.` : SCRIPT_60.archivo;
  if (s.phase < 2 && (id === "camino" || STRUCTURE_IDS.filter((x) => stageIndex(s.structures[x].stage) >= 3).length >= 2)) {
    s.phase = 2;
  }
  if (s.phase < 3 && (id === "planta" || id === "viaducto" || s.archive.length >= 3)) {
    s.phase = 3;
  }
  refreshContracts(s);
  if (v1Complete(s)) settleFlood(s, "complete");
}

const HARD_STOP = new Set([
  "SIN CUADRILLA",
  "FALTA TOPÓGRAFO",
  "FALTAN OBREROS",
  "FALTA ACERO",
  "FALTA HORMIGÓN",
  "LLUVIA — NO SE VIERTE",
  "ARMADO DETENIDO — MATERIAL",
  "FUERA DE TURNO",
]);

function tickFront(s: GameState, id: StructureId, hours: number): void {
  const st = s.structures[id];
  if (!st.opened || st.stage === "conexion") return;
  const bottle = bottleneckOf(s, id);
  if (bottle && HARD_STOP.has(bottle)) return;

  const people = peopleOn(s, id);
  const ratio = productivityRatio(s, id);
  if (ratio <= 0.01) return;

  const def = STRUCTURE_DEF[id];
  const needH = def.stageHours[st.stage as keyof typeof def.stageHours] ?? 4;
  const workHours = hours * ratio;
  if (!enterStageCosts(s, id, st.stage)) return;

  st.progress += workHours / needH;
  st.hoursWorked += workHours;
  const wage = wagePerHour(s, people) * hours;
  st.costAccrued += wage;
  s.resources.dinero = Math.max(0, s.resources.dinero - wage);
  const headCount = people.obreros + people.capataces + people.ingenieros + people.topografos;
  s.resources.horasHombre = Math.max(0, s.resources.horasHombre - headCount * hours);
  s.totals.horasHombre += headCount * hours;
  s.resources.conocimiento += people.ingenieros * 0.08 * hours;

  const ex = def.excavate[st.stage] ?? 0;
  if (ex > 0) s.totals.excavado += (ex * workHours) / needH;

  while (st.progress >= 1) {
    const nxt = nextStage(st.stage);
    if (!nxt || nxt === "conexion") {
      completeStructure(s, id);
      break;
    }
    st.stage = nxt;
    st.progress -= 1;
    if (st.progress < 0) st.progress = 0;
    if (s.phase < 2 && stageIndex(st.stage) >= 4) s.phase = 2;
    if (s.phase < 3 && (id === "planta" || id === "viaducto") && stageIndex(st.stage) >= 5) {
      s.phase = 3;
    }
  }
}

function protoBottle(s: GameState): string | null {
  const p = s.prototype;
  if (!p?.opened) return "SIN AUTORIZAR";
  if (p.stage === "conexion") return null;
  const people = peopleOn(s, "ensayo");
  if (people.obreros + people.capataces + people.ingenieros + people.topografos === 0) return "SIN CUADRILLA";
  if ((p.stage === "levantado" || p.stage === "trazado") && people.topografos < 1) return "FALTA TOPÓGRAFO";
  if (people.obreros < 1) return "FALTAN OBREROS";
  const def = PROTO_DEF[p.kind];
  const unpaid = p.progress < 0.02;
  if (unpaid && p.stage === "armado" && s.resources.acero < def.steel) return "FALTA ACERO";
  if (unpaid && p.stage === "estructura" && s.resources.hormigon < def.concrete) return "FALTA HORMIGÓN";
  if (s.regime === "turno" && !isWorkTime(s)) return "FUERA DE TURNO";
  return null;
}

function tickPrototype(s: GameState, hours: number): void {
  const p = s.prototype;
  if (!p?.opened || p.stage === "conexion") return;
  const bottle = protoBottle(s);
  if (bottle && HARD_STOP.has(bottle)) return;
  const people = peopleOn(s, "ensayo");
  const ratio = productivityRatio(s, "ensayo");
  if (ratio <= 0.01) return;
  const def = PROTO_DEF[p.kind];
  const needH = 3 * def.mul;
  if (p.stage === "armado" && p.progress < 0.02) {
    if (s.resources.acero < def.steel) return;
    s.resources.acero -= def.steel;
    s.totals.acero += def.steel;
  }
  if (p.stage === "estructura" && p.progress < 0.02) {
    if (s.resources.hormigon < def.concrete) return;
    s.resources.hormigon -= def.concrete;
    s.totals.hormigon += def.concrete;
  }
  const work = hours * ratio;
  p.progress += work / needH;
  p.hoursWorked += work;
  const wage = wagePerHour(s, people) * hours;
  p.costAccrued += wage;
  s.resources.dinero = Math.max(0, s.resources.dinero - wage);
  const heads = people.obreros + people.capataces + people.ingenieros + people.topografos;
  s.resources.horasHombre = Math.max(0, s.resources.horasHombre - heads * hours);
  s.totals.horasHombre += heads * hours;
  while (p.progress >= 1) {
    const nxt = nextStage(p.stage);
    if (!nxt || nxt === "conexion") {
      p.stage = "conexion";
      p.progress = 1;
      s.resources.conocimiento += 5;
      s.prestigio += 3;
      pushPlate(s, {
        structureId: "ensayo",
        name: p.name,
        materials: `${def.concrete} m³ hormigón · ${def.steel} t acero`,
        workforce: `${Math.round(p.hoursWorked)} h-h`,
        method: def.method,
        cost: Math.round(p.costAccrued),
      });
      for (const crew of s.crews) {
        if (crew.front === "ensayo") crew.front = "reserva";
      }
      break;
    }
    p.stage = nxt;
    p.progress -= 1;
  }
}

function tickPlant(s: GameState, hours: number): void {
  const pl = s.structures.planta;
  if (stageIndex(pl.stage) < stageIndex("estructura")) return;
  const raining = s.slowdowns.some((sl) => sl.minutesLeft > 0 && sl.kind === "lluvia" && sl.target === "planta");
  if (raining) return;
  const factor = nightFactor(s) * (s.regime === "siempre" ? 1.15 : 1);
  s.resources.hormigon += 2.4 * hours * factor;
}

function tickSlowdowns(s: GameState, dtMin: number): void {
  for (const sl of s.slowdowns) sl.minutesLeft -= dtMin;
  s.slowdowns = s.slowdowns.filter((sl) => sl.minutesLeft > 0);
  for (const ev of s.events) {
    if (ev.minutesLeft > 0) ev.minutesLeft -= dtMin;
  }
}

const EVENT_POOL: {
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

function tryEvent(s: GameState): boolean {
  if (s.survey < 0.35) return false;
  if (s.events.filter((e) => e.minutesLeft > 0).length >= 2) return false;
  const chance = s.regime === "siempre" ? 0.58 : 0.3;
  if (rnd(s) > chance) {
    s.minutesSinceEvent = 40 + rnd(s) * 80;
    return false;
  }
  let pool = EVENT_POOL;
  if (s.regime === "siempre") {
    const extra = EVENT_POOL.find((e) => e.kind === "inspeccion");
    if (extra) pool = [...EVENT_POOL, extra, extra];
  }
  const pick = pool[Math.floor(rnd(s) * pool.length)]!;
  const clock = clockParts(s.siteMinutes);
  const open = STRUCTURE_IDS.filter((id) => s.structures[id].opened && s.structures[id].stage !== "conexion");
  let target: StructureId | "site";
  if (pick.kind === "lluvia" || pick.kind === "material" || pick.kind === "suelo" || pick.kind === "diseno") {
    if (!open.length) return false;
    target = open[Math.floor(rnd(s) * open.length)]!;
  } else {
    target = open.length && rnd(s) > 0.35 ? open[Math.floor(rnd(s) * open.length)]! : "site";
  }

  s.events.unshift({
    id: `n-${s.siteMinutes}-${s.seed}`,
    day: clock.day,
    clock: clock.short,
    kind: pick.kind,
    title: pick.title,
    body: pick.body,
    minutesLeft: pick.minutes,
    target,
  });
  s.events = s.events.slice(0, 14);

  if (pick.kind === "material") {
    const took = Math.round(6 + rnd(s) * 8);
    s.resources.acero = Math.max(0, s.resources.acero - took);
    const dest = target === "site" ? "el almacén" : `el frente ${FRONT_LABEL[target]}`;
    s.events[0]!.body = `Faltante de ${took} t de acero en ${dest}. El armado se detiene hasta pedir un lote.`;
  }
  if (pick.kind === "diseno" && target !== "site") {
    const st = s.structures[target];
    st.progress = Math.max(0, st.progress - 0.22);
  }
  if (pick.kind === "inspeccion" && s.regime === "siempre") {
    s.resources.dinero = Math.max(0, s.resources.dinero - 4200);
  }
  s.slowdowns.push({
    target,
    minutesLeft: pick.minutes,
    factor: pick.factor,
    kind: pick.kind,
  });
  s.minutesSinceEvent = 0;
  return true;
}

function minuteTick(s: GameState, dtMin: number): void {
  const from = s.siteMinutes;
  s.siteMinutes += dtMin;
  if (crossedHour(from, dtMin, 7)) {
    s.resources.horasHombre += s.regime === "turno" ? 110 : 70;
  }
  applyFatigue(s, dtMin);
  tickSlowdowns(s, dtMin);
  const hours = dtMin / 60;
  tickSurvey(s, hours);
  for (const id of STRUCTURE_IDS) tickFront(s, id, hours);
  tickPrototype(s, hours);
  tickPlant(s, hours);
  refreshContracts(s);
  if (s.phase < 2 && s.survey >= 1 && s.structures.camino.opened) s.phase = 2;
  if (s.phase < 3 && s.structures.planta.stage === "conexion") s.phase = 3;
  settleFlood(s, "day");
}

export function stepMinutes(s: GameState, minutes: number, opts?: { eventBudget?: number }): void {
  if (minutes <= 0) return;
  const budget = opts?.eventBudget ?? 99;
  let fired = 0;
  const chunk = minutes > 900 ? 15 : minutes > 240 ? 5 : 1;
  let left = minutes;
  while (left > 0) {
    const dt = Math.min(chunk, left);
    left -= dt;
    minuteTick(s, dt);
    s.minutesSinceEvent += dt;
    const interval = s.regime === "siempre" ? 110 : 220;
    if (fired < budget && s.minutesSinceEvent > interval) {
      if (tryEvent(s)) fired += 1;
      else s.minutesSinceEvent = interval * 0.4;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* 3. AUSENCIA                                                                */
/* -------------------------------------------------------------------------- */

export function applyElapsed(s: GameState, now: number): GameState {
  if (s.clockPace === "pausa") {
    s.realLastSeen = now;
    s.absence = null;
    return s;
  }
  const elapsed = Math.min(Math.max(0, now - s.realLastSeen), OFFLINE_CAP_MS);
  s.realLastSeen = now;
  if (elapsed < APPLY_ELAPSED_SKIP_MS) {
    s.absence = null;
    return s;
  }
  const pace = s.clockPace === "lento" ? 0.25 : 1;
  const before = {
    stages: Object.fromEntries(
      STRUCTURE_IDS.map((id) => [id, { stage: s.structures[id].stage, p: s.structures[id].progress }]),
    ) as Record<StructureId, { stage: StructureStage; p: number }>,
    day: clockParts(s.siteMinutes).day,
    flood: s.floodStatus,
  };
  const siteMin = (elapsed / 1000) * SITE_MINUTES_PER_REAL_SECOND * pace;
  stepMinutes(s, siteMin, { eventBudget: elapsed > 5 * 60_000 ? 2 : 0 });
  const afterDay = clockParts(s.siteMinutes).day;
  const highlights = STRUCTURE_IDS.map((id) => {
    const a = before.stages[id]!;
    const b = s.structures[id];
    if (b.stage === "conexion" && a.stage !== "conexion") {
      return { name: STRUCTURE_NAME[id], delta: "archivo" };
    }
    if (a.stage !== b.stage) return { name: STRUCTURE_NAME[id], delta: STAGE_LABEL[b.stage] };
    const d = b.progress - a.p;
    if (d <= 0.08) return null;
    return { name: STRUCTURE_NAME[id], delta: "avanzó" };
  }).filter((x): x is { name: string; delta: string } => !!x);

  if (before.flood === "pendiente" && s.floodStatus === "incumplido") {
    highlights.unshift({ name: "Crecida", delta: "incumplido" });
  } else if (before.flood === "pendiente" && s.floodStatus === "a-salvo") {
    highlights.unshift({ name: "Crecida", delta: "a-salvo" });
  }

  if (!highlights.length) {
    const stuckId = STRUCTURE_IDS.find((id) => {
      const b = bottleneckOf(s, id);
      return b === "FALTA HORMIGÓN" || b === "FALTA ACERO" || b === "SIN CUADRILLA" || b === "FALTA TOPÓGRAFO";
    });
    const stuck = stuckId ? bottleneckOf(s, stuckId) : null;
    if (stuck === "FALTA HORMIGÓN") {
      highlights.push({ name: STRUCTURE_NAME[stuckId!], delta: "sin hormigón" });
    } else if (stuck === "FALTA ACERO") {
      highlights.push({ name: STRUCTURE_NAME[stuckId!], delta: "sin acero" });
    } else if (s.regime === "turno" && !isWorkTime(s)) {
      highlights.push({ name: "Régimen", delta: "noche" });
    } else {
      highlights.push({ name: "Yuna", delta: afterDay > before.day ? "siguió" : "esperó" });
    }
  }

  s.absence =
    elapsed > 90_000
      ? {
          realHours: elapsed / 3_600_000,
          line: composeAbsenceLine(highlights, afterDay > before.day, before.day, afterDay),
        }
      : null;
  return s;
}

export function composeAbsenceLine(
  highlights: { name: string; delta: string }[],
  newDay: boolean,
  fromDay: number,
  toDay: number,
): string {
  const h = highlights[0];
  if (h?.delta === "incumplido") return "Llegó la crecida. Plazo incumplido.";
  if (h?.delta === "a-salvo") return "El valle quedó a salvo.";
  if (h?.delta === "archivo") return `${h.name} entró al archivo.`;
  if (h && h.delta === "noche") return "Noche. El turno esperó.";
  if (h && h.name === "Yuna") return "El Yuna siguió.";
  if (h && (h.delta === "sin hormigón" || h.delta === "sin acero")) {
    return `${h.name} ${h.delta}.`;
  }
  if (h && h.delta === "avanzó") return `Sin ti: ${h.name} avanzó.`;
  if (h) return `Sin ti: ${h.name} en ${h.delta}.`;
  if (newDay) return `Día ${fromDay} al ${toDay}.`;
  return "El Yuna siguió.";
}

/* -------------------------------------------------------------------------- */
/* 4. ACCIONES                                                                */
/* -------------------------------------------------------------------------- */

export function startSurvey(s: GameState): void {
  if (s.survey >= 1) return;
  s.surveying = true;
  const topo = s.crews.find((c) => c.topografos > 0 && (c.front === "reserva" || c.front === "survey"));
  if (topo) topo.front = "survey";
}

export function assignCrew(s: GameState, crewId: string, front: FrontId): { ok: boolean; reason?: string } {
  const crew = s.crews.find((c) => c.id === crewId);
  if (!crew) return { ok: false, reason: "Cuadrilla no existe" };
  if (front === "ensayo") {
    if (!s.prototype?.opened || s.prototype.stage === "conexion") {
      s.lastNotice = "No hay ensayo abierto.";
      return { ok: false, reason: s.lastNotice };
    }
  } else if (front !== "reserva" && front !== "survey") {
    const st = s.structures[front];
    if (!st?.opened) {
      s.lastNotice = "Ese frente aún no está autorizado.";
      return { ok: false, reason: s.lastNotice };
    }
  }
  crew.front = front;
  s.lastNotice = `${crew.name} ${frontPosting(front)}.`;
  return { ok: true };
}

export function shiftOficio(s: GameState, crewId: string, oficio: Oficio, dir: 1 | -1): void {
  const crew = s.crews.find((c) => c.id === crewId);
  if (!crew) return;
  const key = OFICIO_KEY[oficio];
  const reserva =
    s.crews.find((c) => c.id !== crewId && c.front === "reserva") ?? s.crews.find((c) => c.id !== crewId);
  if (!reserva) {
    s.lastNotice = "No hay reserva a la que devolver.";
    return;
  }
  if (dir < 0) {
    if (crew[key] < 1) {
      s.lastNotice = "Nada que quitar.";
      return;
    }
    const wasCritical =
      oficio === "topografo" &&
      crew.front !== "reserva" &&
      crew.front !== "survey" &&
      crew.topografos === 1 &&
      (s.structures[crew.front as StructureId]?.stage === "levantado" ||
        s.structures[crew.front as StructureId]?.stage === "trazado");
    const lastHands =
      oficio === "obrero" &&
      crew.front !== "reserva" &&
      crew.front !== "survey" &&
      crew.obreros === 1;
    crew[key] -= 1;
    reserva[key] += 1;
    s.lastNotice = wasCritical || lastHands ? "Este frente quedará detenido." : null;
    return;
  }
  if (dir > 0) {
    if (oficio === "topografo" && reservaPool(s).topografos < 1) {
      s.lastNotice = "SIN TOP EN RESERVA";
      return;
    }
    if (reserva[key] < 1) {
      s.lastNotice = oficio === "topografo" ? "SIN TOP EN RESERVA" : "Nada en disponibles.";
      return;
    }
    reserva[key] -= 1;
    crew[key] += 1;
  }
}

function takeFromReserva(
  s: GameState,
  dest: Crew,
  key: "obreros" | "capataces" | "ingenieros" | "topografos",
  n: number,
): number {
  let left = n;
  for (const src of s.crews) {
    if (src.id === dest.id || src.front !== "reserva") continue;
    const give = Math.min(left, src[key]);
    src[key] -= give;
    dest[key] += give;
    left -= give;
    if (left <= 0) break;
  }
  return n - left;
}

export function assignFromDisponibles(s: GameState, id: StructureId): { ok: boolean; reason?: string } {
  const gate = staffGate(s, id);
  if (!gate.ok) {
    s.lastNotice = gate.reason;
    return { ok: false, reason: gate.reason };
  }
  let crew = s.crews.find((c) => c.front === id);
  if (!crew) {
    crew = s.crews.find((c) => c.front === "reserva" && crewHeadcount(c) > 0);
    if (crew) crew.front = id;
  }
  if (!crew) {
    s.lastNotice = "No hay cuadrilla en disponibles.";
    return { ok: false, reason: s.lastNotice };
  }
  if (crew.topografos < 1) takeFromReserva(s, crew, "topografos", 1);
  if (crew.capataces < 1) takeFromReserva(s, crew, "capataces", 1);
  if (crew.obreros < 4) takeFromReserva(s, crew, "obreros", 4 - crew.obreros);
  const people = peopleOn(s, id);
  if (people.obreros + people.topografos + people.capataces === 0) {
    s.lastNotice = "Disponibles vacíos.";
    return { ok: false, reason: s.lastNotice };
  }
  s.lastNotice = `${crew.name} ${frontPosting(id)}.`;
  return { ok: true };
}

function staffNewFront(s: GameState, id: StructureId): void {
  const idle =
    s.crews.find((c) => c.front === "reserva" && c.obreros >= 4) ??
    s.crews.find((c) => c.front === "reserva" && crewHeadcount(c) > 0);
  if (!idle) {
    s.lastNotice = "Sin personal en reserva.";
    return;
  }
  idle.front = id;
  if (idle.topografos < 1) takeFromReserva(s, idle, "topografos", 1);
  if (idle.capataces < 1) takeFromReserva(s, idle, "capataces", 1);
  if (idle.obreros < 4) takeFromReserva(s, idle, "obreros", 4 - idle.obreros);
}

export function acceptContract(s: GameState, contractId: string): { ok: boolean; reason?: string } {
  const c = s.contracts.find((x) => x.id === contractId);
  if (!c) return { ok: false, reason: "No existe" };
  if (isV1Contract(c.structureId)) return signFirst(s, c.structureId);
  if (c.status === "cumplido") return { ok: false, reason: "Ya cerrado" };
  if (c.status === "activo") {
    if (!s.structures[c.structureId].opened) openStructure(s, c.structureId);
    return { ok: true };
  }
  const gap = requirementGap(s, c.structureId);
  if (gap) {
    s.lastNotice = gap;
    return { ok: false, reason: gap };
  }
  c.status = "activo";
  c.acceptedDay = clockParts(s.siteMinutes).day;
  openStructure(s, c.structureId);
  return { ok: true };
}

export function openStructure(s: GameState, id: StructureId): void {
  const st = s.structures[id];
  if (st.opened) {
    s.selected = id;
    return;
  }
  st.opened = true;
  st.stage = s.survey >= 1 ? "levantado" : "vacio";
  st.progress = 0;
  st.paidStage = null;
  staffNewFront(s, id);
  s.selected = id;
  if (s.instruction === "define" || s.instruction === "levanta") s.instruction = "dirige";
  if (s.phase < 2 && (id === "camino" || isV1Contract(id))) s.phase = 2;
  refreshContracts(s);
}

export function signFirst(s: GameState, id: StructureId): { ok: boolean; reason?: string } {
  if (s.survey < 1) return { ok: false, reason: "Sin levantar" };
  if (!isV1Contract(id)) return { ok: false, reason: "Fuera de pliego" };
  if (s.structures[id].opened) {
    s.selected = id;
    s.instruction = "dirige";
    return { ok: true };
  }
  const first = !hasSignedFront(s);
  const c = s.contracts.find((x) => x.structureId === id);
  if (c && c.status !== "cumplido" && c.status !== "activo") {
    c.status = "activo";
    c.acceptedDay = clockParts(s.siteMinutes).day;
  }
  openStructure(s, id);
  s.instruction = "dirige";
  if (first) s.clockPace = "normal";
  s.lastNotice = SCRIPT_60.firmado;
  return { ok: true };
}

export function toggleRegime(s: GameState): void {
  s.regime = s.regime === "turno" ? "siempre" : "turno";
  if (s.regime === "siempre") {
    s.lastNotice = s.fatigue > 0.28 ? SCRIPT_60.forzada : "SIEMPRE ABIERTA. Noche de pago. El plazo aprieta.";
  } else {
    s.lastNotice = "TURNO DE OBRA 07–18. De noche la obra espera.";
  }
}

export function composeResumeLine(s: GameState): string {
  const clock = clockParts(s.siteMinutes);
  const signed = V1_CONTRACT_IDS.filter((id) => s.structures[id].opened).map((id) => STRUCTURE_NAME_UP[id]);
  const phase = s.phase === 3 ? "Fase III" : s.phase === 2 ? "Fase II" : "Fase I";
  const fronts = signed.length ? `firmados: ${signed.join(", ")}` : "ningún frente firmado";
  return `REANUDA · Día ${pad2(clock.day)} · ${phase} · ${fronts}`;
}

export function transferTop(s: GameState, from: FrontId, to: FrontId): { ok: boolean; reason?: string } {
  if (from === to) {
    s.lastNotice = "El origen y el destino son el mismo.";
    return { ok: false, reason: s.lastNotice };
  }
  if (to !== "reserva" && to !== "survey" && to !== "ensayo" && !s.structures[to]?.opened) {
    s.lastNotice = "Ese frente aún no está autorizado.";
    return { ok: false, reason: s.lastNotice };
  }
  const src = s.crews.find((c) => c.front === from && c.topografos > 0);
  if (!src) {
    s.lastNotice = `SIN TOP EN ${FRONT_LABEL[from]}`;
    return { ok: false, reason: s.lastNotice };
  }
  let dest = s.crews.find((c) => c.front === to && c.id !== src.id);
  if (!dest) {
    dest = s.crews.find((c) => c.front === "reserva" && c.id !== src.id && crewHeadcount(c) === 0);
    if (dest) dest.front = to;
  }
  if (!dest) dest = s.crews.find((c) => c.front === to);
  if (!dest && crewHeadcount(src) === src.topografos) {
    src.front = to;
    s.lastNotice = `TOP → ${FRONT_LABEL[to]}`;
    return { ok: true };
  }
  if (!dest) {
    s.lastNotice = "No hay cuadrilla de destino.";
    return { ok: false, reason: s.lastNotice };
  }
  src.topografos -= 1;
  dest.topografos += 1;
  s.lastNotice = `TOP → ${FRONT_LABEL[to]}`;
  return { ok: true };
}

export function cycleCrewFront(s: GameState, crewId: string): void {
  const crew = s.crews.find((c) => c.id === crewId);
  if (!crew) return;
  const opened = STRUCTURE_IDS.filter((id) => s.structures[id].opened);
  const options: FrontId[] = ["reserva", ...opened];
  if (s.prototype?.opened && s.prototype.stage !== "conexion") options.push("ensayo");
  const i = options.indexOf(crew.front);
  const next = options[(i + 1) % options.length] ?? "reserva";
  assignCrew(s, crewId, next);
}

export function orderSupply(
  s: GameState,
  kind: "hormigon" | "acero",
): { ok: boolean; reason?: string; received?: string; unused?: string | null } {
  const spec = SUPPLY[kind];
  if (s.resources.dinero < spec.cost) {
    s.lastNotice = `Fondos insuficientes para el ${spec.noun} (${spec.cost}).`;
    return { ok: false, reason: s.lastNotice };
  }
  s.resources.dinero -= spec.cost;
  if (kind === "hormigon") s.resources.hormigon += spec.qty;
  else s.resources.acero += spec.qty;

  if (kind === "acero") {
    s.slowdowns = s.slowdowns.filter((sl) => {
      if (sl.kind !== "material") return true;
      if (sl.target === "site") return false;
      const st = s.structures[sl.target];
      if (!st) return false;
      const need = materialsFor(sl.target, st.stage);
      return s.resources.acero < Math.max(1, need.acero);
    });
  }

  const consumer = STRUCTURE_IDS.find((id) => {
    const st = s.structures[id];
    if (!st.opened || st.stage === "conexion") return false;
    const need = materialsFor(id, st.stage);
    const qty = kind === "acero" ? need.acero : need.hormigon;
    return qty > 0 && st.paidStage !== st.stage;
  });

  let destLabel = "almacén";
  let unused: string | null = null;
  if (consumer) {
    const st = s.structures[consumer];
    const need = materialsFor(consumer, st.stage);
    const qty = kind === "acero" ? need.acero : need.hormigon;
    const have = kind === "acero" ? s.resources.acero : s.resources.hormigon;
    const unit = spec.unit;
    const bottle = bottleneckOf(s, consumer);
    if (have < qty) {
      unused = `Aún no se usa: faltan ${Math.ceil(qty - have)} ${unit}`;
    } else {
      destLabel = `frente ${FRONT_LABEL[consumer]}`;
      if (
        bottle &&
        bottle !== "FALTA ACERO" &&
        bottle !== "FALTA HORMIGÓN" &&
        bottle !== "ARMADO DETENIDO — MATERIAL"
      ) {
        unused = `Aún no se usa: ${bottle}`;
      }
    }
  } else {
    const watch =
      s.selected && s.structures[s.selected]?.opened
        ? s.selected
        : STRUCTURE_IDS.find((id) => {
            const b = bottleneckOf(s, id);
            return b === "FALTA ACERO" || b === "FALTA HORMIGÓN" || b === "ARMADO DETENIDO — MATERIAL";
          });
    const bottle = watch ? bottleneckOf(s, watch) : null;
    unused = bottle ? `Aún no se usa: ${bottle}` : "Aún no se usa: ningún frente carga este material hoy";
  }
  const received = `Material recibido · ${destLabel}`;
  s.lastNotice = received;
  return { ok: true, received, unused };
}

export function startPrototype(s: GameState, name: string, kind: ProtoKind): { ok: boolean; reason?: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    s.lastNotice = "Ponle un nombre a la pieza.";
    return { ok: false, reason: s.lastNotice };
  }
  if (s.prototype?.opened && s.prototype.stage !== "conexion") {
    s.lastNotice = "Ya hay un ensayo en curso.";
    return { ok: false, reason: s.lastNotice };
  }
  s.prototype = {
    name: trimmed.slice(0, 42),
    kind,
    stage: "levantado",
    progress: 0,
    opened: true,
    hoursWorked: 0,
    costAccrued: 0,
  };
  const idle =
    s.crews.find((c) => c.front === "reserva" && crewHeadcount(c) > 0) ??
    s.crews.find((c) => c.front === "reserva");
  if (idle) {
    idle.front = "ensayo";
    if (idle.topografos < 1) takeFromReserva(s, idle, "topografos", 1);
    if (idle.obreros < 3) takeFromReserva(s, idle, "obreros", 3 - idle.obreros);
  }
  s.lastNotice = `Ensayo abierto: ${s.prototype.name}.`;
  return { ok: true };
}

export function protoRitmo(s: GameState): string {
  if (!s.prototype?.opened) return "—";
  const w = productivityWord(productivityRatio(s, "ensayo"));
  const b = protoBottle(s);
  if ((w === "BAJA" || w === "DETENIDA") && b) return `${w} · ${b}`;
  return w;
}

export { protoBottle };
