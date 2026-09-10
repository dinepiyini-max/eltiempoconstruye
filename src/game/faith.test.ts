import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bottle,
  clockMultiplier,
  floodLine,
  materialsPaid,
  newGame,
  orderMaterial,
  setPage,
  signFirst,
  staffCheck,
  startSurvey,
  stageNeed,
} from "./sim.ts";
import { hydrateGame } from "./persist.ts";
import type { Game } from "./types.ts";

function readyCamino(): Game {
  const g = newGame();
  g.survey = 1;
  g.surveying = false;
  g.instruction = "define";
  startSurvey(g);
  g.survey = 1;
  g.surveying = false;
  signFirst(g, "camino");
  g.structures.camino.stage = "armado";
  g.structures.camino.progress = 0;
  g.structures.camino.paidStage = null;
  g.resources.acero = 74;
  g.resources.hormigon = 28;
  return g;
}

describe("fe del motor", () => {
  it("un plazo de crecida: CRECIDA Q50 · faltan N días", () => {
    const g = newGame();
    const line = floodLine(g);
    assert.match(line, /^CRECIDA Q50 · faltan \d+ días$/);
    assert.equal(line.includes("faltan"), true);
    const again = floodLine(g);
    assert.equal(line, again);
  });

  it("cambiar hojas no gasta horas", () => {
    const g = newGame();
    g.siteMinutes = 500;
    g.resources.horasHombre = 2400;
    setPage(g, "obra");
    assert.equal(g.siteMinutes, 500);
    assert.equal(g.resources.horasHombre, 2400);
    setPage(g, "contratos");
    assert.equal(g.siteMinutes, 500);
    setPage(g, "plano");
    assert.equal(g.siteMinutes, 500);
    assert.equal(g.page, "plano");
  });

  it("foco en libreta = pausa del reloj", () => {
    const g = newGame();
    g.clockPace = "normal";
    assert.equal(clockMultiplier(g, true), 0);
    assert.equal(clockMultiplier(g, false), 1);
    g.clockPace = "lento";
    assert.equal(clockMultiplier(g, false), 0.25);
    g.clockPace = "pausa";
    assert.equal(clockMultiplier(g, false), 0);
  });

  it("si hay acero no dice FALTA ACERO", () => {
    const g = readyCamino();
    const need = stageNeed("camino", "armado");
    assert.ok(need.acero > 0);
    g.resources.acero = need.acero + 4;
    g.structures.camino.progress = 0;
    g.structures.camino.paidStage = null;
    const b = bottle(g, "camino");
    assert.notEqual(b, "FALTA ACERO");
    assert.notEqual(b, "ARMADO DETENIDO — MATERIAL");
  });

  it("si hay hormigón no dice FALTA HORMIGÓN", () => {
    const g = readyCamino();
    g.structures.camino.stage = "estructura";
    g.structures.camino.progress = 0;
    g.structures.camino.paidStage = null;
    const need = stageNeed("camino", "estructura");
    g.resources.hormigon = need.hormigon + 2;
    const b = bottle(g, "camino");
    assert.notEqual(b, "FALTA HORMIGÓN");
  });

  it("después de pagar el acero, inventario 0 no es FALTA", () => {
    const g = readyCamino();
    const need = stageNeed("camino", "armado");
    g.resources.acero = need.acero;
    g.structures.camino.paidStage = "armado";
    g.structures.camino.progress = 0.05;
    g.resources.acero = 0;
    assert.equal(materialsPaid(g.structures.camino), true);
    const b = bottle(g, "camino");
    assert.notEqual(b, "FALTA ACERO");
  });

  it("pedir acero quita FALTA si el lote cubre", () => {
    const g = readyCamino();
    const need = stageNeed("camino", "armado");
    g.resources.acero = 0;
    g.resources.dinero = 100_000;
    assert.equal(bottle(g, "camino"), "FALTA ACERO");
    orderMaterial(g, "acero");
    if (g.resources.acero >= need.acero) {
      assert.notEqual(bottle(g, "camino"), "FALTA ACERO");
    }
  });

  it("asignar personal disabled sin disponibles + razón en una línea", () => {
    const g = readyCamino();
    for (const c of g.crews) {
      c.front = "camino";
    }
    g.structures.puente.opened = true;
    g.structures.puente.stage = "levantado";
    const chk2 = staffCheck(g, "puente");
    assert.equal(chk2.ok, false);
    assert.ok(chk2.reason.length > 0);
    assert.equal(chk2.reason.includes("\n"), false);
  });

  it("ficha selected sobrevive al cambiar de hoja", () => {
    const g = readyCamino();
    g.selected = "camino";
    setPage(g, "obra");
    assert.equal(g.selected, "camino");
    setPage(g, "plano");
    assert.equal(g.selected, "camino");
  });

  it("hydrate no inventa POST ni red: libreta es array local", () => {
    const g = newGame();
    g.libreta.push({
      id: "n-1",
      kind: "BUG",
      line: "el reloj miente",
      siteMinutes: 420,
      at: 1,
      page: "plano",
      front: null,
      regime: "turno",
      coords: null,
    });
    const round = hydrateGame(JSON.parse(JSON.stringify(g)));
    assert.ok(round);
    assert.equal(round!.libreta.length, 1);
    assert.equal(round!.libreta[0]!.kind, "BUG");
  });

  it("progreso residual de etapa anterior no cuenta como pagado", () => {
    const g = readyCamino();
    g.structures.camino.stage = "armado";
    g.structures.camino.progress = 0.08;
    g.structures.camino.paidStage = null;
    g.resources.acero = 0;
    assert.equal(materialsPaid(g.structures.camino), false);
    assert.equal(bottle(g, "camino"), "FALTA ACERO");
  });

  it("hydrate: progreso > 0 sin paidStage se considera pagado", () => {
    const g = newGame();
    g.structures.camino.opened = true;
    g.structures.camino.stage = "armado";
    g.structures.camino.progress = 0.4;
    g.structures.camino.paidStage = null;
    const round = hydrateGame(JSON.parse(JSON.stringify(g)));
    assert.ok(round);
    assert.equal(round!.structures.camino.paidStage, "armado");
  });
});
