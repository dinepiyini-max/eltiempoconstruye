import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CAMINO, MURO, RIVER } from "../terrain.ts";
import {
  FIXTURE_TRAZO,
  alongMuro,
  clampHuecoAlong,
  createHueco,
  createMuro,
  cutFillProfile,
  formatMeters,
  huecoAnchoDefault,
  huecoEnds,
  huecoId,
  huecoOverlaps,
  lengthMeters,
  measure,
  muroId,
  muroLargo,
  muroParts,
  muroPoly,
  placeHuecoOnMuro,
  polylineLength,
  polylineLengthMeters,
  sampleHeights,
  snapDraft,
} from "./geometry.ts";
import { V2_HUECO } from "./tables.ts";

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
    assert.equal(muro.espesor, 0.2);
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
});
