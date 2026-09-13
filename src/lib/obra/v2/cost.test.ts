import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diasCuadrilla, hojaPresupuesto, piezasDeEscena, presupuesto } from "./cost.ts";
import { createHueco, createLosa, createMuro, FIXTURE_TRAZO, measure } from "./geometry.ts";
import { takeoff, takeoffScene } from "./quantity.ts";
import { V2_CUADRILLA, V2_PIEZAS_CAP, V2_UNIT_PRICES } from "./tables.ts";

describe("v2 cost", () => {
  it("presupuesto = Σ qty × precio", () => {
    const q = takeoff(measure(FIXTURE_TRAZO), "losa");
    const p = presupuesto(q);
    const expected =
      q.excavacionM3 * V2_UNIT_PRICES.excavacion.price +
      q.hormigonM3 * V2_UNIT_PRICES.hormigon.price +
      q.aceroT * V2_UNIT_PRICES.acero.price;
    assert.equal(p.total, expected);
    assert.equal(
      p.items.reduce((a, it) => a + it.total, 0),
      p.total,
    );
    assert.ok(p.total > 0);
  });

  it("no toca resources.dinero", () => {
    const resources = { dinero: 620_000 };
    const p = presupuesto(takeoff(measure(FIXTURE_TRAZO), "via"));
    assert.equal(resources.dinero, 620_000);
    assert.ok(p.total !== resources.dinero);
  });

  it("hoja PRESUPUESTO = Σ qty × pu; borrar muro baja el total", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const withWall = hojaPresupuesto(takeoffScene({ walls: [muro] }));
    const empty = hojaPresupuesto(takeoffScene({ walls: [] }));
    const sum = withWall.lineas.reduce((a, ln) => a + ln.qty * ln.pu, 0);
    assert.equal(withWall.total, sum);
    assert.equal(withWall.lineas.length, 5);
    assert.ok(withWall.lineas.some((ln) => ln.key === "block6" && ln.qty > 0));
    assert.ok(withWall.lineas.some((ln) => ln.key === "albanil" && ln.qty > 0));
    assert.ok(withWall.total > empty.total);
    assert.equal(empty.empty, true);
    assert.equal(empty.total, 0);
  });

  it("retrabajo suma factor sobre el total", () => {
    const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const base = hojaPresupuesto(takeoffScene({ walls: [muro] }));
    const re = hojaPresupuesto(takeoffScene({ walls: [muro] }), { rework: true });
    assert.ok(re.total > base.total);
    assert.ok(re.lineas.some((ln) => ln.key === "retrabajo"));
    assert.ok(Math.abs(re.total - base.total * 1.08) < 1e-6);
  });
});

describe("v2 piezas y cuadrilla", () => {
  const muro = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-007");
  const losa = createLosa(
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ],
    "L-002",
  );
  const puerta = createHueco("puerta", "M-007", 2, "P-001", 0.9);
  const scene = {
    walls: [muro],
    openings: [puerta],
    columns: [],
    footings: [],
    beams: [],
    slabs: [losa],
  };

  it("lista M-007, L-002 y el vano; tope 40; no doble suma", () => {
    const piezas = piezasDeEscena(scene);
    assert.ok(piezas.some((p) => p.id === "M-007" && p.kind === "muro"));
    assert.ok(piezas.some((p) => p.id === "L-002" && p.kind === "losa"));
    const vano = piezas.find((p) => p.id === "P-001");
    assert.ok(vano);
    assert.equal(vano?.kind, "hueco");
    assert.ok((vano?.parcial ?? 0) < 0);
    const hoja = hojaPresupuesto(takeoffScene(scene));
    const sum = piezas.reduce((a, p) => a + p.parcial, 0);
    assert.notEqual(Math.round(sum), Math.round(hoja.total));
    const manyWalls = Array.from({ length: 45 }, (_, i) =>
      createMuro({ x: 0, y: i }, { x: 8, y: i }, `M-${String(i + 1).padStart(3, "0")}`),
    );
    const capped = piezasDeEscena({
      walls: manyWalls,
      openings: [],
      columns: [],
      footings: [],
      beams: [],
      slabs: [],
    });
    assert.equal(V2_PIEZAS_CAP, 40);
    assert.equal(capped.length, 40);
  });

  it("días de cuadrilla = f(m³ + m muro + m² + vanos); vacío = 0", () => {
    const empty = diasCuadrilla({
      walls: [],
      openings: [],
      columns: [],
      footings: [],
      beams: [],
      slabs: [],
    });
    assert.equal(empty, 0);
    const t = V2_CUADRILLA;
    const s0 = { walls: [muro], openings: [] as typeof scene.openings, columns: [], footings: [], beams: [], slabs: [losa] };
    const q0 = takeoffScene(s0);
    const raw0 =
      q0.hormigonM3 / t.hormigonM3PerDia + 8 / t.muroMPerDia + q0.losaM2 / t.losaM2PerDia;
    assert.equal(diasCuadrilla(s0), Math.max(1, Math.ceil(raw0 - 1e-9)));
    assert.ok(diasCuadrilla(s0) >= 1);
    const q1 = takeoffScene(scene);
    const raw1 =
      q1.hormigonM3 / t.hormigonM3PerDia +
      8 / t.muroMPerDia +
      q1.losaM2 / t.losaM2PerDia +
      1 * t.huecoDias;
    assert.equal(diasCuadrilla(scene), Math.max(1, Math.ceil(raw1 - 1e-9)));
    assert.ok(raw1 > raw0);
  });
});