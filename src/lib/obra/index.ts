/**
 * OBRA — mapa del sistema. Léelo primero.
 *
 *   types.ts     qué es una partida (GameState)
 *   pliego.ts    quién te contrató, la crecida, el propósito de cada frente
 *   catalog.ts   constantes: río, salarios, horas, materiales, claves de save
 *   terrain.ts   geometría del valle (no es estado; se recalcula)
 *   sim.ts       el reloj: cada minuto de sitio, qué pasa
 *   persist.ts   localStorage. Dos cajas: obra.jefe y obra.visita. Nunca se mezclan.
 *   store.ts     el único objeto vivo que ve React (useObra)
 *   format.ts    reloj y números para la UI
 *   draw.ts      pinta el plano. No decide nada.
 *
 * Hojas del documento: PLANO · OBRA · CONTRATOS · ARCHIVO.
 * LIBRETA es un panel dock, siempre montado. No es una hoja.
 *
 * Reloj: clockPace NORMAL | LENTO | PAUSA. El sitio no avanza por leer la UI.
 * Crecida: floodLine(state) es la única cifra de “faltan N días”.
 *
 * Verbos: startSurvey, signFirst, accept, staffFront, shift, cycleFront,
 *   toggleRegime, order, addNote, restoreVisita, importVisitaNotes,
 *   resetValley(keepNotes), setClockPace, toggleLibreta
 *
 *   window.__obra.get()   estado vivo
 *   window.__obra.slot()  "jefe" | "visita"
 */
export { useObra } from "./store";
export { SLOT_KEYS, SITE_MINUTES_PER_REAL_SECOND, OFFLINE_CAP_MS } from "./catalog";
export { FLOOD, MANDANTE, ENCARGO_LINE, TESIS } from "./pliego";
export { floodLine } from "./sim";
export { readSlotFromSearch, saveState, loadState } from "./persist";
