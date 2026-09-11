/**
 * Inspección de partida. Solo se carga en DEV (import dinámico).
 * Lectura: get / slot / keys. Sin mutators.
 */
import { useObra } from "./store";

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
