import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_RAMPA, measure } from "./geometry.ts";
import { takeoff } from "./quantity.ts";
import { V2_SECTIONS } from "./tables.ts";

describe("v2 quantity", () => {
  it("takeoff m³ y t son ≥ 0 y hormigón = largo × sección V2", () => {
    const m = measure(FIXTURE_RAMPA);
    const q = takeoff(m, "via");
    assert.ok(q.largoM > 0);
    assert.ok(q.excavacionM3 >= 0);
    assert.ok(q.hormigonM3 >= 0);
    assert.ok(q.aceroT >= 0);
    assert.equal(q.hormigonM3, m.largoM * V2_SECTIONS.via.hormigonM2);
    assert.equal(q.aceroT, q.hormigonM3 * V2_SECTIONS.via.steelTPerM3);
  });

  it("las tres secciones V2 no son el catálogo Yuna: hormigón crece con el largo", () => {
    const m = measure(FIXTURE_RAMPA);
    const via = takeoff(m, "via");
    const muro = takeoff(m, "contencion");
    const losa = takeoff(m, "losa");
    assert.notEqual(via.hormigonM3, muro.hormigonM3);
    assert.notEqual(via.hormigonM3, losa.hormigonM3);
    assert.ok(losa.hormigonM3 > via.hormigonM3);
  });
});
