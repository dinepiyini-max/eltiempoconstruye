import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHueco, createLosa, createMuro } from "./geometry.ts";
import { panelCantidad } from "./panel.ts";
import { hojaPresupuesto } from "./cost.ts";
import { takeoffLosa, takeoffMuro, takeoffScene } from "./quantity.ts";

describe("v2 panel cantidad", () => {
  const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
  const losa = createLosa(
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ],
    "L-001",
  );
  const scene = { walls: [muro], openings: [], columns: [], footings: [], beams: [], slabs: [losa] };

  it("sin SEL: hormigón = muro+losa = takeoffScene = hoja PRESUPUESTO", () => {
    const p = panelCantidad(scene, null);
    const sceneQty = takeoffScene(scene);
    const qm = takeoffMuro(muro);
    const ql = takeoffLosa(losa);
    const hoja = hojaPresupuesto(sceneQty);
    const hormigonLine = hoja.lineas.find((ln) => ln.key === "hormigon");
    assert.equal(p.kind, "obra");
    assert.equal(p.hormigonM3, qm.hormigonM3 + ql.hormigonM3);
    assert.equal(p.hormigonM3, sceneQty.hormigonM3);
    assert.equal(p.hormigonM3, hormigonLine?.qty);
    assert.equal(p.aceroT, sceneQty.aceroT);
    assert.ok((p.blocks ?? 0) > 0);
    assert.equal(p.losaM2, 12);
  });

  it("SEL losa: sin blocks ni largo de muro", () => {
    const p = panelCantidad(scene, "L-001");
    const ql = takeoffLosa(losa);
    assert.equal(p.kind, "losa");
    assert.equal(p.blocks, null);
    assert.equal(p.largo, null);
    assert.equal(p.areaNeta, null);
    assert.equal(p.hormigonM3, ql.hormigonM3);
    assert.equal(p.aceroT, ql.aceroT);
    assert.equal(p.losaM2, 12);
  });

  it("SEL muro: blocks de ese id, no de la losa", () => {
    const p = panelCantidad(scene, "M-001");
    const qm = takeoffMuro(muro);
    assert.equal(p.kind, "muro");
    assert.equal(p.blocks, qm.blocksEst);
    assert.equal(p.largo, 8);
    assert.equal(p.hormigonM3, qm.hormigonM3);
    assert.equal(p.losaM2, null);
  });

  it("SEL puerta: ancho + muro padre; no finge área de muro", () => {
    const puerta = createHueco("puerta", "M-001", 2, "P-001", 0.9);
    const withDoor = { ...scene, openings: [puerta] };
    const p = panelCantidad(withDoor, "P-001");
    assert.equal(p.kind, "hueco");
    assert.equal(p.huecoAncho, 0.9);
    assert.equal(p.parentWallId, "M-001");
    assert.equal(p.largo, null);
    assert.equal(p.areaNeta, null);
    assert.equal(p.blocks, null);
    assert.equal(p.hormigonM3, null);
  });
});
