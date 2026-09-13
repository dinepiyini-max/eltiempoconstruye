import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createColumna,
  createHueco,
  createLosa,
  createMuro,
  createViga,
  createZapata,
  FIXTURE_RAMPA,
  measure,
  rectPoly,
  scaleLosaToArea,
} from "./geometry.ts";
import {
  takeoff,
  takeoffColumna,
  takeoffLosa,
  takeoffMuro,
  takeoffScene,
  takeoffViga,
  takeoffZapata,
} from "./quantity.ts";
import { V2_COLUMNA, V2_HUECO, V2_LOSA_PLANTA, V2_MURO, V2_SECTIONS, V2_VIGA, V2_ZAPATA } from "./tables.ts";

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

  it("columna/zapata/viga/losa suman hormigón y acero; vano resta blocks a la vista", () => {
    const col = createColumna({ x: 1, y: 1 }, "C-001");
    const qc = takeoffColumna(col);
    assert.equal(qc.hormigonM3, V2_COLUMNA.ladoM * V2_COLUMNA.ladoM * V2_COLUMNA.altoM);
    const zap = createZapata({ x: 1, y: 1 }, "Z-001");
    const qz = takeoffZapata(zap);
    assert.equal(qz.hormigonM3, V2_ZAPATA.ladoM * V2_ZAPATA.ladoM * V2_ZAPATA.cantoM);
    const viga = createViga({ x: 0, y: 0 }, { x: 5, y: 0 }, "VG-001");
    const qv = takeoffViga(viga);
    assert.equal(qv.hormigonM3, 5 * V2_VIGA.anchoM * V2_VIGA.cantoM);
    assert.ok(qv.aceroT > 0);
    const losa = createLosa(rectPoly({ x: 0, y: 0 }, { x: 4, y: 3 }), "L-001");
    const ql = takeoffLosa(losa);
    assert.equal(ql.areaM2, 12);
    assert.equal(ql.hormigonM3, 12 * V2_LOSA_PLANTA.espesorM);

    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const puerta = createHueco("puerta", "M-001", 2, "P-001", V2_HUECO.puerta.anchoM);
    const scene = takeoffScene({
      walls: [muro],
      openings: [puerta],
      columns: [col],
      footings: [zap],
      beams: [viga],
      slabs: [losa],
    });
    assert.ok(scene.blocksDelta < 0);
    assert.ok(scene.hormigonM3 > qc.hormigonM3 + qz.hormigonM3);
    assert.equal(scene.losaM2, 12);
    assert.ok(scene.aceroT > 0);
  });

  it("escalar losa 12→6 m² baja el hormigón a la mitad", () => {
    const a = createLosa(rectPoly({ x: 0, y: 0 }, { x: 4, y: 3 }), "L-001");
    const b = scaleLosaToArea(a, 6);
    const qa = takeoffLosa(a);
    const qb = takeoffLosa(b);
    assert.equal(qa.areaM2, 12);
    assert.ok(Math.abs(qb.areaM2 - 6) < 1e-6);
    assert.ok(Math.abs(qb.hormigonM3 - qa.hormigonM3 / 2) < 1e-6);
  });
});