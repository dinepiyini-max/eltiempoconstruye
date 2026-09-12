import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHueco, createMuro, FIXTURE_RAMPA, measure } from "./geometry.ts";
import { takeoff, takeoffMuro } from "./quantity.ts";
import { V2_HUECO, V2_MURO, V2_SECTIONS } from "./tables.ts";

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

  it("takeoff de muro 8 m: área = largo × alto, bloques enteros", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const q = takeoffMuro(muro);
    assert.equal(q.largoM, 8);
    assert.equal(q.areaM2, 8 * V2_MURO.altoM);
    assert.equal(q.areaNetaM2, q.areaM2);
    assert.equal(q.volumenM3, 8 * V2_MURO.altoM * V2_MURO.espesorM);
    assert.equal(q.blocksEst, Math.ceil(q.areaM2 / V2_MURO.blockFaceM2));
    assert.ok(q.hormigonM3 > 0);
  });

  it("puerta y ventana bajan área neta y blocks", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const gross = takeoffMuro(muro);
    const puerta = createHueco("puerta", "M-001", 2, "P-001", V2_HUECO.puerta.anchoM);
    const withDoor = takeoffMuro(muro, V2_MURO.altoM, [puerta]);
    assert.ok(withDoor.areaNetaM2 < gross.areaNetaM2);
    assert.ok(withDoor.blocksEst < gross.blocksEst);
    assert.ok(withDoor.vanoM2 > 0);
    const ventana = createHueco("ventana", "M-001", 5.5, "V-001", V2_HUECO.ventana.anchoM);
    const both = takeoffMuro(muro, V2_MURO.altoM, [puerta, ventana]);
    assert.ok(both.areaNetaM2 < withDoor.areaNetaM2);
    assert.ok(both.blocksEst < withDoor.blocksEst);
  });
});
