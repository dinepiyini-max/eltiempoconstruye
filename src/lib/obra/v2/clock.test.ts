import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMuro, createZapata } from "./geometry.ts";
import {
  absenceLine,
  allPresentDone,
  assembleFrentes,
  clampDone,
  formatLaminaClock,
  idleClock,
  laminaAbierta,
  scopeFromScene,
  tickFronts,
} from "./clock.ts";

describe("v2 clock aislado", () => {
  it("clock.ts no nombra siteMinutes, floodLine ni advance", () => {
    const src = readFileSync(fileURLToPath(new URL("./clock.ts", import.meta.url)), "utf8");
    assert.equal(/siteMinutes/.test(src), false);
    assert.equal(/floodLine/.test(src), false);
    assert.equal(/from ["'][^"']*sim/.test(src), false);
  });

  it("store V2 no importa sim.ts ni nombra siteMinutes", () => {
    const src = readFileSync(fileURLToPath(new URL("./store.ts", import.meta.url)), "utf8");
    assert.equal(/from ["'][^"']*sim/.test(src), false);
    assert.equal(/siteMinutes/.test(src), false);
    assert.equal(/floodLine/.test(src), false);
    assert.equal(/obra\.jefe/.test(src), false);
  });

  it("sin zapatas ni columnas: cim y est N/A; muro abre albañilería", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const scope = scopeFromScene({ walls: [muro], footings: [], columns: [] });
    const frentes = assembleFrentes(scope, { cim: 0, est: 0, alb: 0 });
    assert.equal(frentes.find((f) => f.id === "cim")?.status, "na");
    assert.equal(frentes.find((f) => f.id === "est")?.status, "na");
    assert.equal(frentes.find((f) => f.id === "alb")?.status, "active");
    assert.match(frentes.find((f) => f.id === "cim")?.naLine ?? "", /zapatas/);
  });

  it("NORMAL mueve % del frente activo", () => {
    const zap = createZapata({ x: 1, y: 1 }, "Z-001");
    const scope = scopeFromScene({ walls: [], footings: [zap], columns: [] });
    const t = tickFronts({ cim: 0, est: 0, alb: 0 }, scope, 2, "normal");
    assert.ok(t.done.cim > 0);
    const after = assembleFrentes(scope, t.done);
    const cim = after.find((f) => f.id === "cim")!;
    assert.ok(cim.pct > 0);
    const paused = tickFronts(t.done, scope, 2, "pausa");
    assert.equal(paused.done.cim, t.done.cim);
  });

  it("borrar muro a mitad recorta el alcance", () => {
    const a = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const b = createMuro({ x: 0, y: 2 }, { x: 8, y: 2 }, "M-002");
    const full = scopeFromScene({ walls: [a, b] });
    const mid = tickFronts({ cim: 0, est: 0, alb: 0 }, full, 4, "normal");
    assert.ok(mid.done.alb > 0);
    const afterDel = clampDone(mid.done, scopeFromScene({ walls: [a] }));
    assert.ok(afterDel.alb <= 1);
    const fr = assembleFrentes(scopeFromScene({ walls: [a] }), afterDel);
    assert.equal(fr.find((f) => f.id === "alb")?.work, 1);
  });

  it("tres frentes presentes al 100% = ejecutada", () => {
    const scope = { cim: 1, est: 1, alb: 1 };
    const done = { cim: 1, est: 1, alb: 1 };
    assert.equal(allPresentDone(assembleFrentes(scope, done)), true);
  });

  it("13s NORMAL cierra un frente de 1 unidad; ausencia nombra el frente", () => {
    const zap = createZapata({ x: 1, y: 1 }, "Z-001");
    const scope = scopeFromScene({ walls: [], footings: [zap], columns: [] });
    const t = tickFronts({ cim: 0, est: 0, alb: 0 }, scope, 13, "normal");
    const after = assembleFrentes(scope, t.done);
    assert.equal(after.find((f) => f.id === "cim")?.status, "done");
    assert.match(absenceLine({ id: "alb", pct: 12 }) ?? "", /ALBAÑILERÍA \+12%/);
    assert.equal(formatLaminaClock(125000), "02:05");
  });

  it("lámina abierta hasta sello; placaId también sella", () => {
    const idle = idleClock();
    assert.equal(laminaAbierta(idle), true);
    assert.equal(laminaAbierta({ ...idle, sealed: true, placaId: "A-001" }), false);
    assert.equal(laminaAbierta({ ...idle, sealed: false, placaId: "A-002" }), false);
  });
});
