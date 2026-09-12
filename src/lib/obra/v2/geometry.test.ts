import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CAMINO, MURO, RIVER } from "../terrain.ts";
import {
  FIXTURE_TRAZO,
  cutFillProfile,
  measure,
  polylineLength,
  polylineLengthMeters,
  sampleHeights,
} from "./geometry.ts";

describe("v2 geometry", () => {
  it("largo de fixture > 0 y en metros = largo × escala 2", () => {
    const L = polylineLength(FIXTURE_TRAZO);
    assert.ok(L > 0);
    assert.equal(polylineLengthMeters(FIXTURE_TRAZO), L * 2);
    assert.equal(L, 120 + 60);
  });

  it("cotas son números finitos, una por vértice", () => {
    const h = sampleHeights(FIXTURE_TRAZO);
    assert.equal(h.length, FIXTURE_TRAZO.length);
    for (const z of h) {
      assert.equal(Number.isFinite(z), true);
    }
  });

  it("corte/terraplén son ≥ 0", () => {
    const cf = cutFillProfile(FIXTURE_TRAZO);
    assert.ok(cf.cutM2 >= 0);
    assert.ok(cf.fillM2 >= 0);
    const m = measure(FIXTURE_TRAZO);
    assert.ok(m.largoM > 0);
    assert.equal(m.cutM2, cf.cutM2);
  });

  it("no muta RIVER, CAMINO ni MURO", () => {
    const snap = (pts: { x: number; y: number }[]) => pts.map((p) => ({ x: p.x, y: p.y }));
    const river = snap(RIVER);
    const camino = snap(CAMINO);
    const muro = snap(MURO);
    polylineLength(RIVER);
    measure(CAMINO);
    cutFillProfile(MURO);
    assert.deepEqual(RIVER, river);
    assert.deepEqual(CAMINO, camino);
    assert.deepEqual(MURO, muro);
  });
});
