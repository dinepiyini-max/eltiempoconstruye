/**
 * Estado vivo de NUEVA OBRA. Independiente de useObra / sim.advance.
 */
import { create } from "zustand";
import {
  cornersOf,
  createMuro,
  distToSegment,
  huecoId,
  muroId,
  muroLargo,
  nextHuecoSeqFor,
  placeHuecoOnMuro,
  snapDraft,
  type Hueco,
  type HuecoKind,
  type Muro,
  type Pt,
  type SnapKind,
} from "./geometry.ts";
import { canRedo, canUndo, histInit, histPush, histRedo, histUndo, type Hist } from "./history.ts";
import { loadV2, saveV2, type V2View } from "./persist-v2.ts";
import { V2_MURO } from "./tables.ts";
import { fitView, zoomAt } from "./draw-v2.ts";

export type V2Tool = "muro" | "seleccionar" | "puerta" | "ventana";

export type V2Draft = { a: Pt; b: Pt; kind: SnapKind };

export type NuevaScene = { walls: Muro[]; openings: Hueco[] };

type NuevaStore = {
  walls: Muro[];
  openings: Hueco[];
  selectedId: string | null;
  tool: V2Tool;
  draft: V2Draft | null;
  view: V2View;
  nextSeq: number;
  nextHuecoSeq: number;
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
  commitMuro: (a: Pt, b: Pt) => string | null;
  placeHueco: (kind: HuecoKind, world: Pt) => string | null;
  select: (id: string | null) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  snap: (raw: Pt, origin: Pt | null) => { point: Pt; kind: SnapKind };
  canUndo: boolean;
  canRedo: boolean;
};

function sceneOf(walls: Muro[], openings: Hueco[]): NuevaScene {
  return {
    walls: walls.map((m) => createMuro(m.a, m.b, m.id, m.espesor)),
    openings: openings.map((h) => ({ ...h })),
  };
}

function persistNow(get: () => NuevaStore) {
  const s = get();
  saveV2({
    product: "obra.v2",
    version: 1,
    walls: s.walls,
    openings: s.openings,
    nextSeq: s.nextSeq,
    nextHuecoSeq: s.nextHuecoSeq,
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
    hist: h,
    canUndo: canUndo(h),
    canRedo: canRedo(h),
    ...extra,
  });
  persistNow(get);
}

export const useNueva = create<NuevaStore>((set, get) => ({
  walls: [],
  openings: [],
  selectedId: null,
  tool: "muro",
  draft: null,
  view: { panX: 0, panY: 0, ppm: 28 },
  nextSeq: 1,
  nextHuecoSeq: 1,
  hist: histInit<NuevaScene>(sceneOf([], [])),
  hydrated: false,
  canUndo: false,
  canRedo: false,

  hydrate: () => {
    const doc = loadV2();
    const present = sceneOf(doc.walls, doc.openings);
    const hist = histInit(present);
    set({
      walls: present.walls,
      openings: present.openings,
      nextSeq: doc.nextSeq,
      nextHuecoSeq: doc.nextHuecoSeq,
      view: doc.view ?? get().view,
      selectedId: null,
      draft: null,
      hist,
      hydrated: true,
      canUndo: false,
      canRedo: false,
    });
  },

  flush: () => persistNow(get),

  setTool: (tool) => set({ tool, draft: null, selectedId: tool === "muro" ? null : get().selectedId }),

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

  snap: (raw, origin) => {
    const { walls, view } = get();
    const cornerM = Math.max(0.45, 22 / view.ppm);
    return snapDraft(raw, origin, cornersOf(walls), { cornerM, angleDeg: 8 });
  },

  commitMuro: (a, b) => {
    const largo = muroLargo({ a, b });
    if (largo < V2_MURO.minLargoM) {
      set({ draft: null });
      return null;
    }
    const { nextSeq, walls, openings } = get();
    const id = muroId(nextSeq);
    const muro = createMuro(a, b, id, V2_MURO.espesorM);
    applyScene(set, get, sceneOf(walls.concat([muro]), openings), {
      nextSeq: nextSeq + 1,
      draft: null,
      selectedId: id,
    });
    return id;
  },

  placeHueco: (kind, world) => {
    const { walls, openings, nextHuecoSeq, view } = get();
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
    applyScene(set, get, sceneOf(walls, openings.concat([hueco])), {
      nextHuecoSeq: Math.max(nextHuecoSeq, seq) + 1,
      draft: null,
      selectedId: hueco.id,
    });
    return hueco.id;
  },

  select: (id) => set({ selectedId: id, draft: null }),

  deleteSelected: () => {
    const { selectedId, walls, openings } = get();
    if (!selectedId) return;
    const openingGone = openings.filter((h) => h.id !== selectedId);
    if (openingGone.length !== openings.length) {
      applyScene(set, get, sceneOf(walls, openingGone), { selectedId: null });
      return;
    }
    const wallGone = walls.filter((m) => m.id !== selectedId);
    if (wallGone.length === walls.length) return;
    const orphansOut = openings.filter((h) => h.wallId !== selectedId);
    applyScene(set, get, sceneOf(wallGone, orphansOut), { selectedId: null });
  },

  undo: () => {
    const h = histUndo(get().hist);
    set({
      hist: h,
      walls: h.present.walls,
      openings: h.present.openings,
      selectedId: null,
      draft: null,
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
      selectedId: null,
      draft: null,
      canUndo: canUndo(h),
      canRedo: canRedo(h),
    });
    persistNow(get);
  },
}));
