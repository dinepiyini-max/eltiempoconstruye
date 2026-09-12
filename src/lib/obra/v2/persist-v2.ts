/**
 * Persistencia de NUEVA OBRA.
 * Clave fija: obra.v2  (+ obra.v2.bak)
 * Nunca escribe obra.jefe ni obra.visita.
 */
import { createHueco, createMuro, type Hueco, type HuecoKind, type Muro, type Pt } from "./geometry.ts";
import { V2_HUECO, V2_MURO } from "./tables.ts";

export const V2_LIVE_KEY = "obra.v2";
export const V2_BAK_KEY = "obra.v2.bak";
export const V2_PRODUCT = "obra.v2" as const;
export const V2_DOC_VERSION = 1 as const;

export type V2View = {
  panX: number;
  panY: number;
  ppm: number;
};

export type V2Document = {
  product: typeof V2_PRODUCT;
  version: typeof V2_DOC_VERSION;
  walls: Muro[];
  openings: Hueco[];
  nextSeq: number;
  nextHuecoSeq: number;
  view: V2View | null;
};

export type V2Storage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function pt(v: unknown): Pt | null {
  if (!isObject(v)) return null;
  if (typeof v.x !== "number" || typeof v.y !== "number") return null;
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
  return { x: v.x, y: v.y };
}

export function emptyV2(): V2Document {
  return {
    product: V2_PRODUCT,
    version: V2_DOC_VERSION,
    walls: [],
    openings: [],
    nextSeq: 1,
    nextHuecoSeq: 1,
    view: null,
  };
}

export function snapshotV2(doc: V2Document): V2Document {
  return {
    product: V2_PRODUCT,
    version: V2_DOC_VERSION,
    walls: doc.walls.map((m) => createMuro(m.a, m.b, m.id, m.espesor)),
    openings: doc.openings.map((h) => createHueco(h.kind, h.wallId, h.alongM, h.id, h.ancho)),
    nextSeq: doc.nextSeq,
    nextHuecoSeq: doc.nextHuecoSeq,
    view: doc.view ? { panX: doc.view.panX, panY: doc.view.panY, ppm: doc.view.ppm } : null,
  };
}

function migrateWalls(raw: unknown): Muro[] {
  if (!Array.isArray(raw)) return [];
  const out: Muro[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const a = pt(item.a);
    const b = pt(item.b);
    if (!a || !b) continue;
    const id = typeof item.id === "string" && item.id ? item.id : `M-${String(out.length + 1).padStart(3, "0")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const espesor = Math.max(0.05, num(item.espesor, V2_MURO.espesorM));
    out.push(createMuro(a, b, id, espesor));
  }
  return out;
}

function migrateKind(v: unknown): HuecoKind | null {
  return v === "puerta" || v === "ventana" ? v : null;
}

function migrateOpenings(raw: unknown, walls: readonly Muro[]): Hueco[] {
  if (!Array.isArray(raw)) return [];
  const wallIds = new Set(walls.map((m) => m.id));
  const out: Hueco[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const kind = migrateKind(item.kind);
    const wallId = typeof item.wallId === "string" ? item.wallId : "";
    if (!kind || !wallId || !wallIds.has(wallId)) continue;
    const id =
      typeof item.id === "string" && item.id
        ? item.id
        : `${kind === "puerta" ? "P" : "V"}-${String(out.length + 1).padStart(3, "0")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const def = kind === "puerta" ? V2_HUECO.puerta.anchoM : V2_HUECO.ventana.anchoM;
    const ancho = Math.max(0.3, num(item.ancho, def));
    const alongM = num(item.alongM, NaN);
    if (!Number.isFinite(alongM)) continue;
    out.push(createHueco(kind, wallId, alongM, id, ancho));
  }
  return out;
}

function migrateView(raw: unknown): V2View | null {
  if (!isObject(raw)) return null;
  const ppm = num(raw.ppm, 0);
  if (ppm < 4 || ppm > 160) return null;
  return { panX: num(raw.panX, 0), panY: num(raw.panY, 0), ppm };
}

function seqFromIds(ids: readonly string[], prefix: RegExp, fallback: number): number {
  let next = Math.max(1, Math.floor(fallback));
  for (const id of ids) {
    const n = Number(String(id).replace(prefix, ""));
    if (Number.isFinite(n)) next = Math.max(next, n + 1);
  }
  return next;
}

export function hydrateV2(parsed: unknown): V2Document | null {
  if (!isObject(parsed)) return null;
  if (parsed.product !== V2_PRODUCT) return null;
  if (parsed.version !== V2_DOC_VERSION) return null;
  const walls = migrateWalls(parsed.walls);
  const openings = migrateOpenings(parsed.openings, walls);
  const nextSeq = seqFromIds(
    walls.map((w) => w.id),
    /^M-/,
    num(parsed.nextSeq, 1),
  );
  const nextHuecoSeq = seqFromIds(
    openings.map((h) => h.id),
    /^[PV]-/,
    num(parsed.nextHuecoSeq, 1),
  );
  return {
    product: V2_PRODUCT,
    version: V2_DOC_VERSION,
    walls,
    openings,
    nextSeq,
    nextHuecoSeq,
    view: migrateView(parsed.view),
  };
}

function browserStorage(): V2Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Escribe SOLO obra.v2 / obra.v2.bak. */
export function saveV2(doc: V2Document, storage: V2Storage | null = browserStorage()): boolean {
  if (!storage) return true;
  try {
    const snap = snapshotV2(doc);
    const prev = storage.getItem(V2_LIVE_KEY);
    if (prev) storage.setItem(V2_BAK_KEY, prev);
    storage.setItem(V2_LIVE_KEY, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

export function loadV2(storage: V2Storage | null = browserStorage()): V2Document {
  const empty = emptyV2();
  if (!storage) return empty;
  try {
    const raw = storage.getItem(V2_LIVE_KEY);
    if (raw) {
      const parsed = hydrateV2(JSON.parse(raw));
      if (parsed) return parsed;
    }
    const bak = storage.getItem(V2_BAK_KEY);
    if (!bak) return empty;
    return hydrateV2(JSON.parse(bak)) ?? empty;
  } catch {
    return empty;
  }
}

export const V2_FORBIDDEN_KEYS = ["obra.jefe", "obra.visita", "obra.jefe.bak", "obra.visita.bak"] as const;
