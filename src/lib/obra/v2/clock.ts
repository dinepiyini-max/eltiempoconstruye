/**
 * Reloj y frentes de NUEVA OBRA.
 * No importa el simulador del valle. No lee su reloj ni su línea de crecida.
 */
import type { Columna, Hueco, Losa, Muro, Viga, Zapata } from "./geometry.ts";

export type FrenteId = "cim" | "est" | "alb";
export type V2Pace = "pausa" | "normal";
export type V2PlacaEstado = "abierta" | "cerrada" | "ejecutada";
export type FrenteStatus = "na" | "locked" | "active" | "done";

export const FRENTE_ORDER: FrenteId[] = ["cim", "est", "alb"];

export const FRENTE_LABEL: Record<FrenteId, string> = {
  cim: "CIMENTACIÓN",
  est: "ESTRUCTURA",
  alb: "ALBAÑILERÍA",
};

export const FRENTE_NA: Record<FrenteId, string> = {
  cim: "N/A · no hay zapatas",
  est: "N/A · no hay columnas, vigas ni losas",
  alb: "N/A · no hay muros",
};

/** % por segundo en NORMAL. Visible al dedo; no es el reloj del valle. */
export const V2_CLOCK = {
  normalPctPerSec: 8,
} as const;

export type FrontDone = { cim: number; est: number; alb: number };
export type FrontScope = FrontDone;

export type V2ClockState = {
  running: boolean;
  pace: V2Pace;
  laminaMs: number;
  startedAt: string | null;
  done: FrontDone;
  rework: boolean;
  executed: boolean;
  /** Esta lámina ya tiene placa. No clonar. */
  sealed: boolean;
  placaId: string | null;
};

export type FrenteVista = {
  id: FrenteId;
  label: string;
  present: boolean;
  work: number;
  done: number;
  pct: number;
  status: FrenteStatus;
  naLine: string;
};

export type SceneForClock = {
  walls: readonly Muro[];
  openings?: readonly Hueco[];
  columns?: readonly Columna[];
  footings?: readonly Zapata[];
  beams?: readonly Viga[];
  slabs?: readonly Losa[];
};

export function idleClock(): V2ClockState {
  return {
    running: false,
    pace: "pausa",
    laminaMs: 0,
    startedAt: null,
    done: { cim: 0, est: 0, alb: 0 },
    rework: false,
    executed: false,
    sealed: false,
    placaId: null,
  };
}

/** Lámina en curso (tarjeta ABIERTA). Sellada = ya hay placa. */
export function laminaAbierta(clock: Pick<V2ClockState, "sealed" | "placaId">): boolean {
  return clock.sealed !== true && !clock.placaId;
}

export function scopeFromScene(s: SceneForClock): FrontScope {
  return {
    cim: (s.footings ?? []).length,
    est: (s.columns ?? []).length + (s.beams ?? []).length + (s.slabs ?? []).length,
    alb: (s.walls ?? []).length,
  };
}

export function clampDone(done: FrontDone, scope: FrontScope): FrontDone {
  return {
    cim: Math.max(0, Math.min(scope.cim, done.cim)),
    est: Math.max(0, Math.min(scope.est, done.est)),
    alb: Math.max(0, Math.min(scope.alb, done.alb)),
  };
}

export function pctOf(done: number, work: number): number {
  if (work <= 0) return 0;
  return Math.max(0, Math.min(100, (done / work) * 100));
}

export function assembleFrentes(scope: FrontScope, done: FrontDone): FrenteVista[] {
  const clamped = clampDone(done, scope);
  const rows: FrenteVista[] = FRENTE_ORDER.map((id) => {
    const work = scope[id];
    const present = work > 0;
    return {
      id,
      label: FRENTE_LABEL[id],
      present,
      work,
      done: clamped[id],
      pct: present ? pctOf(clamped[id], work) : 0,
      status: "na" as FrenteStatus,
      naLine: FRENTE_NA[id],
    };
  });
  let priorOk = true;
  for (const row of rows) {
    if (!row.present) {
      row.status = "na";
      continue;
    }
    if (row.pct >= 99.5) {
      row.status = "done";
      row.pct = 100;
      row.done = row.work;
      continue;
    }
    if (!priorOk) {
      row.status = "locked";
      continue;
    }
    row.status = "active";
    priorOk = false;
  }
  return rows;
}

export function activeFrente(frentes: readonly FrenteVista[]): FrenteVista | null {
  return frentes.find((f) => f.status === "active") ?? null;
}

export function allPresentDone(frentes: readonly FrenteVista[]): boolean {
  const present = frentes.filter((f) => f.present);
  return present.length > 0 && present.every((f) => f.status === "done");
}

export function tickFronts(
  done: FrontDone,
  scope: FrontScope,
  dtSec: number,
  pace: V2Pace,
): { done: FrontDone; delta: { id: FrenteId; pct: number } | null; laminaMs: number } {
  const ms = Math.max(0, dtSec) * 1000;
  if (pace !== "normal" || dtSec <= 0) {
    return { done: clampDone(done, scope), delta: null, laminaMs: 0 };
  }
  const frentes = assembleFrentes(scope, done);
  const active = activeFrente(frentes);
  if (!active) {
    return { done: clampDone(done, scope), delta: null, laminaMs: ms };
  }
  const before = active.pct;
  const add = (active.work * V2_CLOCK.normalPctPerSec) / 100 * dtSec;
  const nextDone = clampDone({ ...done, [active.id]: done[active.id] + add }, scope);
  const after = assembleFrentes(scope, nextDone).find((f) => f.id === active.id);
  const pct = after ? after.pct - before : 0;
  return {
    done: nextDone,
    delta: pct > 0.05 ? { id: active.id, pct } : null,
    laminaMs: ms,
  };
}

export function formatLaminaClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function absenceLine(delta: { id: FrenteId; pct: number } | null): string | null {
  if (!delta || delta.pct < 0.5) return null;
  return `Mientras no mirabas: ${FRENTE_LABEL[delta.id]} +${Math.round(delta.pct)}%`;
}
