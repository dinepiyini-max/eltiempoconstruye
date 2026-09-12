import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHueco, createMuro } from "./geometry.ts";
import {
  V2_BAK_KEY,
  V2_FORBIDDEN_KEYS,
  V2_LIVE_KEY,
  emptyV2,
  hydrateV2,
  loadV2,
  saveV2,
  snapshotV2,
} from "./persist-v2.ts";

class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe("v2 persist aislamiento", () => {
  it("claves propias, distintas de jefe y visita", () => {
    assert.equal(V2_LIVE_KEY, "obra.v2");
    assert.equal(V2_BAK_KEY, "obra.v2.bak");
    assert.notEqual(V2_LIVE_KEY, "obra.jefe");
    assert.notEqual(V2_LIVE_KEY, "obra.visita");
    assert.notEqual(V2_BAK_KEY, "obra.jefe.bak");
    assert.notEqual(V2_BAK_KEY, "obra.visita.bak");
    assert.ok(V2_FORBIDDEN_KEYS.includes("obra.jefe"));
    assert.ok(V2_FORBIDDEN_KEYS.includes("obra.visita"));
  });

  it("saveV2 escribe obra.v2 y no pisa jefe/visita", () => {
    const storage = new Mem();
    const yuna = JSON.stringify({ version: 1, siteMinutes: 99, page: "plano" });
    storage.setItem("obra.jefe", yuna);
    storage.setItem("obra.visita", yuna);
    const doc = emptyV2();
    doc.walls = [createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001")];
    doc.nextSeq = 2;
    assert.equal(saveV2(doc, storage), true);
    assert.equal(storage.getItem("obra.jefe"), yuna);
    assert.equal(storage.getItem("obra.visita"), yuna);
    assert.equal(storage.getItem("obra.jefe.bak"), null);
    assert.equal(storage.getItem("obra.visita.bak"), null);
    assert.ok(storage.getItem(V2_LIVE_KEY));
    const loaded = loadV2(storage);
    assert.equal(loaded.walls.length, 1);
    assert.equal(loaded.walls[0]?.id, "M-001");
    assert.equal(loaded.product, "obra.v2");
    const parsed = JSON.parse(storage.getItem(V2_LIVE_KEY)!);
    assert.equal(parsed.product, "obra.v2");
    assert.ok(!("siteMinutes" in parsed));
  });

  it("un save Yuna version:1 no hidrata como V2", () => {
    assert.equal(hydrateV2({ version: 1, siteMinutes: 12, page: "plano" }), null);
    assert.equal(hydrateV2({ version: 1, walls: [] }), null);
    const ok = hydrateV2(
      snapshotV2({ ...emptyV2(), walls: [createMuro({ x: 1, y: 1 }, { x: 5, y: 1 }, "M-007")] }),
    );
    assert.ok(ok);
    assert.equal(ok.walls[0]?.id, "M-007");
  });

  it("F5 conserva muros + huecos; save viejo sin openings sigue", () => {
    const storage = new Mem();
    const wall = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const door = createHueco("puerta", "M-001", 3, "P-001", 0.9);
    const doc = {
      ...emptyV2(),
      walls: [wall],
      openings: [door],
      nextSeq: 2,
      nextHuecoSeq: 2,
    };
    assert.equal(saveV2(doc, storage), true);
    const loaded = loadV2(storage);
    assert.equal(loaded.walls.length, 1);
    assert.equal(loaded.openings.length, 1);
    assert.equal(loaded.openings[0]?.kind, "puerta");
    assert.equal(loaded.openings[0]?.wallId, "M-001");
    assert.equal(loaded.openings[0]?.ancho, 0.9);

    const legacy = hydrateV2({
      product: "obra.v2",
      version: 1,
      walls: [{ id: "M-001", a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, espesor: 0.2 }],
      nextSeq: 2,
    });
    assert.ok(legacy);
    assert.equal(legacy.openings.length, 0);
    assert.equal(legacy.nextHuecoSeq, 1);

    const orphan = hydrateV2({
      product: "obra.v2",
      version: 1,
      walls: [{ id: "M-001", a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, espesor: 0.2 }],
      openings: [{ id: "P-009", kind: "puerta", wallId: "M-999", alongM: 1, ancho: 0.9 }],
      nextSeq: 2,
    });
    assert.ok(orphan);
    assert.equal(orphan.openings.length, 0);
  });
});
