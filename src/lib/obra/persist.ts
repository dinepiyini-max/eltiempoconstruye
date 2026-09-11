/**
 * Persistencia. Dos cajas, nunca una.
 *
 *   obra.jefe     la partida real. Un visitante no la escribe.
 *   obra.visita   el arenero de ?modo=visita
 *
 * saveState(state, slot)  → escribe SOLO esa caja (+ .bak), snapshot allowlisteado
 * loadState(slot)         → lee SOLO esa caja (jefe también hereda la clave vieja)
 *
 * hydrateParsed no hace spread del JSON crudo. Solo campos de la allowlist.
 */
import {
  CONTRACTS_SEED,
  CREWS_SEED,
  LEGACY_SAVE_KEYS,
  SLOT_KEYS,
  STRUCTURE_DEF,
  STRUCTURE_NAME,
  createInitialState,
  emptyStructure,
} from "./catalog";
import { FRENTE_PLIEGO } from "./pliego";
import type {
  ArchivePlate,
  Contract,
  Crew,
  EventNote,
  FloodStatus,
  FrontId,
  GameState,
  LibretaKind,
  LibretaNote,
  Prototype,
  SaveSlot,
  Slowdown,
  StructureId,
  StructureStage,
  StructureState,
  Totals,
  V1ContractId,
} from "./types";
import { STAGES, STRUCTURE_IDS, V1_CONTRACT_IDS } from "./types";

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

const FRONT_IDS: readonly FrontId[] = [...STRUCTURE_IDS, "survey", "reserva", "ensayo"];

export function readSlotFromSearch(search: string): SaveSlot {
  try {
    return new URLSearchParams(search).get("modo") === "visita" ? "visita" : "jefe";
  } catch {
    return "jefe";
  }
}

/** Snapshot allowlisteado. Nada que no sea GameState entra al disco. */
export function snapshotState(state: GameState): Omit<GameState, "absence" | "lastNotice"> {
  return {
    version: 1,
    page: state.page,
    phase: state.phase,
    regime: state.regime,
    siteMinutes: state.siteMinutes,
    siteRemainder: state.siteRemainder,
    realLastSeen: state.realLastSeen,
    seed: state.seed,
    survey: state.survey,
    surveying: state.surveying,
    instruction: state.instruction,
    selected: state.selected,
    structures: Object.fromEntries(
      STRUCTURE_IDS.map((id) => {
        const st = state.structures[id];
        return [
          id,
          {
            id,
            stage: st.stage,
            progress: st.progress,
            opened: st.opened,
            hoursWorked: st.hoursWorked,
            costAccrued: st.costAccrued,
            paidStage: st.paidStage,
          },
        ];
      }),
    ) as GameState["structures"],
    crews: state.crews.map((c) => ({
      id: c.id,
      name: c.name,
      front: c.front,
      obreros: c.obreros,
      capataces: c.capataces,
      ingenieros: c.ingenieros,
      topografos: c.topografos,
    })),
    resources: {
      dinero: state.resources.dinero,
      horasHombre: state.resources.horasHombre,
      hormigon: state.resources.hormigon,
      acero: state.resources.acero,
      conocimiento: state.resources.conocimiento,
    },
    prestigio: state.prestigio,
    fatigue: state.fatigue,
    contracts: state.contracts.map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
      purpose: c.purpose,
      threat: c.threat,
      cost: c.cost,
      durationDays: c.durationDays,
      difficulty: c.difficulty,
      requiredKnowledge: c.requiredKnowledge,
      prestigio: c.prestigio,
      structureId: c.structureId,
      status: c.status,
      acceptedDay: c.acceptedDay,
    })),
    archive: state.archive.map((p) => ({
      id: p.id,
      structureId: p.structureId,
      name: p.name,
      completedDay: p.completedDay,
      completedClock: p.completedClock,
      materials: p.materials,
      workforce: p.workforce,
      method: p.method,
      cost: p.cost,
      seal: p.seal,
    })),
    events: state.events.map((e) => ({
      id: e.id,
      day: e.day,
      clock: e.clock,
      kind: e.kind,
      title: e.title,
      body: e.body,
      minutesLeft: e.minutesLeft,
      target: e.target,
    })),
    minutesSinceEvent: state.minutesSinceEvent,
    slowdowns: state.slowdowns.map((sl) => ({
      target: sl.target,
      minutesLeft: sl.minutesLeft,
      factor: sl.factor,
      kind: sl.kind,
    })),
    totals: {
      excavado: state.totals.excavado,
      acero: state.totals.acero,
      hormigon: state.totals.hormigon,
      horasHombre: state.totals.horasHombre,
    },
    prototype: state.prototype
      ? {
          name: state.prototype.name,
          kind: state.prototype.kind,
          stage: state.prototype.stage,
          progress: state.prototype.progress,
          opened: state.prototype.opened,
          hoursWorked: state.prototype.hoursWorked,
          costAccrued: state.prototype.costAccrued,
        }
      : null,
    cartaRead: true,
    libreta: state.libreta.map((n) => ({
      id: n.id,
      kind: n.kind,
      line: n.line,
      siteMinutes: n.siteMinutes,
      at: n.at,
      page: n.page,
      front: n.front,
      regime: n.regime,
      coords: n.coords,
    })),
    floodStatus: state.floodStatus,
    clockPace: state.clockPace,
    libretaOpen: state.libretaOpen,
    libretaPinned: state.libretaPinned,
  };
}

export function saveState(state: GameState, slot: SaveSlot): boolean {
  if (typeof window === "undefined") return true;
  try {
    state.realLastSeen = Date.now();
    const snap = snapshotState(state);
    const keys = SLOT_KEYS[slot];
    const prev = window.localStorage.getItem(keys.live);
    if (prev) window.localStorage.setItem(keys.bak, prev);
    window.localStorage.setItem(keys.live, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

export function loadState(slot: SaveSlot): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const keys = SLOT_KEYS[slot];
    const raw = window.localStorage.getItem(keys.live);
    if (raw) {
      const parsed = hydrateParsed(JSON.parse(raw));
      if (parsed) return parsed;
    }
    if (slot === "jefe") {
      const migrated = loadLegacyIntoJefe();
      if (migrated) return migrated;
    }
    const bak = window.localStorage.getItem(keys.bak);
    if (!bak) return null;
    return hydrateParsed(JSON.parse(bak));
  } catch {
    try {
      const bak = window.localStorage.getItem(SLOT_KEYS[slot].bak);
      if (!bak) return null;
      return hydrateParsed(JSON.parse(bak));
    } catch {
      return null;
    }
  }
}

function loadLegacyIntoJefe(): GameState | null {
  for (const key of LEGACY_SAVE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = hydrateParsed(JSON.parse(raw));
      if (!parsed) continue;
      saveState(parsed, "jefe");
      return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

function migrateContracts(old: unknown): Contract[] {
  const prev = Array.isArray(old) ? (old as Contract[]) : [];
  return CONTRACTS_SEED.map((seed) => {
    const frente = FRENTE_PLIEGO[seed.structureId as V1ContractId];
    const c: Contract = {
      ...seed,
      purpose: frente?.purpose ?? seed.purpose,
      threat: frente?.threat ?? seed.threat,
      durationDays: frente?.durationDays ?? seed.durationDays,
      requiredKnowledge: STRUCTURE_DEF[seed.structureId].knowledgeMin,
    };
    const match = prev.find((x) => x.structureId === seed.structureId);
    if (match && (match.status === "activo" || match.status === "cumplido")) {
      c.status = match.status;
      c.acceptedDay = match.acceptedDay;
    }
    return c;
  });
}

function migrateSlowdowns(old: unknown): Slowdown[] {
  if (!Array.isArray(old)) return [];
  const out: Slowdown[] = [];
  for (const item of old) {
    if (!isObject(item)) continue;
    const targetRaw = item.target;
    const target: Slowdown["target"] =
      targetRaw === "site" || (typeof targetRaw === "string" && (STRUCTURE_IDS as readonly string[]).includes(targetRaw))
        ? (targetRaw as Slowdown["target"])
        : "site";
    const kind: Slowdown["kind"] =
      item.kind === "lluvia" ||
      item.kind === "suelo" ||
      item.kind === "material" ||
      item.kind === "inspeccion" ||
      item.kind === "diseno" ||
      item.kind === "crecida"
        ? item.kind
        : num(item.factor, 1) === 0
          ? "material"
          : num(item.factor, 1) < 0.6
            ? "lluvia"
            : "suelo";
    out.push({
      target,
      minutesLeft: num(item.minutesLeft, 0),
      factor: num(item.factor, 1),
      kind,
    });
  }
  return out;
}

function migrateArchive(old: unknown): ArchivePlate[] {
  if (!Array.isArray(old)) return [];
  const out: ArchivePlate[] = [];
  for (const item of old) {
    if (!isObject(item)) continue;
    const sid = item.structureId;
    const structureId: ArchivePlate["structureId"] =
      sid === "ensayo" || sid === "valle" || (typeof sid === "string" && (STRUCTURE_IDS as readonly string[]).includes(sid))
        ? (sid as ArchivePlate["structureId"])
        : "valle";
    const seal =
      item.seal === "a-salvo" || item.seal === "incumplido" || item.seal === "tardio" ? item.seal : undefined;
    out.push({
      id: typeof item.id === "string" && item.id ? item.id : `A-${String(out.length + 1).padStart(2, "0")}`,
      structureId,
      name:
        typeof item.name === "string" && item.name
          ? item.name
          : structureId === "ensayo"
            ? "Ensayo"
            : structureId === "valle"
              ? "Valle del Yuna"
              : STRUCTURE_NAME[structureId] || "Pieza",
      completedDay: num(item.completedDay, 1),
      completedClock: typeof item.completedClock === "string" ? item.completedClock : "",
      materials: typeof item.materials === "string" ? item.materials : "",
      workforce: typeof item.workforce === "string" ? item.workforce : "",
      method: typeof item.method === "string" ? item.method : "",
      cost: num(item.cost, 0),
      seal,
    });
  }
  return out;
}

function migratePrototype(old: unknown): Prototype | null {
  if (!old || typeof old !== "object") return null;
  const p = old as Record<string, unknown>;
  if (typeof p.name !== "string" || !p.name) return null;
  const kind = p.kind;
  if (kind !== "casa" && kind !== "nave" && kind !== "torre" && kind !== "muelle" && kind !== "puente") return null;
  const stage: StructureStage = STAGES.includes(p.stage as StructureStage) ? (p.stage as StructureStage) : "levantado";
  return {
    name: p.name.slice(0, 42),
    kind,
    stage,
    progress: num(p.progress, 0),
    opened: p.opened !== false,
    hoursWorked: num(p.hoursWorked, 0),
    costAccrued: num(p.costAccrued, 0),
  };
}

function migrateStructures(old: unknown): Record<StructureId, StructureState> {
  const prev = isObject(old) ? old : {};
  const out = {} as Record<StructureId, StructureState>;
  for (const id of STRUCTURE_IDS) {
    const raw = prev[id];
    const extra = isObject(raw) ? raw : {};
    const stage: StructureStage = STAGES.includes(extra.stage as StructureStage)
      ? (extra.stage as StructureStage)
      : "vacio";
    const paidStage: StructureStage | null = STAGES.includes(extra.paidStage as StructureStage)
      ? (extra.paidStage as StructureStage)
      : null;
    const progress = Math.max(0, num(extra.progress, 0));
    const opened = extra.opened === true;
    const st: StructureState = {
      id,
      stage: opened ? stage : emptyStructure(id).stage,
      progress: opened ? progress : 0,
      opened,
      hoursWorked: num(extra.hoursWorked, 0),
      costAccrued: num(extra.costAccrued, 0),
      paidStage: opened ? paidStage : null,
    };
    if (st.opened && st.paidStage == null && st.progress > 0) {
      st.paidStage = st.stage;
    }
    if (!st.opened) {
      st.stage = "vacio";
      st.progress = 0;
      st.paidStage = null;
    }
    out[id] = st;
  }
  return out;
}

function migrateCrews(old: unknown): Crew[] {
  if (!Array.isArray(old) || old.length === 0) return CREWS_SEED.map((c) => ({ ...c }));
  return (old as unknown[]).map((item, i) => {
    const c = isObject(item) ? item : {};
    const front: FrontId = FRONT_IDS.includes(c.front as FrontId) ? (c.front as FrontId) : "reserva";
    return {
      id: typeof c.id === "string" && c.id ? c.id : `c${String(i + 1).padStart(2, "0")}`,
      name: typeof c.name === "string" && c.name ? c.name : `CUADRILLA ${String(i + 1).padStart(2, "0")}`,
      front,
      obreros: Math.max(0, num(c.obreros, 0)),
      capataces: Math.max(0, num(c.capataces, 0)),
      ingenieros: Math.max(0, num(c.ingenieros, 0)),
      topografos: Math.max(0, num(c.topografos, 0)),
    };
  });
}

const KINDS: LibretaKind[] = ["BUG", "MEJORA", "DUDA", "NOTA"];
const PAGES: GameState["page"][] = ["plano", "obra", "contratos", "archivo"];

export function migrateLibreta(old: unknown): LibretaNote[] {
  if (!Array.isArray(old)) return [];
  const out: LibretaNote[] = [];
  for (const item of old) {
    if (!isObject(item)) continue;
    const kind = KINDS.includes(item.kind as LibretaKind) ? (item.kind as LibretaKind) : null;
    const line =
      typeof item.line === "string"
        ? item.line.trim().slice(0, 240)
        : typeof item.text === "string"
          ? item.text.trim().slice(0, 240)
          : typeof item.body === "string"
            ? item.body.trim().slice(0, 240)
            : "";
    if (!kind || !line) continue;
    const page = PAGES.includes(item.page as GameState["page"]) ? (item.page as GameState["page"]) : "plano";
    const front =
      typeof item.front === "string" && (STRUCTURE_IDS as readonly string[]).includes(item.front)
        ? (item.front as StructureId)
        : null;
    const coords =
      isObject(item.coords) && typeof item.coords.x === "number" && typeof item.coords.y === "number"
        ? { x: item.coords.x, y: item.coords.y }
        : null;
    out.push({
      id: typeof item.id === "string" && item.id ? item.id : `n-${item.at ?? out.length}`,
      kind,
      line,
      siteMinutes: typeof item.siteMinutes === "number" ? item.siteMinutes : 0,
      at: typeof item.at === "number" ? item.at : 0,
      page,
      front,
      regime: item.regime === "siempre" ? "siempre" : "turno",
      coords,
    });
  }
  return out;
}

function migratePage(page: unknown): GameState["page"] {
  if (page === "obra" || page === "contratos" || page === "archivo") return page;
  return "plano";
}

function migratePace(raw: unknown): GameState["clockPace"] {
  if (raw === "lento" || raw === "pausa" || raw === "normal") return raw;
  return "normal";
}

function migrateFlood(raw: unknown): FloodStatus {
  if (raw === "a-salvo" || raw === "incumplido" || raw === "pendiente") return raw;
  return "pendiente";
}

const EVENT_KINDS = ["lluvia", "suelo", "material", "inspeccion", "diseno", "crecida"] as const;

function migrateEvents(old: unknown): EventNote[] {
  if (!Array.isArray(old)) return [];
  const out: EventNote[] = [];
  for (const item of old) {
    if (!isObject(item)) continue;
    if (!EVENT_KINDS.includes(item.kind as (typeof EVENT_KINDS)[number])) continue;
    const targetRaw = item.target;
    const target: EventNote["target"] =
      targetRaw === "site" || (typeof targetRaw === "string" && (STRUCTURE_IDS as readonly string[]).includes(targetRaw))
        ? (targetRaw as EventNote["target"])
        : null;
    out.push({
      id: typeof item.id === "string" && item.id ? item.id : `n-${out.length}`,
      day: num(item.day, 1),
      clock: typeof item.clock === "string" ? item.clock : "",
      kind: item.kind as EventNote["kind"],
      title: typeof item.title === "string" ? item.title : "",
      body: typeof item.body === "string" ? item.body : "",
      minutesLeft: num(item.minutesLeft, 0),
      target,
    });
  }
  return out;
}

function migrateResources(old: unknown, base: GameState["resources"]): GameState["resources"] {
  const r = isObject(old) ? old : {};
  return {
    dinero: num(r.dinero, base.dinero),
    horasHombre: num(r.horasHombre, base.horasHombre),
    hormigon: num(r.hormigon, base.hormigon),
    acero: num(r.acero, base.acero),
    conocimiento: num(r.conocimiento, base.conocimiento),
  };
}

function migrateTotals(old: unknown, base: Totals): Totals {
  const t = isObject(old) ? old : {};
  return {
    excavado: num(t.excavado, base.excavado),
    acero: num(t.acero, base.acero),
    hormigon: num(t.hormigon, base.hormigon),
    horasHombre: num(t.horasHombre, base.horasHombre),
  };
}

export function hydrateParsed(parsed: unknown): GameState | null {
  if (!isObject(parsed) || parsed.version !== 1) return null;
  const base = createInitialState();
  const structures = migrateStructures(parsed.structures);
  const survey = num(parsed.survey, base.survey);
  const anyOpen = V1_CONTRACT_IDS.some((id) => structures[id]?.opened);
  let instruction: GameState["instruction"];
  if (anyOpen) instruction = "dirige";
  else if (survey >= 1) instruction = "define";
  else instruction = "levanta";
  const selected =
    typeof parsed.selected === "string" && (STRUCTURE_IDS as readonly string[]).includes(parsed.selected)
      ? (parsed.selected as StructureId)
      : null;
  const libretaSrc = parsed.libreta ?? parsed.notas;
  const oldPage = parsed.page;
  const openedDock = oldPage === "libreta" || oldPage === "notas" || Boolean(parsed.libretaOpen);
  const phase: GameState["phase"] = parsed.phase === 2 || parsed.phase === 3 ? parsed.phase : anyOpen ? 2 : 1;
  const contracts = migrateContracts(parsed.contracts).filter((c) =>
    (V1_CONTRACT_IDS as readonly string[]).includes(c.structureId),
  );

  return {
    version: 1,
    page: migratePage(parsed.page),
    phase,
    regime: parsed.regime === "siempre" ? "siempre" : "turno",
    siteMinutes: num(parsed.siteMinutes, base.siteMinutes),
    siteRemainder: num(parsed.siteRemainder, 0),
    realLastSeen: num(parsed.realLastSeen, Date.now()),
    seed: num(parsed.seed, base.seed),
    survey,
    surveying: parsed.surveying === true && survey < 1,
    instruction,
    selected,
    structures,
    crews: migrateCrews(parsed.crews),
    resources: migrateResources(parsed.resources, base.resources),
    prestigio: num(parsed.prestigio, 0),
    fatigue: Math.min(1, Math.max(0, num(parsed.fatigue, 0))),
    contracts,
    archive: migrateArchive(parsed.archive),
    events: migrateEvents(parsed.events),
    minutesSinceEvent: num(parsed.minutesSinceEvent, base.minutesSinceEvent),
    slowdowns: migrateSlowdowns(parsed.slowdowns),
    totals: migrateTotals(parsed.totals, base.totals),
    absence: null,
    lastNotice: null,
    prototype: migratePrototype(parsed.prototype),
    cartaRead: true,
    libreta: migrateLibreta(libretaSrc),
    floodStatus: migrateFlood(parsed.floodStatus),
    clockPace: anyOpen ? migratePace(parsed.clockPace) : "pausa",
    libretaOpen: openedDock,
    libretaPinned: parsed.libretaPinned === true,
  };
}

export function clearSave(slot: SaveSlot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SLOT_KEYS[slot].live);
    window.localStorage.removeItem(SLOT_KEYS[slot].bak);
  } catch {
    /* ignore */
  }
}

export function peekLibreta(slot: SaveSlot): LibretaNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SLOT_KEYS[slot].live);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { libreta?: unknown; notas?: unknown };
    return migrateLibreta(parsed.libreta ?? parsed.notas);
  } catch {
    return [];
  }
}
