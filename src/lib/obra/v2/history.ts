/**
 * Historial en memoria. Undo / redo. No se persiste.
 */

export type Hist<T> = {
  past: T[];
  present: T;
  future: T[];
};

export const HIST_CAP = 40;

export function histInit<T>(present: T): Hist<T> {
  return { past: [], present, future: [] };
}

export function histPush<T>(h: Hist<T>, next: T, cap = HIST_CAP): Hist<T> {
  const past = h.past.concat([h.present]);
  return {
    past: past.length > cap ? past.slice(past.length - cap) : past,
    present: next,
    future: [],
  };
}

export function histUndo<T>(h: Hist<T>): Hist<T> {
  if (h.past.length === 0) return h;
  const present = h.past[h.past.length - 1]!;
  return {
    past: h.past.slice(0, -1),
    present,
    future: [h.present, ...h.future],
  };
}

export function histRedo<T>(h: Hist<T>): Hist<T> {
  if (h.future.length === 0) return h;
  const present = h.future[0]!;
  return {
    past: h.past.concat([h.present]),
    present,
    future: h.future.slice(1),
  };
}

export function canUndo<T>(h: Hist<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: Hist<T>): boolean {
  return h.future.length > 0;
}
