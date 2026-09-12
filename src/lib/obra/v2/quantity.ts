/**
 * Quantity V2 — takeoff. Tablas propias. No lee STRUCTURE_DEF.
 */
import type { Measured } from "./geometry.ts";
import { V2_SECTIONS, type V2Kind } from "./tables.ts";

export type Takeoff = {
  kind: V2Kind;
  largoM: number;
  excavacionM3: number;
  hormigonM3: number;
  aceroT: number;
};

export function takeoff(m: Measured, kind: V2Kind): Takeoff {
  const sec = V2_SECTIONS[kind];
  const excavacionM3 = Math.max(0, (m.cutM2 + m.fillM2) * sec.cutWidthM);
  const hormigonM3 = Math.max(0, m.largoM * sec.hormigonM2);
  const aceroT = Math.max(0, hormigonM3 * sec.steelTPerM3);
  return { kind, largoM: m.largoM, excavacionM3, hormigonM3, aceroT };
}
