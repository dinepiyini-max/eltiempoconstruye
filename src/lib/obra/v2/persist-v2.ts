/**
 * Persistencia de NUEVA OBRA.
 * Clave fija: obra.v2  (+ obra.v2.bak)
 * Nunca escribe obra.jefe ni obra.visita.
 */
import {
  createColumna,
  createHueco,
  createLosa,
  createMuro,
  createViga,
  createZapata,
  losaArea,
  muroLargo,
  type Columna,
  type Hueco,
  type HuecoKind,
  type Losa,
  type Muro,
  type Pt,
  type Viga,
  type Zapata,
} from "./geometry.ts";
import { hojaPresupuesto } from "./cost.ts";
import { takeoffScene } from "./quantity.ts";
import { V2_COLUMNA, V2_HUECO, V2_MURO, V2_VIGA, V2_ZAPATA } from "./tables.ts";
import { idleClock, type V2ClockState, type V2PlacaEstado } from "./clock.ts";

export const V2_LIVE_KEY = "obra.v2";
export const V2_BAK_KEY = "obra.v2.bak";
export const V2_PRODUCT = "obra.v2" as const;
export const V2_DOC_VERSION = 1 as const;

export type V2View = {
  panX: number;
  panY: number;
  ppm: number;
};

export type V2Placa = {
  id: string;
  closedAt: string;
  largoMuroM: number;
  losaM2: number;
  estimado: number;
  estado: V2PlacaEstado;
  recuento: {
    muros: number;
    vanos: number;
    columnas: number;
    zapatas: number;
    vigas: number;
    losas: number;
  };
};

export type V2Document = {
  product: typeof V2_PRODUCT;
  version: typeof V2_DOC_VERSION;
  walls: Muro[];
  openings: Hueco[];
  columns: Columna[];
  footings: Zapata[];
  beams: Viga[];
  slabs: Losa[];
  archive: V2Placa[];
  nextSeq: number;
  nextHuecoSeq: number;
  nextColSeq: number;
  nextZapSeq: number;
  nextVigaSeq: number;
  nextLosaSeq: number;
  nextArchiveSeq: number;
  clock: V2ClockState;
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
    columns: [],
    footings: [],
    beams: [],
    slabs: [],
    archive: [],
    nextSeq: 1,
    nextHuecoSeq: 1,
    nextColSeq: 1,
    nextZapSeq: 1,
    nextVigaSeq: 1,
    nextLosaSeq: 1,
    nextArchiveSeq: 1,
    clock: idleClock(),
    view: null,
  };
}

export function snapshotV2(doc: V2Document): V2Document {
  return {
    product: V2_PRODUCT,
    version: V2_DOC_VERSION,
    walls: doc.walls.map((m) => createMuro(m.a, m.b, m.id, m.espesor)),
    openings: doc.openings.map((h) => createHueco(h.kind, h.wallId, h.alongM, h.id, h.ancho)),
    columns: doc.columns.map((c) => createColumna(c.c, c.id, c.lado)),
    footings: doc.footings.map((z) => createZapata(z.c, z.id, z.lado, z.columnId)),
    beams: doc.beams.map((v) => createViga(v.a, v.b, v.id, v.ancho)),
    slabs: doc.slabs.map((l) => createLosa(l.poly, l.id)),
    archive: doc.archive.map(clonePlaca),
    nextSeq: doc.nextSeq,
    nextHuecoSeq: doc.nextHuecoSeq,
    nextColSeq: doc.nextColSeq,
    nextZapSeq: doc.nextZapSeq,
    nextVigaSeq: doc.nextVigaSeq,
    nextLosaSeq: doc.nextLosaSeq,
    nextArchiveSeq: doc.nextArchiveSeq,
    clock: cloneClock(doc.clock),
    view: doc.view ? { panX: doc.view.panX, panY: doc.view.panY, ppm: doc.view.ppm } : null,
  };
}

function clonePlaca(p: V2Placa): V2Placa {
  return {
    id: p.id,
    closedAt: p.closedAt,
    largoMuroM: p.largoMuroM,
    losaM2: p.losaM2,
    estimado: p.estimado,
    estado: p.estado,
    recuento: { ...p.recuento },
  };
}

function cloneClock(c: V2ClockState): V2ClockState {
  return {
    running: !!c.running,
    pace: c.pace === "normal" ? "normal" : "pausa",
    laminaMs: Math.max(0, c.laminaMs),
    startedAt: c.startedAt,
    done: { cim: c.done.cim, est: c.done.est, alb: c.done.alb },
    rework: !!c.rework,
    executed: !!c.executed,
    sealed: !!c.sealed || !!c.executed,
    placaId: typeof c.placaId === "string" && c.placaId ? c.placaId : null,
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

function migrateSquares(
  raw: unknown,
  prefix: string,
  defaultLado: number,
): { id: string; c: Pt; lado: number; columnId: string | null }[] {
  if (!Array.isArray(raw)) return [];
  const out: { id: string; c: Pt; lado: number; columnId: string | null }[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const c = pt(item.c);
    if (!c) continue;
    const id =
      typeof item.id === "string" && item.id ? item.id : `${prefix}-${String(out.length + 1).padStart(3, "0")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const lado = Math.max(0.1, num(item.lado, defaultLado));
    const columnId = typeof item.columnId === "string" && item.columnId ? item.columnId : null;
    out.push({ id, c, lado, columnId });
  }
  return out;
}

function migrateBeams(raw: unknown): Viga[] {
  if (!Array.isArray(raw)) return [];
  const out: Viga[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const a = pt(item.a);
    const b = pt(item.b);
    if (!a || !b) continue;
    const id = typeof item.id === "string" && item.id ? item.id : `VG-${String(out.length + 1).padStart(3, "0")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const ancho = Math.max(0.1, num(item.ancho, V2_VIGA.anchoM));
    out.push(createViga(a, b, id, ancho));
  }
  return out;
}

function migrateSlabs(raw: unknown): Losa[] {
  if (!Array.isArray(raw)) return [];
  const out: Losa[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const rawPoly = item.poly;
    if (!Array.isArray(rawPoly)) continue;
    const poly: Pt[] = [];
    for (const p of rawPoly) {
      const q = pt(p);
      if (q) poly.push(q);
    }
    if (poly.length < 3) continue;
    const id = typeof item.id === "string" && item.id ? item.id : `L-${String(out.length + 1).padStart(3, "0")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(createLosa(poly, id));
  }
  return out;
}

function migrateView(raw: unknown): V2View | null {
  if (!isObject(raw)) return null;
  const ppm = num(raw.ppm, 0);
  if (ppm < 4 || ppm > 160) return null;
  return { panX: num(raw.panX, 0), panY: num(raw.panY, 0), ppm };
}

function migrateClock(raw: unknown): V2ClockState {
  const idle = idleClock();
  if (!isObject(raw)) return idle;
  const doneRaw = isObject(raw.done) ? raw.done : {};
  return {
    running: raw.running === true,
    pace: raw.pace === "normal" ? "normal" : "pausa",
    laminaMs: Math.max(0, num(raw.laminaMs, 0)),
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    done: {
      cim: Math.max(0, num(doneRaw.cim, 0)),
      est: Math.max(0, num(doneRaw.est, 0)),
      alb: Math.max(0, num(doneRaw.alb, 0)),
    },
    rework: raw.rework === true,
    executed: raw.executed === true,
    sealed: raw.sealed === true || raw.executed === true,
    placaId: typeof raw.placaId === "string" && raw.placaId ? raw.placaId : null,
  };
}

function migrateArchive(raw: unknown): V2Placa[] {
  if (!Array.isArray(raw)) return [];
  const out: V2Placa[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const id = typeof item.id === "string" && item.id ? item.id : `A-${String(out.length + 1).padStart(3, "0")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const rec = isObject(item.recuento) ? item.recuento : {};
    const closedAt = typeof item.closedAt === "string" && item.closedAt ? item.closedAt : "";
    out.push({
      id,
      closedAt,
      largoMuroM: Math.max(0, num(item.largoMuroM, 0)),
      losaM2: Math.max(0, num(item.losaM2, 0)),
      estimado: Math.max(0, num(item.estimado, 0)),
      estado: item.estado === "ejecutada" || item.estado === "abierta" ? item.estado : "cerrada",
      recuento: {
        muros: Math.max(0, num(rec.muros, 0)),
        vanos: Math.max(0, num(rec.vanos, 0)),
        columnas: Math.max(0, num(rec.columnas, 0)),
        zapatas: Math.max(0, num(rec.zapatas, 0)),
        vigas: Math.max(0, num(rec.vigas, 0)),
        losas: Math.max(0, num(rec.losas, 0)),
      },
    });
  }
  return collapseClonedPlacas(out);
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
  const columns = migrateSquares(parsed.columns, "C", V2_COLUMNA.ladoM).map((c) =>
    createColumna(c.c, c.id, c.lado),
  );
  const footings = migrateSquares(parsed.footings, "Z", V2_ZAPATA.ladoM).map((z) =>
    createZapata(z.c, z.id, z.lado, z.columnId),
  );
  const beams = migrateBeams(parsed.beams);
  const slabs = migrateSlabs(parsed.slabs);
  const archive = migrateArchive(parsed.archive);
  const doc: V2Document = {
    product: V2_PRODUCT,
    version: V2_DOC_VERSION,
    walls,
    openings,
    columns,
    footings,
    beams,
    slabs,
    nextSeq: seqFromIds(
      walls.map((w) => w.id),
      /^M-/,
      num(parsed.nextSeq, 1),
    ),
    nextHuecoSeq: seqFromIds(
      openings.map((h) => h.id),
      /^[PV]-/,
      num(parsed.nextHuecoSeq, 1),
    ),
    nextColSeq: seqFromIds(
      columns.map((c) => c.id),
      /^C-/,
      num(parsed.nextColSeq, 1),
    ),
    nextZapSeq: seqFromIds(
      footings.map((z) => z.id),
      /^Z-/,
      num(parsed.nextZapSeq, 1),
    ),
    nextVigaSeq: seqFromIds(
      beams.map((v) => v.id),
      /^VG-/,
      num(parsed.nextVigaSeq, 1),
    ),
    nextLosaSeq: seqFromIds(
      slabs.map((l) => l.id),
      /^L-/,
      num(parsed.nextLosaSeq, 1),
    ),
    archive,
    nextArchiveSeq: seqFromIds(
      archive.map((p) => p.id),
      /^A-/,
      num(parsed.nextArchiveSeq, 1),
    ),
    clock: migrateClock(parsed.clock),
    view: migrateView(parsed.view),
  };
  return inferSeal(doc);
}

function inferSeal(doc: V2Document): V2Document {
  if (doc.clock.sealed) return doc;
  const last = doc.archive[doc.archive.length - 1];
  if (!last || last.estado === "abierta") return doc;
  if (drawingIsEmpty(doc)) return doc;
  const rec = last.recuento;
  if (
    rec.muros !== doc.walls.length ||
    rec.vanos !== doc.openings.length ||
    rec.columnas !== doc.columns.length ||
    rec.zapatas !== doc.footings.length ||
    rec.vigas !== doc.beams.length ||
    rec.losas !== doc.slabs.length
  ) {
    return doc;
  }
  return {
    ...doc,
    clock: {
      ...doc.clock,
      sealed: true,
      placaId: last.id,
      executed: doc.clock.executed || last.estado === "ejecutada",
    },
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

/** Borra el plano V2. Conserva el archivo. Nunca escribe claves Yuna. */
export function resetDrawing(doc: V2Document): V2Document {
  const empty = emptyV2();
  return {
    ...empty,
    archive: doc.archive.map(clonePlaca),
    nextArchiveSeq: Math.max(empty.nextArchiveSeq, doc.nextArchiveSeq),
  };
}

export function drawingIsEmpty(doc: Pick<V2Document, "walls" | "openings" | "columns" | "footings" | "beams" | "slabs">): boolean {
  return (
    doc.walls.length === 0 &&
    doc.openings.length === 0 &&
    doc.columns.length === 0 &&
    doc.footings.length === 0 &&
    doc.beams.length === 0 &&
    doc.slabs.length === 0
  );
}

export function placaId(seq: number): string {
  return `A-${String(seq).padStart(3, "0")}`;
}

function recuentoEq(a: V2Placa["recuento"], b: V2Placa["recuento"]): boolean {
  return (
    a.muros === b.muros &&
    a.vanos === b.vanos &&
    a.columnas === b.columnas &&
    a.zapatas === b.zapatas &&
    a.vigas === b.vigas &&
    a.losas === b.losas
  );
}

/** Dos sellos seguidos del mismo plano: se queda uno. */
function collapseClonedPlacas(list: V2Placa[]): V2Placa[] {
  const out: V2Placa[] = [];
  for (const p of list) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.estado !== "abierta" &&
      p.estado !== "abierta" &&
      prev.estado === p.estado &&
      prev.largoMuroM === p.largoMuroM &&
      prev.losaM2 === p.losaM2 &&
      recuentoEq(prev.recuento, p.recuento)
    ) {
      continue;
    }
    out.push(p);
  }
  return out;
}

export type SceneForPlaca = {
  walls: readonly Muro[];
  openings: readonly Hueco[];
  columns: readonly Columna[];
  footings: readonly Zapata[];
  beams: readonly Viga[];
  slabs: readonly Losa[];
};

/** Takeoff de la placa = geometría en este instante. */
export function placaFromScene(
  scene: SceneForPlaca,
  opts: { id: string; estado: Exclude<V2PlacaEstado, "abierta">; rework: boolean; closedAt?: string },
): V2Placa {
  const qty = takeoffScene(scene);
  const largoMuroM = scene.walls.reduce((n, m) => n + muroLargo(m), 0);
  const losaM2 = scene.slabs.reduce((n, l) => n + losaArea(l), 0);
  const hoja = hojaPresupuesto(qty, { rework: opts.rework });
  return {
    id: opts.id,
    closedAt: opts.closedAt ?? new Date().toISOString(),
    largoMuroM,
    losaM2,
    estimado: hoja.total,
    estado: opts.estado,
    recuento: {
      muros: scene.walls.length,
      vanos: scene.openings.length,
      columnas: scene.columns.length,
      zapatas: scene.footings.length,
      vigas: scene.beams.length,
      losas: scene.slabs.length,
    },
  };
}

/**
 * Un cierre = una placa de esta lámina.
 * Si ya está sellada: no-op. Cero A-00N nueva.
 */
export function sealArchive(
  archive: readonly V2Placa[],
  nextArchiveSeq: number,
  clock: V2ClockState,
  draft: V2Placa,
): { archive: V2Placa[]; nextArchiveSeq: number; clock: V2ClockState; id: string } {
  const known = clock.placaId && archive.some((p) => p.id === clock.placaId) ? clock.placaId : null;
  const existingId = known ?? (clock.sealed && archive.length ? archive[archive.length - 1]!.id : null);
  if (existingId) {
    return {
      archive: archive.map((p) => p),
      nextArchiveSeq,
      clock: {
        ...clock,
        sealed: true,
        placaId: existingId,
        executed: clock.executed || archive.find((p) => p.id === existingId)?.estado === "ejecutada",
      },
      id: existingId,
    };
  }
  const wantEjec = draft.estado === "ejecutada" || clock.executed;
  const estado: Exclude<V2PlacaEstado, "abierta"> = wantEjec ? "ejecutada" : "cerrada";
  const id = draft.id || placaId(nextArchiveSeq);
  const placa: V2Placa = { ...draft, id, estado };
  const seq = Number(String(id).replace(/^A-/, ""));
  return {
    archive: archive.concat([placa]),
    nextArchiveSeq: Number.isFinite(seq) ? Math.max(nextArchiveSeq, seq + 1) : nextArchiveSeq + 1,
    clock: {
      ...clock,
      sealed: true,
      executed: estado === "ejecutada",
      placaId: id,
      pace: estado === "ejecutada" ? "pausa" : clock.pace,
    },
    id,
  };
}

