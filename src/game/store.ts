import { create } from "zustand";
import type { ClockPace, CrewFront, Game, NoteKind, OrderKind, Page, Role, Slot, StructureId } from "./types.ts";
import {
  acceptContract,
  addNote,
  advanceMinutes,
  assignCrew,
  catchUp,
  clockMultiplier,
  cycleFront,
  newGame,
  openFront,
  orderMaterial,
  setClockPace,
  setPage,
  shiftRole,
  signFirst,
  staffFront,
  startSurvey,
  toggleRegime,
} from "./sim.ts";
import {
  clearDraft,
  currentSlot,
  loadDraft,
  loadGame,
  loadNotes,
  saveDraft,
  saveGame,
  type Draft,
} from "./persist.ts";

type Store = {
  game: Game;
  slot: Slot;
  hydrated: boolean;
  noteFocus: boolean;
  pendingCoords: { x: number; y: number } | null;
  hydrate: (slot: Slot) => void;
  catchUp: () => void;
  advance: (dt: number) => void;
  flush: () => void;
  setPage: (page: Page) => void;
  select: (id: StructureId | null) => void;
  startSurvey: () => void;
  signFirst: (id: StructureId) => void;
  accept: (id: string) => void;
  openFront: (id: StructureId) => void;
  assign: (crewId: string, front: CrewFront) => void;
  cycleFront: (crewId: string) => void;
  shift: (crewId: string, role: Role, dir: number) => void;
  staffFront: (id: StructureId) => void;
  toggleRegime: () => void;
  dismissAbsence: () => void;
  order: (kind: OrderKind) => void;
  addNote: (kind: NoteKind, line: string) => void;
  clearNotes: () => void;
  restoreVisita: () => void;
  importVisitaNotes: () => void;
  resetValley: (keepNotes: boolean) => void;
  setClockPace: (pace: ClockPace) => void;
  toggleLibreta: () => void;
  pinLibreta: () => void;
  setNoteFocus: (on: boolean) => void;
  setPendingCoords: (c: { x: number; y: number } | null) => void;
};

let paintAcc = 0;
let saveAcc = 0;

function resetAcc(): void {
  paintAcc = 0;
  saveAcc = 0;
}

function cloneGame(g: Game): Game {
  return {
    ...g,
    resources: { ...g.resources },
    totals: { ...g.totals },
    structures: Object.fromEntries(
      Object.entries(g.structures).map(([k, v]) => [k, { ...v }]),
    ) as Game["structures"],
    crews: g.crews.map((c) => ({ ...c })),
    contracts: g.contracts.map((c) => ({ ...c })),
    archive: g.archive.map((a) => ({ ...a })),
    events: g.events.map((e) => ({ ...e })),
    slowdowns: g.slowdowns.map((s) => ({ ...s })),
    libreta: g.libreta.map((n) => ({ ...n })),
    prototype: g.prototype ? { ...g.prototype } : null,
  };
}

function paint(set: (p: Partial<Store>) => void, g: Game): void {
  set({ game: cloneGame(g) });
}

function commit(
  set: (p: Partial<Store>) => void,
  get: () => Store,
  g: Game,
): void {
  g.realLastSeen = Date.now();
  paint(set, g);
  saveGame(g, get().slot);
}

export const useObra = create<Store>((set, get) => ({
  game: newGame(),
  slot: currentSlot(),
  hydrated: false,
  noteFocus: false,
  pendingCoords: null,

  hydrate: (slot) => {
    const cur = get();
    if (cur.hydrated && cur.slot === slot) return;
    if (cur.hydrated && cur.slot !== slot) {
      cur.game.realLastSeen = Date.now();
      saveGame(cur.game, cur.slot);
    }
    const loaded = loadGame(slot) ?? newGame();
    if (loaded.clockPace === "pausa") loaded.realLastSeen = Date.now();
    else catchUp(loaded, Date.now());
    resetAcc();
    set({
      game: loaded,
      hydrated: true,
      slot,
      noteFocus: false,
      pendingCoords: null,
    });
    saveGame(loaded, slot);
  },

  catchUp: () => {
    const { game, slot, hydrated, noteFocus } = get();
    if (!hydrated) return;
    if (noteFocus || game.clockPace === "pausa") {
      game.realLastSeen = Date.now();
      saveGame(game, slot);
      return;
    }
    catchUp(game, Date.now());
    paint(set, game);
    saveGame(game, slot);
  },

  advance: (dt) => {
    const { hydrated, slot, noteFocus } = get();
    if (!hydrated) return;
    const cap = Math.min(dt, 0.1);
    const g = get().game;
    const mul = clockMultiplier(g, noteFocus);
    if (mul <= 0) {
      g.realLastSeen = Date.now();
      paintAcc += cap;
      if (paintAcc >= 0.25) {
        paintAcc = 0;
        paint(set, g);
      }
      return;
    }
    g.siteRemainder += cap * 8 * mul;
    const whole = Math.floor(g.siteRemainder);
    if (whole > 0) {
      g.siteRemainder -= whole;
      advanceMinutes(g, whole);
    }
    paintAcc += cap;
    saveAcc += cap;
    if (paintAcc >= 0.12) {
      paintAcc = 0;
      paint(set, g);
    }
    if (saveAcc >= 6) {
      saveAcc = 0;
      g.realLastSeen = Date.now();
      saveGame(g, slot);
    }
  },

  flush: () => {
    const { game, slot, hydrated } = get();
    if (!hydrated) return;
    game.realLastSeen = Date.now();
    saveGame(game, slot);
  },

  setPage: (page) => {
    const g = get().game;
    const before = g.siteMinutes;
    setPage(g, page);
    g.siteMinutes = before;
    commit(set, get, g);
  },

  select: (id) => {
    const g = get().game;
    g.selected = id;
    paint(set, g);
  },

  startSurvey: () => {
    const g = get().game;
    startSurvey(g);
    commit(set, get, g);
  },

  signFirst: (id) => {
    const g = get().game;
    signFirst(g, id);
    commit(set, get, g);
  },

  accept: (id) => {
    const g = get().game;
    acceptContract(g, id);
    commit(set, get, g);
  },

  openFront: (id) => {
    const g = get().game;
    openFront(g, id);
    commit(set, get, g);
  },

  assign: (crewId, front) => {
    const g = get().game;
    assignCrew(g, crewId, front);
    commit(set, get, g);
  },

  cycleFront: (crewId) => {
    const g = get().game;
    cycleFront(g, crewId);
    commit(set, get, g);
  },

  shift: (crewId, role, dir) => {
    const g = get().game;
    shiftRole(g, crewId, role, dir);
    commit(set, get, g);
  },

  staffFront: (id) => {
    const g = get().game;
    staffFront(g, id);
    commit(set, get, g);
  },

  toggleRegime: () => {
    const g = get().game;
    toggleRegime(g);
    commit(set, get, g);
  },

  dismissAbsence: () => {
    const g = get().game;
    g.absence = null;
    commit(set, get, g);
  },

  order: (kind) => {
    const g = get().game;
    orderMaterial(g, kind);
    commit(set, get, g);
  },

  addNote: (kind, line) => {
    const text = line.trim().slice(0, 240);
    if (!text) return;
    const { game, pendingCoords, slot } = get();
    addNote(game, kind, text, pendingCoords);
    commit(set, get, game);
    set({ pendingCoords: null });
    clearDraft(slot);
  },

  clearNotes: () => {
    const g = get().game;
    g.libreta = [];
    commit(set, get, g);
  },

  restoreVisita: () => {
    if (get().slot !== "visita") return;
    const notes = get().game.libreta.map((n) => ({ ...n }));
    const g = newGame();
    g.libreta = notes;
    g.realLastSeen = Date.now();
    resetAcc();
    set({
      game: g,
      hydrated: true,
      slot: "visita",
      noteFocus: false,
      pendingCoords: null,
    });
    saveGame(g, "visita");
  },

  importVisitaNotes: () => {
    if (get().slot !== "jefe") return;
    const incoming = loadNotes("visita");
    if (!incoming.length) return;
    const g = get().game;
    const seen = new Set(g.libreta.map((n) => n.id));
    for (const n of incoming) {
      if (!seen.has(n.id)) {
        g.libreta.push({ ...n });
        seen.add(n.id);
      }
    }
    commit(set, get, g);
  },

  resetValley: (keepNotes) => {
    const { slot, game } = get();
    const notes = keepNotes ? game.libreta.map((n) => ({ ...n })) : [];
    const g = newGame();
    g.libreta = notes;
    g.libretaOpen = game.libretaOpen;
    g.libretaPinned = game.libretaPinned;
    g.realLastSeen = Date.now();
    resetAcc();
    set({
      game: g,
      hydrated: true,
      slot,
      noteFocus: false,
      pendingCoords: null,
    });
    saveGame(g, slot);
  },

  setClockPace: (pace) => {
    const g = get().game;
    setClockPace(g, pace);
    commit(set, get, g);
  },

  toggleLibreta: () => {
    const g = get().game;
    g.libretaOpen = !g.libretaOpen;
    commit(set, get, g);
  },

  pinLibreta: () => {
    const g = get().game;
    g.libretaPinned = !g.libretaPinned;
    if (g.libretaPinned) g.libretaOpen = true;
    commit(set, get, g);
  },

  setNoteFocus: (on) => {
    const g = get().game;
    if (on) g.realLastSeen = Date.now();
    set({ noteFocus: on });
    paint(set, g);
  },

  setPendingCoords: (c) => {
    const g = get().game;
    g.libretaOpen = true;
    set({ pendingCoords: c });
    paint(set, g);
  },
}));

export function readDraft(slot: Slot): Draft {
  return loadDraft(slot);
}

export function writeDraft(slot: Slot, draft: Draft): void {
  saveDraft(slot, draft);
}

if (typeof window !== "undefined") {
  (window as unknown as { __obra: unknown }).__obra = {
    get: () => useObra.getState(),
    slot: () => useObra.getState().slot,
    keys: () => {
      try {
        return Object.keys(window.localStorage).filter((k) =>
          k.startsWith("obra."),
        );
      } catch {
        return [];
      }
    },
  };
}
