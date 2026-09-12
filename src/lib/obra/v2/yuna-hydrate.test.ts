import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../catalog.ts";
import { clockParts } from "../format.ts";
import { FLOOD } from "../pliego.ts";
import { hydrateParsed, snapshotState } from "../persist.ts";
import { daysUntilFlood, floodLine, signFirst } from "../sim.ts";

describe("v2 no pisa el save Yuna", () => {
  it("hidratar save Yuna V1 sigue igual (día, frentes, Q50)", () => {
    const s = createInitialState();
    s.survey = 1;
    s.instruction = "define";
    signFirst(s, "puente");
    s.siteMinutes = 4 * 24 * 60 + 3 * 60;
    s.phase = 2;
    s.structures.puente.stage = "excavacion";
    const day = clockParts(s.siteMinutes).day;
    const q50 = floodLine(s);
    const n = daysUntilFlood(s);

    const round = hydrateParsed(JSON.parse(JSON.stringify(snapshotState(s))));
    assert.ok(round);
    assert.equal(round.version, 1);
    assert.equal(clockParts(round.siteMinutes).day, day);
    assert.equal(round.structures.puente.opened, true);
    assert.equal(round.structures.puente.stage, "excavacion");
    assert.equal(round.structures.camino.opened, false);
    assert.equal(round.structures.muro.opened, false);
    assert.equal(round.floodStatus, "pendiente");
    assert.equal(floodLine(round), q50);
    assert.equal(daysUntilFlood(round), n);
    assert.equal(FLOOD.day, 12);
    assert.match(q50, /Q50/);
    assert.match(q50, /faltan/);
  });
});
