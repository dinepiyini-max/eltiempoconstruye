/**
 * Estado vivo de NUEVA OBRA. Independiente de useObra / sim.advance.
 */
import { create } from "zustand";
import {
  createColumna,
  createHueco,
  createLosa,
  createMuro,
  createViga,
  createZapata,
  distToSegment,
  huecoId,
  muroId,
  muroLargo,
  nextHuecoSeqFor,
  nextStructSeq,
  placeHuecoOnMuro,
  polygonArea,
  snapDraft,
  snapZapataCenter,
  structId,
  structureAnchors,
  vigaLargo,
  type Columna,
  type Hueco,
  type HuecoKind,
  type Losa,
  type Muro,
  type Pt,
  type SnapKind,
  type Viga,
  type Zapata,
} from "./geometry.ts";
import { canRedo, canUndo, histInit, histPush, histRedo, histUndo, type Hist } from "./history.ts";
import { loadV2, saveV2, type V2View } from "./persist-v2.ts";
import { V2_COLUMNA, V2_LOSA_PLANTA, V2_MURO, V2_VIGA, V2_ZAPATA } from "./tables.ts";
import { fitView, zoomAt } from "./draw-v2.ts";

export type V2Tool = "muro" | "seleccionar" | "puerta" | "ventana" | "columna" | "zapata" | "viga" | "losa";

export type V2Draft = { a: Pt; b: Pt; kind: SnapKind };

export type NuevaScene = {
  walls: Muro[];
  openings: Hueco[];
  columns: Columna[];
  footings: Zapata[];
  beams: Viga[];
  slabs: Losa[];
};

type NuevaStore = {
  walls: Muro[];
  openings: Hueco[];
  columns: Columna[];
  footings: Zapata[];
  beams: Viga[];
  slabs: Losa[];
  selectedId: string | null;
  tool: V2Tool;
  draft: V2Draft | null;
  polyDraft: Pt[];
  view: V2View;
  nextSeq: number;
  nextHuecoSeq: number;
  nextColSeq: number;
  nextZapSeq: number;
  nextVigaSeq: number;
  nextLosaSeq: number;
  hist: Hist<NuevaScene>;
  hydrated: boolean;
  hydrate: () => void;
  flush: () => void;
  setTool: (tool: V2Tool) => void;
  setView: (view: V2View) => void;
  fit: (w: number, h: number) => void;
  zoom: (screen: Pt, factor: number) => void;
  pan: (dxPx: number, dyPx: number) => void;
  setDraft: (draft: V2Draft | null) => void;
  setPolyDraft: (pts: Pt[]) => void;
  commitMuro: (a: Pt, b: Pt) => string | null;
  commitViga: (a: Pt, b: Pt) => string | null;
  commitColumna: (world: Pt) => string;
  commitZapata: (world: Pt) => string;
  commitLosa: (poly: Pt[]) => string | null;
  placeHueco: (kind: HuecoKind, world: Pt) => string | null;
  select: (id: string | null) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  snap: (raw: Pt, origin: Pt | null) => { point: Pt; kind: SnapKind };
  canUndo: boolean;
  canRedo: boolean;
};

function sceneOf(
  walls: Muro[],
  openings: Hueco[],
  columns: Columna[] = [],
  footings: Zapata[] = [],
  beams: Viga[] = [],
  slabs: Losa[] = [],
): NuevaScene {
  return {
    walls: walls.map((m) => createMuro(m.a, m.b, m.id, m.espesor)),
    openings: openings.map((h) => createHueco(h.kind, h.wallId, h.alongM, h.id, h.ancho)),
    columns: columns.map((c) => createColumna(c.c, c.id, c.lado)),
    footings: footings.map((z) => createZapata(z.c, z.id, z.lado, z.columnId)),
    beams: beams.map((v) => createViga(v.a, v.b, v.id, v.ancho)),
    slabs: slabs.map((l) => createLosa(l.poly, l.id)),
  };
}

function persistNow(get: () => NuevaStore) {
  const s = get();
  saveV2({
    product: "obra.v2",
    version: 1,
    walls: s.walls,
    openings: s.openings,
    columns: s.columns,
    footings: s.footings,
    beams: s.beams,
    slabs: s.slabs,
    nextSeq: s.nextSeq,
    nextHuecoSeq: s.nextHuecoSeq,
    nextColSeq: s.nextColSeq,
    nextZapSeq: s.nextZapSeq,
    nextVigaSeq: s.nextVigaSeq,
    nextLosaSeq: s.nextLosaSeq,
    view: s.view,
  });
}

function applyScene(
  set: (p: Partial<NuevaStore>) => void,
  get: () => NuevaStore,
  next: NuevaScene,
  extra: Partial<NuevaStore> = {},
) {
  const h = histPush(get().hist, next);
  set({
    walls: next.walls,
    openings: next.openings,
    columns: next.columns,
    footings: next.footings,
    beams: next.beams,
    slabs: next.slabs,
    hist: h,
    canUndo: canUndo(h),
    canRedo: canRedo(h),
    draft: null,
    polyDraft: [],
    ...extra,
  });
  persistNow(get);
}

function emptyScene(): NuevaScene {
  return sceneOf([], [], [], [], [], []);
}

export const useNueva = create<NuevaStore>((set, get) => ({
  walls: [],
  openings: [],
  columns: [],
  footings: [],
  beams: [],
  slabs: [],
  selectedId: null,
  tool: "muro",
  draft: null,
  polyDraft: [],
  view: { panX: 0, panY: 0, ppm: 28 },
  nextSeq: 1,
  nextHuecoSeq: 1,
  nextColSeq: 1,
  nextZapSeq: 1,
  nextVigaSeq: 1,
  nextLosaSeq: 1,
  hist: histInit<NuevaScene>(emptyScene()),
  hydrated: false,
  canUndo: false,
  canRedo: false,

  hydrate: () => {
    const doc = loadV2();
    const present = sceneOf(doc.walls, doc.openings, doc.columns, doc.footings, doc.beams, doc.slabs);
    const hist = histInit(present);
    set({
      walls: present.walls,
      openings: present.openings,
      columns: present.columns,
      footings: present.footings,
      beams: present.beams,
      slabs: present.slabs,
      nextSeq: doc.nextSeq,
      nextHuecoSeq: doc.nextHuecoSeq,
      nextColSeq: doc.nextColSeq,
      nextZapSeq: doc.nextZapSeq,
      nextVigaSeq: doc.nextVigaSeq,
      nextLosaSeq: doc.nextLosaSeq,
      view: doc.view ?? get().view,
      selectedId: null,
      draft: null,
      polyDraft: [],
      hist,
      hydrated: true,
      canUndo: false,
      canRedo: false,
    });
  },

  flush: () => persistNow(get),

  setTool: (tool) => set({ tool, draft: null, polyDraft: [], selectedId: tool === "muro" ? null : get().selectedId }),

  setView: (view) => set({ view }),

  fit: (w, h) => set({ view: fitView(w, h) }),

  zoom: (screen, factor) => set({ view: zoomAt(get().view, screen, factor) }),

  pan: (dxPx, dyPx) => {
    const { view } = get();
    set({
      view: {
        ...view,
        panX: view.panX - dxPx / view.ppm,
        panY: view.panY - dyPx / view.ppm,
      },
    });
  },

  setDraft: (draft) => set({ draft }),
  setPolyDraft: (pts) => set({ polyDraft: pts.map((p) => ({ x: p.x, y: p.y })) }),

  snap: (raw, origin) => {
    const { walls, columns, beams, view } = get();
    const cornerM = Math.max(0.45, 22 / view.ppm);
    return snapDraft(raw, origin, structureAnchors(walls, columns, beams), { cornerM, angleDeg: 8 });
  },

  commitMuro: (a, b) => {
    const largo = muroLargo({ a, b });
    if (largo < V2_MURO.minLargoM) {
      set({ draft: null });
      return null;
    }
    const { nextSeq, walls, openings, columns, footings, beams, slabs } = get();
    const id = muroId(nextSeq);
    const muro = createMuro(a, b, id, V2_MURO.espesorM);
    applyScene(set, get, sceneOf(walls.concat([muro]), openings, columns, footings, beams, slabs), {
      nextSeq: nextSeq + 1,
      selectedId: id,
    });
    return id;
  },

  commitViga: (a, b) => {
    const largo = vigaLargo({ a, b });
    if (largo < V2_VIGA.minLargoM) {
      set({ draft: null });
      return null;
    }
    const { nextVigaSeq, walls, openings, columns, footings, beams, slabs } = get();
    const seq = nextStructSeq("VG", beams.map((v) => v.id));
    const id = structId("VG", Math.max(nextVigaSeq, seq));
    const viga = createViga(a, b, id, V2_VIGA.anchoM);
    applyScene(set, get, sceneOf(walls, openings, columns, footings, beams.concat([viga]), slabs), {
      nextVigaSeq: Math.max(nextVigaSeq, seq) + 1,
      selectedId: id,
    });
    return id;
  },

  commitColumna: (world) => {
    const s = get().snap(world, null);
    const { nextColSeq, walls, openings, columns, footings, beams, slabs } = get();
    const seq = nextStructSeq("C", columns.map((c) => c.id));
    const id = structId("C", Math.max(nextColSeq, seq));
    const col = createColumna(s.point, id, V2_COLUMNA.ladoM);
    applyScene(set, get, sceneOf(walls, openings, columns.concat([col]), footings, beams, slabs), {
      nextColSeq: Math.max(nextColSeq, seq) + 1,
      selectedId: id,
    });
    return id;
  },

  commitZapata: (world) => {
    const s = get().snap(world, null);
    const { nextZapSeq, walls, openings, columns, footings, beams, slabs, view } = get();
    const snapM = Math.max(V2_ZAPATA.snapM, 18 / view.ppm);
    const placed = snapZapataCenter(s.point, columns, snapM);
    const seq = nextStructSeq("Z", footings.map((z) => z.id));
    const id = structId("Z", Math.max(nextZapSeq, seq));
    const zap = createZapata(placed.c, id, V2_ZAPATA.ladoM, placed.columnId);
    applyScene(set, get, sceneOf(walls, openings, columns, footings.concat([zap]), beams, slabs), {
      nextZapSeq: Math.max(nextZapSeq, seq) + 1,
      selectedId: id,
    });
    return id;
  },

  commitLosa: (poly) => {
    const area = polygonArea(poly);
    if (poly.length < 3 || area < V2_LOSA_PLANTA.minAreaM2) {
      set({ polyDraft: [] });
      return null;
    }
    const { nextLosaSeq, walls, openings, columns, footings, beams, slabs } = get();
    const seq = nextStructSeq("L", slabs.map((l) => l.id));
    const id = structId("L", Math.max(nextLosaSeq, seq));
    const losa = createLosa(poly, id);
    applyScene(set, get, sceneOf(walls, openings, columns, footings, beams, slabs.concat([losa])), {
      nextLosaSeq: Math.max(nextLosaSeq, seq) + 1,
      selectedId: id,
    });
    return id;
  },

  placeHueco: (kind, world) => {
    const { walls, openings, nextHuecoSeq, view, columns, footings, beams, slabs } = get();
    const slack = Math.max(0.12, 14 / view.ppm);
    let best: { m: Muro; d: number } | null = null;
    for (const m of walls) {
      const d = distToSegment(world, m.a, m.b);
      if (d <= m.espesor / 2 + slack && (!best || d < best.d)) best = { m, d };
    }
    if (!best) return null;
    const seq = nextHuecoSeqFor(kind, openings);
    const hueco = placeHuecoOnMuro(kind, best.m, world, openings, huecoId(kind, seq));
    if (!hueco) return null;
    applyScene(set, get, sceneOf(walls, openings.concat([hueco]), columns, footings, beams, slabs), {
      nextHuecoSeq: Math.max(nextHuecoSeq, seq) + 1,
      selectedId: hueco.id,
    });
    return hueco.id;
  },

  select: (id) => set({ selectedId: id, draft: null }),

  deleteSelected: () => {
    const { selectedId, walls, openings, columns, footings, beams, slabs } = get();
    if (!selectedId) return;
    const openingGone = openings.filter((h) => h.id !== selectedId);
    if (openingGone.length !== openings.length) {
      applyScene(set, get, sceneOf(walls, openingGone, columns, footings, beams, slabs), { selectedId: null });
      return;
    }
    const wallGone = walls.filter((m) => m.id !== selectedId);
    if (wallGone.length !== walls.length) {
      const orphansOut = openings.filter((h) => h.wallId !== selectedId);
      applyScene(set, get, sceneOf(wallGone, orphansOut, columns, footings, beams, slabs), { selectedId: null });
      return;
    }
    const colGone = columns.filter((c) => c.id !== selectedId);
    if (colGone.length !== columns.length) {
      applyScene(set, get, sceneOf(walls, openings, colGone, footings, beams, slabs), { selectedId: null });
      return;
    }
    const zapGone = footings.filter((z) => z.id !== selectedId);
    if (zapGone.length !== footings.length) {
      applyScene(set, get, sceneOf(walls, openings, columns, zapGone, beams, slabs), { selectedId: null });
      return;
    }
    const beamGone = beams.filter((v) => v.id !== selectedId);
    if (beamGone.length !== beams.length) {
      applyScene(set, get, sceneOf(walls, openings, columns, footings, beamGone, slabs), { selectedId: null });
      return;
    }
    const slabGone = slabs.filter((l) => l.id !== selectedId);
    if (slabGone.length === slabs.length) return;
    applyScene(set, get, sceneOf(walls, openings, columns, footings, beams, slabGone), { selectedId: null });
  },

  undo: () => {
    const h = histUndo(get().hist);
    set({
      hist: h,
      walls: h.present.walls,
      openings: h.present.openings,
      columns: h.present.columns,
      footings: h.present.footings,
      beams: h.present.beams,
      slabs: h.present.slabs,
      selectedId: null,
      draft: null,
      polyDraft: [],
      canUndo: canUndo(h),
      canRedo: canRedo(h),
    });
    persistNow(get);
  },

  redo: () => {
    const h = histRedo(get().hist);
    set({
      hist: h,
      walls: h.present.walls,
      openings: h.present.openings,
      columns: h.present.columns,
      footings: h.present.footings,
      beams: h.present.beams,
      slabs: h.present.slabs,
      selectedId: null,
      draft: null,
      polyDraft: [],
      canUndo: canUndo(h),
      canRedo: canRedo(h),
    });
    persistNow(get);
  },
}));
