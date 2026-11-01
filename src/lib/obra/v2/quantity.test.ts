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
  scaleLosaToSides,
} from "./geometry.ts";
import { hojaPresupuesto } from "./cost.ts";
import {
  descuentoVano,
  medicionMuro,
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

  it("losa por lados 4×3 → 8×2 sube el hormigón", () => {
    const a = createLosa(rectPoly({ x: 0, y: 0 }, { x: 4, y: 3 }), "L-001");
    const b = scaleLosaToSides(a, 8, 2);
    const qa = takeoffLosa(a);
    const qb = takeoffLosa(b);
    assert.ok(Math.abs(qa.hormigonM3 - 12 * V2_LOSA_PLANTA.espesorM) < 1e-6);
    assert.ok(Math.abs(qb.hormigonM3 - 16 * V2_LOSA_PLANTA.espesorM) < 1e-6);
    assert.ok(qb.hormigonM3 > qa.hormigonM3);
  });

  it("viga 0.20×0.40 hormigón > 0.15×0.25", () => {
    const slim = createViga({ x: 0, y: 0 }, { x: 4, y: 0 }, "VG-001", 0.15, 0.25);
    const fat = createViga({ x: 0, y: 0 }, { x: 4, y: 0 }, "VG-002", 0.2, 0.4);
    const qs = takeoffViga(slim);
    const qf = takeoffViga(fat);
    assert.ok(Math.abs(qs.hormigonM3 - 4 * 0.15 * 0.25) < 1e-9);
    assert.ok(Math.abs(qf.hormigonM3 - 4 * 0.2 * 0.4) < 1e-9);
    assert.ok(qf.hormigonM3 > qs.hormigonM3);
  });
});

describe("v2 medición de vanos", () => {
  it("solape parcial: unión 2.50 m², no la suma 3.00, neto 7.50, volumen 1.50", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 4, y: 0 }, "M-001", 0.2, 2.5);
    const puerta = createHueco("puerta", "M-001", 1.5, "P-001", 1, 2);
    const ventana = createHueco("ventana", "M-001", 2, "V-001", 1, 1);
    const q = takeoffMuro(muro, undefined, [puerta, ventana]);
    const med = medicionMuro(muro, [puerta, ventana]);
    assert.ok(Math.abs(q.vanoM2 - 2.5) < 1e-9);
    assert.ok(Math.abs(q.areaNetaM2 - 7.5) < 1e-9);
    assert.ok(Math.abs(q.volumenM3 - 1.5) < 1e-9);
    assert.ok(q.areaNetaM2 >= 0);
    assert.equal(med.estado, "recortada");
    assert.ok(med.notas.some((n) => n.includes("unión")));
    const hoja = hojaPresupuesto(takeoffScene({ walls: [muro], openings: [puerta, ventana] }));
    const blocks = hoja.lineas.find((ln) => ln.key === "block6");
    assert.equal(blocks?.qty, q.blocksEst);
    assert.equal(hoja.lineas.find((ln) => ln.key === "hormigon")?.qty, q.hormigonM3);
  });

  it("dos vanos iguales no descuentan dos veces", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const a = createHueco("puerta", "M-001", 4, "P-001", 2, 2);
    const b = createHueco("ventana", "M-001", 4, "V-001", 2, 2);
    const uno = takeoffMuro(muro, undefined, [a]);
    const dos = takeoffMuro(muro, undefined, [a, b]);
    assert.ok(Math.abs(dos.vanoM2 - uno.vanoM2) < 1e-9);
    assert.ok(dos.vanoM2 < 8);
    assert.ok(dos.areaNetaM2 >= 0);
    const marginal = descuentoVano(muro, [a, b], "V-001");
    assert.equal(marginal.areaM2, 0);
    assert.equal(marginal.estado, "recortada");
  });

  it("vano que se sale del muro descuenta solo el tramo interior", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const colgado = createHueco("puerta", "M-001", 0.3, "P-009", 2, 2);
    const q = takeoffMuro(muro, undefined, [colgado]);
    assert.ok(Math.abs(q.vanoM2 - 2.6) < 1e-9);
    assert.ok(q.vanoM2 < 4);
    assert.ok(q.areaNetaM2 > 0);
    const med = medicionMuro(muro, [colgado]);
    assert.equal(med.estado, "recortada");
    assert.ok(med.notas.some((n) => n.startsWith("P-009:")));
  });

  it("vano fuera del muro descuenta 0", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const fuera = createHueco("ventana", "M-001", -10, "V-009", 1, 1);
    const q = takeoffMuro(muro, undefined, [fuera]);
    assert.equal(q.vanoM2, 0);
    assert.equal(q.areaNetaM2, q.areaM2);
    assert.ok(q.volumenM3 >= 0);
  });

  it("alto mayor que el muro se recorta al alto del muro y no pasa de ahí", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 4, y: 0 }, "M-001", 0.15, 2.5);
    const alto = createHueco("puerta", "M-001", 2, "P-003", 1, 4);
    const q = takeoffMuro(muro, undefined, [alto]);
    assert.ok(Math.abs(q.vanoM2 - 2.5) < 1e-9);
    assert.ok(q.areaNetaM2 >= 0);
    assert.ok(q.vanoM2 <= q.areaM2);
    const med = medicionMuro(muro, [alto]);
    assert.equal(med.estado, "recortada");
  });

  it("muchos vanos enormes no dejan área ni volumen negativos", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 4, y: 0 }, "M-001", 0.15, 2.5);
    const vanos = [0, 1, 2, 3, 4].map((i) => createHueco("puerta", "M-001", 2, `P-00${i}`, 20, 20));
    const q = takeoffMuro(muro, undefined, vanos);
    assert.ok(q.areaNetaM2 >= 0);
    assert.ok(q.volumenM3 >= 0);
    assert.ok(q.vanoM2 <= q.areaM2 + 1e-9);
    assert.ok(q.vanoM2 < 20 * 20);
  });

  it("sin largo o sin alto de vano no inventa descuento", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 4, y: 0 }, "M-001", 0.15, 2.5);
    const bruta = takeoffMuro(muro);
    const degenerado = createMuro({ x: 1, y: 1 }, { x: 1, y: 1 }, "M-000");
    const vacio = medicionMuro(degenerado, []);
    assert.equal(vacio.estado, "incompleta");
    assert.equal(vacio.areaNetaM2, null);
    assert.equal(takeoffMuro(degenerado).areaM2, 0);
    assert.equal(takeoffMuro(degenerado).volumenM3, 0);
    const malo = { ...createHueco("puerta", "M-001", 2, "P-008", 1, 2), alto: 0 };
    const med = medicionMuro(muro, [malo]);
    assert.equal(med.estado, "incompleta");
    assert.equal(med.vanoM2, 0);
    assert.ok(Math.abs((med.areaNetaM2 ?? 0) - bruta.areaM2) < 1e-9);
    const d = descuentoVano(muro, [malo], "P-008");
    assert.equal(d.areaM2, null);
  });
});