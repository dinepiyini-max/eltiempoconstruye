/**
 * El objeto vivo. React lee de aquí; sim y persist no conocen React.
 *
 * hydrate(slot)   carga esa caja, aplica el tiempo ausente
 * catchUp()       lo mismo, sin cambiar de caja (al volver a la pestaña)
 * advance(dt)     un frame. Respeta clockPace y el foco de la libreta.
 * flush()         escribe el slot actual. Llamar al ocultar la pestaña.
 * resetValley(keepNotes)  NUEVA PARTIDA. Pregunta explícita por la libreta.
 *
 * Inspección: window.__obra
 */
import { create } from "zustand";
import { createInitialState, SAVE_FAIL_LINE, SITE_MINUTES_PER_REAL_SECOND } from "./catalog";
import { SCRIPT_60 } from "./pliego";
import { loadState, peekLibreta, readSlotFromSearch, saveState } from "./persist";
import {
  acceptContract,
  applyElapsed,
  assignCrew,
  assignFromDisponibles,
  composeResumeLine,
  cycleCrewFront,
  hasSignedFront,
  openStructure,
  orderSupply,
  shiftOficio,
  signFirst,
  startSurvey,
  stepMinutes,
  tickSurveyReal,
  toggleRegime,
  transferTop as moveTop,
} from "./sim";
import type {
  ClockPace,
  FrontId,
  GameState,
  LibretaKind,
  Oficio,
  PageId,
  SaveSlot,
  StructureId,
} from "./types";

function slotFromWindow(): SaveSlot {
  if (typeof window === "undefined") return "jefe";
  return readSlotFromSearch(window.location.search);
}

type ObraStore = {
  game: GameState;
  slot: SaveSlot;
  hydrated: boolean;
  noteFocus: boolean;
  pendingCoords: { x: number; y: number } | null;
  surveyFlashAt: number | null;
  toastAt: number | null;
  toastText: string | null;
  toastUnused: string | null;
  resumeLine: string | null;
  hydrate: (slot: SaveSlot) => void;
  catchUp: () => void;
  advance: (dtSec: number) => void;
  flush: () => void;
  setPage: (page: PageId) => void;
  select: (id: StructureId | null) => void;
  startSurvey: () => void;
  signFirst: (id: StructureId) => void;
  accept: (contractId: string) => void;
  openFront: (id: StructureId) => void;
  assign: (crewId: string, front: FrontId) => void;
  cycleFront: (crewId: string) => void;
  shift: (crewId: string, oficio: Oficio, dir: 1 | -1) => void;
  transferTop: (from: FrontId, to: FrontId) => void;
  staffFront: (id: StructureId) => void;
  toggleRegime: () => void;
  dismissAbsence: () => void;
  order: (kind: "hormigon" | "acero") => void;
  addNote: (kind: LibretaKind, line: string) => void;
  clearNotes: () => void;
  restoreVisita: () => void;
  importVisitaNotes: () => void;
  resetValley: (keepNotes: boolean) => void;
  setClockPace: (pace: ClockPace) => void;
  toggleLibreta: () => void;
  pinLibreta: () => void;
  setNoteFocus: (on: boolean) => void;
  setPendingCoords: (pt: { x: number; y: number } | null) => void;
  dismissResume: () => void;
};

let uiAcc = 0;
let saveAcc = 0;

function resetClocks() {
  uiAcc = 0;
  saveAcc = 0;
}

function notify(set: (p: Partial<ObraStore>) => void, game: GameState) {
  set({
    game: {
      ...game,
      resources: { ...game.resources },
      totals: { ...game.totals },
      structures: Object.fromEntries(
        Object.entries(game.structures).map(([k, v]) => [k, { ...v }]),
      ) as GameState["structures"],
      crews: game.crews.map((c) => ({ ...c })),
      contracts: game.contracts.map((c) => ({ ...c })),
      archive: game.archive.map((a) => ({ ...a })),
      events: game.events.map((e) => ({ ...e })),
      slowdowns: game.slowdowns.map((sl) => ({ ...sl })),
      libreta: game.libreta.map((n) => ({ ...n })),
      prototype: game.prototype ? { ...game.prototype } : null,
    },
  });
}

function persistSlot(
  set: (p: Partial<ObraStore>) => void,
  game: GameState,
  slot: SaveSlot,
): boolean {
  const ok = saveState(game, slot);
  if (!ok) {
    game.lastNotice = game.lastNotice ? `${game.lastNotice} · ${SAVE_FAIL_LINE}` : SAVE_FAIL_LINE;
    notify(set, game);
    set({ toastAt: Date.now(), toastText: SAVE_FAIL_LINE });
  }
  return ok;
}

function commit(set: (p: Partial<ObraStore>) => void, get: () => ObraStore, game: GameState): boolean {
  game.realLastSeen = Date.now();
  const ok = saveState(game, get().slot);
  if (!ok) {
    game.lastNotice = game.lastNotice ? `${game.lastNotice} · ${SAVE_FAIL_LINE}` : SAVE_FAIL_LINE;
  }
  notify(set, game);
  if (!ok) set({ toastAt: Date.now(), toastText: SAVE_FAIL_LINE });
  return ok;
}

function paceScale(game: GameState, noteFocus: boolean): number {
  if (!hasSignedFront(game)) return 0;
  if (noteFocus || game.clockPace === "pausa") return 0;
  if (game.clockPace === "lento") return 0.25;
  return 1;
}

export const useObra = create<ObraStore>((set, get) => ({
  game: createInitialState(),
  slot: slotFromWindow(),
  hydrated: false,
  noteFocus: false,
  pendingCoords: null,
  surveyFlashAt: null,
  toastAt: null,
  toastText: null,
  toastUnused: null,
  resumeLine: null,

  hydrate: (slot) => {
    const prev = get();
    if (prev.hydrated && prev.slot === slot) return;
    if (prev.hydrated && prev.slot !== slot) {
      prev.game.realLastSeen = Date.now();
      persistSlot(set, prev.game, prev.slot);
    }
    const loaded = loadState(slot);
    const base = loaded ?? createInitialState();
    if (base.clockPace !== "pausa") applyElapsed(base, Date.now());
    else base.realLastSeen = Date.now();
    resetClocks();
    const resumeLine = loaded ? composeResumeLine(base) : null;
    set({
      game: base,
      hydrated: true,
      slot,
      noteFocus: false,
      pendingCoords: null,
      surveyFlashAt: null,
      toastAt: null,
      toastText: null,
      toastUnused: null,
      resumeLine,
    });
    persistSlot(set, base, slot);
    if (resumeLine && get().resumeLine !== resumeLine) set({ resumeLine });
  },

  catchUp: () => {
    const { game, slot, hydrated, noteFocus } = get();
    if (!hydrated) return;
    if (noteFocus || game.clockPace === "pausa" || !hasSignedFront(game)) {
      game.realLastSeen = Date.now();
      persistSlot(set, game, slot);
      return;
    }
    applyElapsed(game, Date.now());
    notify(set, game);
    persistSlot(set, game, slot);
    set({ resumeLine: composeResumeLine(game) });
  },

  advance: (dtSec: number) => {
    const { hydrated, slot, noteFocus } = get();
    if (!hydrated) return;
    const cap = Math.min(dtSec, 0.1);
    const game = get().game;
    let flash = false;
    if (game.surveying && game.survey < 1) {
      flash = tickSurveyReal(game, cap);
    }
    const scale = paceScale(game, noteFocus);
    if (scale <= 0) {
      game.realLastSeen = Date.now();
      uiAcc += cap;
      const pulse = game.surveying || flash ? 0.05 : 0.25;
      if (uiAcc >= pulse || flash) {
        uiAcc = 0;
        notify(set, game);
        if (flash) set({ surveyFlashAt: Date.now() });
        if (flash || game.surveying) persistSlot(set, game, slot);
      }
      return;
    }
    game.siteRemainder += cap * SITE_MINUTES_PER_REAL_SECOND * scale;
    const whole = Math.floor(game.siteRemainder);
    if (whole > 0) {
      game.siteRemainder -= whole;
      stepMinutes(game, whole);
    }
    uiAcc += cap;
    saveAcc += cap;
    if (uiAcc >= 0.12 || flash) {
      uiAcc = 0;
      notify(set, game);
      if (flash) set({ surveyFlashAt: Date.now() });
    }
    if (saveAcc >= 6) {
      saveAcc = 0;
      game.realLastSeen = Date.now();
      persistSlot(set, game, slot);
    }
  },

  flush: () => {
    const { game, slot, hydrated } = get();
    if (!hydrated) return;
    game.realLastSeen = Date.now();
    persistSlot(set, game, slot);
  },

  setPage: (page) => {
    const { game } = get();
    game.page = page;
    if (game.libretaPinned) game.libretaOpen = true;
    commit(set, get, game);
  },

  select: (id) => {
    const game = get().game;
    game.selected = id;
    notify(set, game);
  },

  startSurvey: () => {
    const game = get().game;
    startSurvey(game);
    commit(set, get, game);
  },

  signFirst: (id) => {
    const game = get().game;
    signFirst(game, id);
    const stamped = game.lastNotice === SCRIPT_60.firmado;
    commit(set, get, game);
    if (stamped) set({ toastAt: Date.now(), toastText: SCRIPT_60.firmado, toastUnused: null });
  },

  accept: (contractId) => {
    const game = get().game;
    acceptContract(game, contractId);
    const stamped = game.lastNotice === SCRIPT_60.firmado;
    commit(set, get, game);
    if (stamped) set({ toastAt: Date.now(), toastText: SCRIPT_60.firmado, toastUnused: null });
  },

  openFront: (id) => {
    const game = get().game;
    openStructure(game, id);
    commit(set, get, game);
  },

  assign: (crewId, front) => {
    const game = get().game;
    assignCrew(game, crewId, front);
    commit(set, get, game);
  },

  cycleFront: (crewId) => {
    const game = get().game;
    cycleCrewFront(game, crewId);
    commit(set, get, game);
  },

  shift: (crewId, oficio, dir) => {
    const game = get().game;
    shiftOficio(game, crewId, oficio, dir);
    commit(set, get, game);
  },

  transferTop: (from, to) => {
    const game = get().game;
    moveTop(game, from, to);
    const notice = game.lastNotice;
    commit(set, get, game);
    if (notice && notice.startsWith("TOP →")) {
      set({ toastAt: Date.now(), toastText: notice, toastUnused: null });
    }
  },

  staffFront: (id) => {
    const game = get().game;
    assignFromDisponibles(game, id);
    commit(set, get, game);
  },

  toggleRegime: () => {
    const game = get().game;
    toggleRegime(game);
    commit(set, get, game);
  },

  dismissAbsence: () => {
    const game = get().game;
    game.absence = null;
    commit(set, get, game);
  },

  order: (kind) => {
    const game = get().game;
    const result = orderSupply(game, kind);
    commit(set, get, game);
    if (result.ok && result.received) {
      set({
        toastAt: Date.now(),
        toastText: result.received,
        toastUnused: result.unused ?? null,
      });
    } else if (game.lastNotice) {
      set({ toastAt: Date.now(), toastText: game.lastNotice, toastUnused: null });
    }
  },

  addNote: (kind, line) => {
    const trimmed = line.trim().slice(0, 240);
    if (!trimmed) return;
    const { game, pendingCoords } = get();
    game.libreta.push({
      id: `n-${Date.now()}-${game.libreta.length}-${game.seed}`,
      kind,
      line: trimmed,
      siteMinutes: game.siteMinutes,
      at: Date.now(),
      page: game.page,
      front: game.selected,
      regime: game.regime,
      coords: pendingCoords,
    });
    commit(set, get, game);
    set({ pendingCoords: null });
  },

  clearNotes: () => {
    const game = get().game;
    game.libreta = [];
    commit(set, get, game);
  },

  restoreVisita: () => {
    if (get().slot !== "visita") return;
    const notes = get().game.libreta.map((n) => ({ ...n }));
    const base = createInitialState();
    base.libreta = notes;
    base.realLastSeen = Date.now();
    resetClocks();
    set({
      game: base,
      hydrated: true,
      slot: "visita",
      noteFocus: false,
      pendingCoords: null,
      surveyFlashAt: null,
      toastAt: null,
      toastText: null,
      toastUnused: null,
      resumeLine: null,
    });
    persistSlot(set, base, "visita");
  },

  importVisitaNotes: () => {
    if (get().slot !== "jefe") return;
    const incoming = peekLibreta("visita");
    if (!incoming.length) return;
    const game = get().game;
    const have = new Set(game.libreta.map((n) => n.id));
    for (const n of incoming) {
      if (have.has(n.id)) continue;
      game.libreta.push({ ...n });
      have.add(n.id);
    }
    commit(set, get, game);
  },

  resetValley: (keepNotes) => {
    const { slot, game } = get();
    const notes = keepNotes ? game.libreta.map((n) => ({ ...n })) : [];
    const base = createInitialState();
    base.libreta = notes;
    base.libretaOpen = game.libretaOpen;
    base.libretaPinned = game.libretaPinned;
    base.realLastSeen = Date.now();
    resetClocks();
    set({
      game: base,
      hydrated: true,
      slot,
      noteFocus: false,
      pendingCoords: null,
      surveyFlashAt: null,
      toastAt: null,
      toastText: null,
      toastUnused: null,
      resumeLine: null,
    });
    persistSlot(set, base, slot);
  },

  setClockPace: (pace) => {
    const game = get().game;
    if (!hasSignedFront(game)) {
      game.clockPace = "pausa";
      game.lastNotice = SCRIPT_60.hold;
      commit(set, get, game);
      return;
    }
    game.clockPace = pace;
    game.lastNotice =
      pace === "pausa"
        ? "Reloj en pausa. El sitio espera."
        : pace === "lento"
          ? "Reloj lento. El sitio anda a un cuarto."
          : "Reloj normal. El sitio no para salvo que tú pauses.";
    commit(set, get, game);
  },

  toggleLibreta: () => {
    const game = get().game;
    game.libretaOpen = !game.libretaOpen;
    commit(set, get, game);
  },

  pinLibreta: () => {
    const game = get().game;
    game.libretaPinned = !game.libretaPinned;
    if (game.libretaPinned) game.libretaOpen = true;
    commit(set, get, game);
  },

  setNoteFocus: (on) => {
    const game = get().game;
    if (on) game.realLastSeen = Date.now();
    set({ noteFocus: on });
    notify(set, game);
  },

  setPendingCoords: (pt) => {
    const game = get().game;
    game.libretaOpen = true;
    set({ pendingCoords: pt });
    notify(set, game);
  },

  dismissResume: () => {
    set({ resumeLine: null });
  },
}));

declare global {
  interface Window {
    __obra?: {
      get: () => ReturnType<typeof useObra.getState>;
      slot: () => SaveSlot;
      keys: () => string[];
    };
  }
}

if (typeof window !== "undefined") {
  window.__obra = {
    get: () => useObra.getState(),
    slot: () => useObra.getState().slot,
    keys: () => {
      try {
        return Object.keys(window.localStorage).filter((k) => k.startsWith("obra."));
      } catch {
        return [];
      }
    },
  };
}
