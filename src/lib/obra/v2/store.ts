/**
 * Estado vivo de NUEVA OBRA. Independiente de useObra / sim.advance.
 */
import { create } from "zustand";
import {
  cornersOf,
  createMuro,
  muroId,
  muroLargo,
  snapDraft,
  type Muro,
  type Pt,
  type SnapKind,
} from "./geometry.ts";
import { canRedo, canUndo, histInit, histPush, histRedo, histUndo, type Hist } from "./history.ts";
import { loadV2, saveV2, type V2View } from "./persist-v2.ts";
import { V2_MURO } from "./tables.ts";
import { fitView, zoomAt } from "./draw-v2.ts";

export type V2Tool = "muro" | "seleccionar";

export type V2Draft = { a: Pt; b: Pt; kind: SnapKind };

type NuevaStore = {
  walls: Muro[];
  selectedId: string | null;
  tool: V2Tool;
  draft: V2Draft | null;
  view: V2View;
  nextSeq: number;
  hist: Hist<Muro[]>;
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
  select: (id: string | null) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  snap: (raw: Pt, origin: Pt | null) => { point: Pt; kind: SnapKind };
  canUndo: boolean;
  canRedo: boolean;
};

function persistNow(get: () => NuevaStore) {
  const s = get();
  saveV2({
    product: "obra.v2",
    version: 1,
    walls: s.walls,
    nextSeq: s.nextSeq,
    view: s.view,
  });
}

export const useNueva = create<NuevaStore>((set, get) => ({
  walls: [],
  selectedId: null,
  tool: "muro",
  draft: null,
  view: { panX: 0, panY: 0, ppm: 28 },
  nextSeq: 1,
  hist: histInit<Muro[]>([]),
  hydrated: false,
  canUndo: false,
  canRedo: false,

  hydrate: () => {
    const doc = loadV2();
    const hist = histInit(doc.walls);
    set({
      walls: doc.walls,
      nextSeq: doc.nextSeq,
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
    const { nextSeq, walls, hist } = get();
    const id = muroId(nextSeq);
    const muro = createMuro(a, b, id, V2_MURO.espesorM);
    const next = walls.concat([muro]);
    const h = histPush(hist, next);
    set({
      walls: next,
      nextSeq: nextSeq + 1,
      hist: h,
      draft: null,
      selectedId: id,
      canUndo: canUndo(h),
      canRedo: canRedo(h),
    });
    persistNow(get);
    return id;
  },

  select: (id) => set({ selectedId: id, draft: null }),

  deleteSelected: () => {
    const { selectedId, walls, hist } = get();
    if (!selectedId) return;
    const next = walls.filter((m) => m.id !== selectedId);
    if (next.length === walls.length) return;
    const h = histPush(hist, next);
    set({
      walls: next,
      hist: h,
      selectedId: null,
      canUndo: canUndo(h),
      canRedo: canRedo(h),
    });
    persistNow(get);
  },

  undo: () => {
    const h = histUndo(get().hist);
    set({
      hist: h,
      walls: h.present,
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
      walls: h.present,
      selectedId: null,
      draft: null,
      canUndo: canUndo(h),
      canRedo: canRedo(h),
    });
    persistNow(get);
  },
}));


