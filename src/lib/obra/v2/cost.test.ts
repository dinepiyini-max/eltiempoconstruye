import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hojaPresupuesto, presupuesto } from "./cost.ts";
import { createMuro, FIXTURE_TRAZO, measure } from "./geometry.ts";
import { takeoff, takeoffScene } from "./quantity.ts";
import { V2_UNIT_PRICES } from "./tables.ts";

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
});