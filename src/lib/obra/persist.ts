/**
 * Persistencia. Dos cajas, nunca una.
 *
 *   obra.jefe     la partida real. Un visitante no la escribe.
 *   obra.visita   el arenero de ?modo=visita
 *
 * saveState(state, slot)  → escribe SOLO esa caja (+ .bak)
 * loadState(slot)         → lee SOLO esa caja (jefe también hereda la clave vieja)
 *
 * hydrateParsed rellena huecos de partidas viejas. Si un campo falta,
 * se toma de createInitialState(). Las estructuras se mezclan pieza a pieza
 * para que un JSON a medias no deje un puente sin `stage`.
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
  FloodStatus,
  GameState,
  LibretaKind,
  LibretaNote,
  Prototype,
  SaveSlot,
  Slowdown,
  StructureId,
  StructureState,
  V1ContractId,
} from "./types";
import { STRUCTURE_IDS, V1_CONTRACT_IDS } from "./types";

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

export function readSlotFromSearch(search: string): SaveSlot {
  try {
    return new URLSearchParams(search).get("modo") === "visita" ? "visita" : "jefe";
  } catch {
    return "jefe";
  }
}

export function saveState(state: GameState, slot: SaveSlot): boolean {
  if (typeof window === "undefined") return true;
  try {
    state.realLastSeen = Date.now();
    const snap = { ...state, absence: null };
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
  return (old as Slowdown[]).map((sl) => ({
    target: sl.target,
    minutesLeft: sl.minutesLeft,
    factor: sl.factor,
    kind: sl.kind ?? (sl.factor < 0.6 ? "lluvia" : sl.factor === 0 ? "material" : "suelo"),
  }));
}

function migrateArchive(old: unknown): ArchivePlate[] {
  if (!Array.isArray(old)) return [];
  return (old as ArchivePlate[]).map((p) => ({
    ...p,
    name:
      p.name ||
      (p.structureId === "ensayo"
        ? "Ensayo"
        : p.structureId === "valle"
          ? "Valle del Yuna"
          : STRUCTURE_NAME[p.structureId as StructureId] || "Pieza"),
  }));
}

function migratePrototype(old: unknown): Prototype | null {
  if (!old || typeof old !== "object") return null;
  const p = old as Prototype;
  if (!p.name || !p.kind) return null;
  return {
    name: p.name,
    kind: p.kind,
    stage: p.stage ?? "levantado",
    progress: p.progress ?? 0,
    opened: p.opened ?? true,
    hoursWorked: p.hoursWorked ?? 0,
    costAccrued: p.costAccrued ?? 0,
  };
}

function migrateStructures(old: unknown): Record<StructureId, StructureState> {
  const prev = isObject(old) ? old : {};
  const out = {} as Record<StructureId, StructureState>;
  for (const id of STRUCTURE_IDS) {
    const raw = prev[id];
    const extra = isObject(raw) ? (raw as Partial<StructureState>) : {};
    out[id] = {
      ...emptyStructure(id),
      ...extra,
      id,
    };
    if (out[id].paidStage == null && Number(out[id].progress) > 0) {
      out[id].paidStage = out[id].stage;
    }
  }
  return out;
}

function migrateCrews(old: unknown): Crew[] {
  if (!Array.isArray(old) || old.length === 0) return CREWS_SEED.map((c) => ({ ...c }));
  return (old as Crew[]).map((c, i) => ({
    id: typeof c.id === "string" && c.id ? c.id : `c${String(i + 1).padStart(2, "0")}`,
    name: typeof c.name === "string" && c.name ? c.name : `CUADRILLA ${String(i + 1).padStart(2, "0")}`,
    front: c.front ?? "reserva",
    obreros: Number(c.obreros) || 0,
    capataces: Number(c.capataces) || 0,
    ingenieros: Number(c.ingenieros) || 0,
    topografos: Number(c.topografos) || 0,
  }));
}

const KINDS: LibretaKind[] = ["BUG", "MEJORA", "DUDA", "NOTA"];
const PAGES: GameState["page"][] = ["plano", "obra", "contratos", "archivo"];

export function migrateLibreta(old: unknown): LibretaNote[] {
  if (!Array.isArray(old)) return [];
  const out: LibretaNote[] = [];
  for (const item of old) {
    if (!isObject(item)) continue;
    const kind = KINDS.includes(item.kind as LibretaKind)
      ? (item.kind as LibretaKind)
      : null;
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

export function hydrateParsed(parsed: unknown): GameState | null {
  if (!isObject(parsed) || parsed.version !== 1) return null;
  const base = createInitialState();
  const p = parsed as Partial<GameState> & {
    page?: unknown;
    structures?: unknown;
    crews?: unknown;
    notas?: unknown;
    floodStatus?: unknown;
  };
  const contracts = migrateContracts(p.contracts);
  const allowed = new Set<string>(V1_CONTRACT_IDS);
  const structures = migrateStructures(p.structures);
  const survey = typeof p.survey === "number" ? p.survey : base.survey;
  const anyOpen = V1_CONTRACT_IDS.some((id) => structures[id]?.opened);
  let instruction: GameState["instruction"];
  if (anyOpen) instruction = "dirige";
  else if (survey >= 1) instruction = "define";
  else instruction = "levanta";
  const selected =
    p.selected && (STRUCTURE_IDS as readonly string[]).includes(p.selected) ? p.selected : null;
  const libretaSrc = (p as { libreta?: unknown }).libreta ?? p.notas;
  const oldPage = p.page as unknown;
  const openedDock = oldPage === "libreta" || oldPage === "notas" || Boolean(p.libretaOpen);
  return {
    ...base,
    ...p,
    version: 1,
    page: migratePage(p.page),
    absence: null,
    lastNotice: null,
    survey,
    instruction,
    selected,
    prototype: migratePrototype(p.prototype),
    cartaRead: true,
    libreta: migrateLibreta(libretaSrc),
    floodStatus: migrateFlood(p.floodStatus),
    clockPace: anyOpen ? migratePace((p as { clockPace?: unknown }).clockPace) : "pausa",
    libretaOpen: openedDock,
    libretaPinned: Boolean(p.libretaPinned),
    resources: { ...base.resources, ...(p.resources ?? {}) },
    totals: { ...base.totals, ...(p.totals ?? {}) },
    structures,
    crews: migrateCrews(p.crews),
    contracts: contracts.filter((c) => allowed.has(c.structureId)),
    events: Array.isArray(p.events)
      ? p.events.filter((e) => e && EVENT_KINDS.includes(e.kind as (typeof EVENT_KINDS)[number]))
      : [],
    archive: migrateArchive(p.archive),
    slowdowns: migrateSlowdowns(p.slowdowns),
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
