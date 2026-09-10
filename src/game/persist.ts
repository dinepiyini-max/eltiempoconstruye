import {
  DRAFT_KEY,
  INITIAL_CONTRACTS,
  INITIAL_CREWS,
  LEGACY_KEYS,
  PAGES,
  STORAGE,
  STRUCTURES,
} from "./catalog.ts";
import { emptyStructure, newGame } from "./sim.ts";
import {
  PLIEGO_IDS,
  STAGES,
  STRUCTURE_IDS,
  type ClockPace,
  type Crew,
  type FloodStatus,
  type Game,
  type Note,
  type NoteKind,
  type Page,
  type Prototype,
  type Slot,
  type Slowdown,
  type Stage,
  type StructureId,
  type StructureState,
} from "./types.ts";

const NOTE_KINDS: NoteKind[] = ["BUG", "MEJORA", "DUDA", "NOTA"];

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

export function slotFromSearch(search: string): Slot {
  try {
    return new URLSearchParams(search).get("modo") === "visita"
      ? "visita"
      : "jefe";
  } catch {
    return "jefe";
  }
}

export function currentSlot(): Slot {
  if (typeof window === "undefined") return "jefe";
  return slotFromSearch(window.location.search);
}

function pageOf(v: unknown): Page {
  return v === "obra" || v === "contratos" || v === "archivo" ? v : "plano";
}

function paceOf(v: unknown): ClockPace {
  return v === "lento" || v === "pausa" || v === "normal" ? v : "normal";
}

function floodOf(v: unknown): FloodStatus {
  return v === "a-salvo" || v === "incumplido" || v === "pendiente"
    ? v
    : "pendiente";
}

function parseNotes(raw: unknown): Note[] {
  if (!Array.isArray(raw)) return [];
  const out: Note[] = [];
  for (const n of raw) {
    if (!isObj(n)) continue;
    const kind = NOTE_KINDS.includes(n.kind as NoteKind)
      ? (n.kind as NoteKind)
      : null;
    const line =
      typeof n.line === "string"
        ? n.line.trim().slice(0, 240)
        : typeof n.text === "string"
          ? n.text.trim().slice(0, 240)
          : typeof n.body === "string"
            ? n.body.trim().slice(0, 240)
            : "";
    if (!kind || !line) continue;
    const page = PAGES.includes(n.page as Page) ? (n.page as Page) : "plano";
    const front =
      typeof n.front === "string" &&
      (STRUCTURE_IDS as readonly string[]).includes(n.front)
        ? (n.front as StructureId)
        : null;
    const coords =
      isObj(n.coords) &&
      typeof n.coords.x === "number" &&
      typeof n.coords.y === "number"
        ? { x: n.coords.x, y: n.coords.y }
        : null;
    out.push({
      id: typeof n.id === "string" && n.id ? n.id : `n-${n.at ?? out.length}`,
      kind,
      line,
      siteMinutes: typeof n.siteMinutes === "number" ? n.siteMinutes : 0,
      at: typeof n.at === "number" ? n.at : 0,
      page,
      front,
      regime: n.regime === "siempre" ? "siempre" : "turno",
      coords,
    });
  }
  return out;
}

function parseCrews(raw: unknown): Crew[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return INITIAL_CREWS.map((c) => ({ ...c }));
  }
  return raw.map((c, i) => {
    const o = isObj(c) ? c : {};
    return {
      id:
        typeof o.id === "string" && o.id
          ? o.id
          : `c${String(i + 1).padStart(2, "0")}`,
      name:
        typeof o.name === "string" && o.name
          ? o.name
          : `CUADRILLA ${String(i + 1).padStart(2, "0")}`,
      front: (o.front as Crew["front"]) ?? "reserva",
      obreros: Number(o.obreros) || 0,
      capataces: Number(o.capataces) || 0,
      ingenieros: Number(o.ingenieros) || 0,
      topografos: Number(o.topografos) || 0,
    };
  });
}

function parseStructures(raw: unknown): Game["structures"] {
  const src = isObj(raw) ? raw : {};
  const out = {} as Game["structures"];
  for (const id of STRUCTURE_IDS) {
    const s = isObj(src[id]) ? src[id] : {};
    const stage = STAGES.includes(s.stage as Stage)
      ? (s.stage as Stage)
      : "vacio";
    const progress = typeof s.progress === "number" ? s.progress : 0;
    const paidRaw = s.paidStage;
    const paidStage = STAGES.includes(paidRaw as Stage)
      ? (paidRaw as Stage)
      : progress > 0
        ? stage
        : null;
    out[id] = {
      ...emptyStructure(id),
      ...(s as Partial<StructureState>),
      id,
      stage,
      progress,
      paidStage,
    };
  }
  return out;
}

function parsePrototype(raw: unknown): Prototype | null {
  if (!isObj(raw) || !raw.name || !raw.kind) return null;
  return {
    name: String(raw.name),
    kind: String(raw.kind),
    stage: (raw.stage as Stage) ?? "levantado",
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    opened: !!raw.opened,
    hoursWorked: typeof raw.hoursWorked === "number" ? raw.hoursWorked : 0,
    costAccrued: typeof raw.costAccrued === "number" ? raw.costAccrued : 0,
  };
}

function parseContracts(raw: unknown): Game["contracts"] {
  const saved = Array.isArray(raw) ? raw : [];
  return INITIAL_CONTRACTS.map((base) => {
    const spec = {
      ...base,
      purpose: base.purpose,
      threat: base.threat,
      durationDays: base.durationDays,
      requiredKnowledge: STRUCTURES[base.structureId].knowledgeMin,
    };
    const hit = saved.find(
      (c) => isObj(c) && c.structureId === base.structureId,
    ) as Record<string, unknown> | undefined;
    if (hit && (hit.status === "activo" || hit.status === "cumplido")) {
      spec.status = hit.status;
      spec.acceptedDay =
        typeof hit.acceptedDay === "number" ? hit.acceptedDay : null;
    }
    return spec;
  }).filter((c) => (PLIEGO_IDS as readonly string[]).includes(c.structureId));
}

const EVENT_KINDS = [
  "lluvia",
  "suelo",
  "material",
  "inspeccion",
  "diseno",
  "crecida",
] as const;

function parseSlowdowns(raw: unknown): Slowdown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const o = isObj(s) ? s : {};
    const factor = typeof o.factor === "number" ? o.factor : 1;
    return {
      target: (o.target as Slowdown["target"]) ?? "site",
      minutesLeft: typeof o.minutesLeft === "number" ? o.minutesLeft : 0,
      factor,
      kind:
        (o.kind as Slowdown["kind"]) ??
        (factor < 0.6 ? "lluvia" : factor === 0 ? "material" : "suelo"),
    };
  });
}

export function hydrateGame(raw: unknown): Game | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const fresh = newGame();
  const structures = parseStructures(raw.structures);
  const survey = typeof raw.survey === "number" ? raw.survey : fresh.survey;
  const opened = PLIEGO_IDS.some((id) => structures[id]?.opened);
  const instruction = opened ? "dirige" : survey >= 1 ? "define" : "levanta";
  const selected =
    typeof raw.selected === "string" &&
    (STRUCTURE_IDS as readonly string[]).includes(raw.selected)
      ? (raw.selected as StructureId)
      : null;
  const notes = parseNotes(raw.libreta ?? raw.notas);
  const pageRaw = raw.page;
  const libretaOpen =
    pageRaw === "libreta" || pageRaw === "notas" || !!raw.libretaOpen;
  return {
    ...fresh,
    ...(raw as Partial<Game>),
    version: 1,
    page: pageOf(raw.page),
    absence: null,
    lastNotice: null,
    survey,
    instruction,
    selected,
    prototype: parsePrototype(raw.prototype),
    cartaRead: true,
    libreta: notes,
    floodStatus: floodOf(raw.floodStatus),
    clockPace: paceOf(raw.clockPace),
    libretaOpen,
    libretaPinned: !!raw.libretaPinned,
    resources: { ...fresh.resources, ...((raw.resources as Game["resources"]) ?? {}) },
    totals: { ...fresh.totals, ...((raw.totals as Game["totals"]) ?? {}) },
    structures,
    crews: parseCrews(raw.crews),
    contracts: parseContracts(raw.contracts),
    events: Array.isArray(raw.events)
      ? raw.events.filter(
          (e) => isObj(e) && EVENT_KINDS.includes(e.kind as (typeof EVENT_KINDS)[number]),
        )
      : [],
    archive: Array.isArray(raw.archive)
      ? raw.archive.map((a) => {
          const o = isObj(a) ? a : {};
          return {
            id: String(o.id ?? "A-01"),
            structureId: (o.structureId as Game["archive"][number]["structureId"]) ?? "camino",
            name:
              typeof o.name === "string" && o.name
                ? o.name
                : o.structureId === "ensayo"
                  ? "Ensayo"
                  : o.structureId === "valle"
                    ? "Valle del Yuna"
                    : "Pieza",
            completedDay: Number(o.completedDay) || 1,
            completedClock: String(o.completedClock ?? ""),
            materials: String(o.materials ?? ""),
            workforce: String(o.workforce ?? ""),
            method: String(o.method ?? ""),
            cost: Number(o.cost) || 0,
            seal: o.seal as Game["archive"][number]["seal"],
          };
        })
      : [],
    slowdowns: parseSlowdowns(raw.slowdowns),
  };
}

export function saveGame(game: Game, slot: Slot): void {
  if (typeof window === "undefined") return;
  try {
    game.realLastSeen = Date.now();
    const payload = { ...game, absence: null };
    const keys = STORAGE[slot];
    const prev = window.localStorage.getItem(keys.live);
    if (prev) window.localStorage.setItem(keys.bak, prev);
    window.localStorage.setItem(keys.live, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

function loadLegacy(): Game | null {
  if (typeof window === "undefined") return null;
  for (const k of LEGACY_KEYS) {
    try {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const g = hydrateGame(JSON.parse(raw));
      if (!g) continue;
      saveGame(g, "jefe");
      return g;
    } catch {
      continue;
    }
  }
  return null;
}

export function loadGame(slot: Slot): Game | null {
  if (typeof window === "undefined") return null;
  try {
    const keys = STORAGE[slot];
    const live = window.localStorage.getItem(keys.live);
    if (live) {
      const g = hydrateGame(JSON.parse(live));
      if (g) return g;
    }
    if (slot === "jefe") {
      const legacy = loadLegacy();
      if (legacy) return legacy;
    }
    const bak = window.localStorage.getItem(keys.bak);
    return bak ? hydrateGame(JSON.parse(bak)) : null;
  } catch {
    try {
      const bak = window.localStorage.getItem(STORAGE[slot].bak);
      return bak ? hydrateGame(JSON.parse(bak)) : null;
    } catch {
      return null;
    }
  }
}

export function loadNotes(slot: Slot): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE[slot].live);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { libreta?: unknown; notas?: unknown };
    return parseNotes(parsed.libreta ?? parsed.notas);
  } catch {
    return [];
  }
}

export type Draft = { kind: NoteKind; line: string };

export function loadDraft(slot: Slot): Draft {
  if (typeof window === "undefined") return { kind: "NOTA", line: "" };
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY(slot));
    if (!raw) return { kind: "NOTA", line: "" };
    const p = JSON.parse(raw) as { kind?: unknown; line?: unknown };
    const kind = NOTE_KINDS.includes(p.kind as NoteKind)
      ? (p.kind as NoteKind)
      : "NOTA";
    const line = typeof p.line === "string" ? p.line.slice(0, 240) : "";
    return { kind, line };
  } catch {
    return { kind: "NOTA", line: "" };
  }
}

export function saveDraft(slot: Slot, draft: Draft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY(slot), JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

export function clearDraft(slot: Slot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY(slot));
  } catch {
    /* */
  }
}
