import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createColumna, createHueco, createLosa, createMuro, createViga, createZapata } from "./geometry.ts";
import { panelCantidad } from "./panel.ts";
import { hojaPresupuesto } from "./cost.ts";
import { takeoffLosa, takeoffMuro, takeoffScene } from "./quantity.ts";
import { V2_MURO } from "./tables.ts";

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

  it("SEL losa: sin blocks ni largo de muro; espesor propio", () => {
    const p = panelCantidad(scene, "L-001");
    const ql = takeoffLosa(losa);
    assert.equal(p.kind, "losa");
    assert.equal(p.blocks, null);
    assert.equal(p.largo, null);
    assert.equal(p.areaNeta, null);
    assert.equal(p.hiladas, null);
    assert.equal(p.hormigonM3, ql.hormigonM3);
    assert.equal(p.aceroT, ql.aceroT);
    assert.equal(p.losaM2, 12);
    assert.equal(p.espesor, 0.12);
  });

  it("SEL muro: blocks de ese id, alto 2.60, 13 hiladas", () => {
    const p = panelCantidad(scene, "M-001");
    const qm = takeoffMuro(muro);
    assert.equal(p.kind, "muro");
    assert.equal(p.blocks, qm.blocksEst);
    assert.equal(p.largo, 8);
    assert.equal(p.alto, V2_MURO.altoM);
    assert.equal(p.hiladas, 13);
    assert.equal(p.hormigonM3, qm.hormigonM3);
    assert.equal(p.losaM2, null);
    assert.equal(p.vanos, 0);
  });

  it("SEL puerta: ancho + muro padre + −blocks; no finge área de muro", () => {
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
    assert.ok(p.blocksDelta < 0);
  });

  it("SEL columna/zapata/viga: sección o largo + m³, sin blocks de muro", () => {
    const col = createColumna({ x: 1, y: 1 }, "C-001");
    const zap = createZapata({ x: 1, y: 1 }, "Z-001");
    const viga = createViga({ x: 0, y: 0 }, { x: 5, y: 0 }, "VG-001");
    const s = { walls: [muro], openings: [], columns: [col], footings: [zap], beams: [viga], slabs: [losa] };
    const pc = panelCantidad(s, "C-001");
    assert.equal(pc.kind, "columna");
    assert.equal(pc.seccion, "0.30 × 0.30 m");
    assert.equal(pc.blocks, null);
    assert.ok((pc.hormigonM3 ?? 0) > 0);
    const pz = panelCantidad(s, "Z-001");
    assert.equal(pz.kind, "zapata");
    assert.equal(pz.seccion, "0.80 × 0.80 m");
    assert.equal(pz.blocks, null);
    const pv = panelCantidad(s, "VG-001");
    assert.equal(pv.kind, "viga");
    assert.equal(pv.largo, 5);
    assert.equal(pv.seccion, "0.20 × 0.30 m");
    assert.equal(pv.blocks, null);
  });
});
