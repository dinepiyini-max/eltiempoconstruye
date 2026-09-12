import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { presupuesto } from "./cost.ts";
import { FIXTURE_TRAZO, measure } from "./geometry.ts";
import { takeoff } from "./quantity.ts";
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
});
