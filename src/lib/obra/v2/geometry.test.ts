import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CAMINO, MURO, RIVER } from "../terrain.ts";
import {
  FIXTURE_TRAZO,
  alongMuro,
  clampHuecoAlong,
  createColumna,
  createHueco,
  createLosa,
  createMuro,
  createViga,
  cutFillProfile,
  formatMeters,
  hitSquare,
  huecoAnchoDefault,
  huecoEnds,
  huecoId,
  huecoOverlaps,
  lengthMeters,
  losaArea,
  losaLados,
  measure,
  muroHiladas,
  muroId,
  muroLargo,
  muroParts,
  muroPoly,
  parseMeters,
  placeHuecoOnMuro,
  polygonArea,
  polylineLength,
  polylineLengthMeters,
  rectPoly,
  sampleHeights,
  scaleLosaToArea,
  scaleLosaToSides,
  scaleMuroFromStart,
  scaleVigaFromStart,
  setHuecoMedida,
  snapDraft,
  snapZapataCenter,
  structId,
  vigaLargo,
} from "./geometry.ts";
import { V2_HUECO, V2_MURO } from "./tables.ts";

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

  it("muro (0,0)→(8,0) mide 8.00 m", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 8, y: 0 };
    assert.equal(lengthMeters(a, b), 8);
    const muro = createMuro(a, b, muroId(1));
    assert.equal(muroLargo(muro), 8);
    assert.equal(formatMeters(muroLargo(muro)), "8.00 m");
    assert.equal(muro.id, "M-001");
    assert.equal(muro.espesor, V2_MURO.espesorM);
    assert.equal(V2_MURO.espesorM, 0.15);
    assert.equal(muroPoly(muro).length, 4);
  });

  it("snap horizontal, vertical y esquina", () => {
    const origin = { x: 0, y: 0 };
    const h = snapDraft({ x: 8, y: 0.2 }, origin, []);
    assert.equal(h.kind, "horizontal");
    assert.equal(h.point.y, 0);
    assert.equal(h.point.x, 8);

    const v = snapDraft({ x: 0.2, y: 8 }, origin, []);
    assert.equal(v.kind, "vertical");
    assert.equal(v.point.x, 0);
    assert.equal(v.point.y, 8);

    const e = snapDraft({ x: 7.9, y: 0.1 }, origin, [{ x: 8, y: 0 }]);
    assert.equal(e.kind, "esquina");
    assert.equal(e.point.x, 8);
    assert.equal(e.point.y, 0);
  });

  it("hueco ligado al muro: vano recorta la línea y no flota", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    assert.equal(huecoAnchoDefault("puerta"), 0.9);
    assert.equal(huecoAnchoDefault("ventana"), 1.2);
    assert.equal(huecoId("puerta", 1), "P-001");
    assert.equal(alongMuro(muro, { x: 4, y: 0.1 }), 4);

    const puerta = placeHuecoOnMuro("puerta", muro, { x: 4, y: 0 }, [], huecoId("puerta", 1));
    assert.ok(puerta);
    assert.equal(puerta.wallId, "M-001");
    assert.equal(puerta.ancho, 0.9);
    assert.ok(Math.abs(puerta.alongM - 4) < 1e-9);
    const ends = huecoEnds(muro, puerta)!;
    assert.ok(Math.abs(lengthMeters(ends.a, ends.b) - 0.9) < 1e-9);

    const parts = muroParts(muro, [puerta]);
    assert.equal(parts.length, 2);
    const gap = lengthMeters(parts[0]!.b, parts[1]!.a);
    assert.ok(Math.abs(gap - 0.9) < 1e-6);

    const tooShort = createMuro({ x: 0, y: 0 }, { x: 0.5, y: 0 }, "M-002");
    assert.equal(placeHuecoOnMuro("puerta", tooShort, { x: 0.25, y: 0 }, [], "P-002"), null);
    assert.equal(clampHuecoAlong(0.5, 0.9, 0.25), null);

    const dup = placeHuecoOnMuro("ventana", muro, { x: 4, y: 0 }, [puerta], "V-001");
    assert.equal(dup, null);
    assert.equal(huecoOverlaps(puerta, createHueco("ventana", "M-001", 4, "V-x", 1.2)), true);
    assert.ok(V2_HUECO.puerta.anchoM === 0.9);
  });

  it("columna 0.30, zapata 0.80 bajo columna, viga y losa medidas", () => {
    const col = createColumna({ x: 2, y: 2 }, structId("C", 1));
    assert.equal(col.id, "C-001");
    assert.equal(col.lado, 0.3);
    const under = snapZapataCenter({ x: 2.2, y: 2.1 }, [col], 0.5);
    assert.equal(under.columnId, "C-001");
    assert.equal(under.c.x, 2);
    assert.equal(under.c.y, 2);
    const far = snapZapataCenter({ x: 10, y: 10 }, [col], 0.5);
    assert.equal(far.columnId, null);
    const viga = createViga({ x: 0, y: 0 }, { x: 4, y: 0 }, structId("VG", 1));
    assert.equal(vigaLargo(viga), 4);
    const losa = createLosa(rectPoly({ x: 0, y: 0 }, { x: 4, y: 3 }), structId("L", 1));
    assert.equal(losaArea(losa), 12);
    assert.equal(polygonArea(rectPoly({ x: 0, y: 0 }, { x: 4, y: 3 })), 12);
    assert.equal(hitSquare({ x: 2, y: 2 }, col.c, col.lado, 0), true);
    assert.equal(hitSquare({ x: 3, y: 3 }, col.c, col.lado, 0), false);
  });

  it("14.76 → 8.00 escala desde el arranque con snap H/V", () => {
    const h = createMuro({ x: 0, y: 2 }, { x: 14.76, y: 2.05 }, "M-001");
    const n = scaleMuroFromStart(h, 8);
    assert.equal(n.a.x, 0);
    assert.equal(n.a.y, 2);
    assert.equal(muroLargo(n), 8);
    assert.equal(n.b.y, 2);
    assert.equal(n.b.x, 8);
    const v = createMuro({ x: 3, y: 0 }, { x: 3.04, y: 14.76 }, "M-002");
    const nv = scaleMuroFromStart(v, 8);
    assert.equal(nv.a.x, 3);
    assert.equal(nv.a.y, 0);
    assert.equal(nv.b.x, 3);
    assert.equal(muroLargo(nv), 8);
    assert.equal(parseMeters("8,00"), 8);
    assert.equal(parseMeters("8.00"), 8);
    assert.equal(muroHiladas(V2_MURO.altoM), 13);
    assert.equal(V2_MURO.altoM, 2.6);
    assert.equal(V2_MURO.hiladaM, 0.2);
  });

  it("losa 12 m² → 6 m² escala el polígono y el área", () => {
    const losa = createLosa(rectPoly({ x: 0, y: 0 }, { x: 4, y: 3 }), "L-001");
    assert.equal(losaArea(losa), 12);
    const n = scaleLosaToArea(losa, 6);
    assert.ok(Math.abs(losaArea(n) - 6) < 1e-6);
    assert.equal(n.id, "L-001");
    assert.equal(losaArea(losa), 12);
  });

  it("losa por lados: 4×3 → 8×2; largo = lado mayor", () => {
    const losa = createLosa(rectPoly({ x: 0, y: 0 }, { x: 4, y: 3 }), "L-001");
    assert.deepEqual(losaLados(losa), { largo: 4, ancho: 3 });
    const n = scaleLosaToSides(losa, 8, 2);
    const lados = losaLados(n);
    assert.ok(Math.abs(lados.largo - 8) < 1e-6);
    assert.ok(Math.abs(lados.ancho - 2) < 1e-6);
    assert.ok(Math.abs(losaArea(n) - 16) < 1e-6);
    assert.equal(n.id, "L-001");
    assert.equal(losa.espesor, n.espesor);
  });

  it("viga escala desde el arranque y conserva canto", () => {
    const v = createViga({ x: 0, y: 1 }, { x: 5, y: 1 }, "VG-001", 0.15, 0.25);
    const n = scaleVigaFromStart(v, 8);
    assert.equal(n.a.x, 0);
    assert.equal(n.a.y, 1);
    assert.equal(vigaLargo(n), 8);
    assert.equal(n.ancho, 0.15);
    assert.equal(n.canto, 0.25);
  });

  it("puerta 0.90 → 1.80 cabe en muro 8 m y no solapa", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const p = createHueco("puerta", "M-001", 3, "P-001", 0.9);
    const n = setHuecoMedida(p, muro, [], V2_HUECO.marquesina.anchoM, V2_HUECO.marquesina.altoM);
    assert.ok(n);
    assert.equal(n?.ancho, 1.8);
    assert.equal(n?.alto, 2.1);
    assert.equal(n?.id, "P-001");
  });
});
