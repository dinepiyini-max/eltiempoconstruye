import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createColumna, createHueco, createLosa, createMuro, createViga, createZapata } from "./geometry.ts";
import { idleClock } from "./clock.ts";
import {
  V2_BAK_KEY,
  V2_FORBIDDEN_KEYS,
  V2_LIVE_KEY,
  emptyV2,
  hydrateV2,
  loadV2,
  placaFromScene,
  placaId,
  resetDrawing,
  saveV2,
  sealArchive,
  snapshotV2,
  V2_ARCHIVE_CAP,
  dibujoFromPlaca,
  actualizarPlaca,
  displayLaminaNombre,
  sanitizeNombre,
} from "./persist-v2.ts";
import { V2_NOMBRE_VACIO } from "./tables.ts";

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

  it("F5 conserva columna zapata viga losa; save viejo sin ellas sigue", () => {
    const storage = new Mem();
    const wall = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const col = createColumna({ x: 2, y: 2 }, "C-001");
    const zap = createZapata({ x: 2, y: 2 }, "Z-001", 0.8, "C-001");
    const viga = createViga({ x: 0, y: 1 }, { x: 4, y: 1 }, "VG-001");
    const losa = createLosa(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
        { x: 0, y: 2 },
      ],
      "L-001",
    );
    const doc = {
      ...emptyV2(),
      walls: [wall],
      columns: [col],
      footings: [zap],
      beams: [viga],
      slabs: [losa],
      nextSeq: 2,
      nextColSeq: 2,
      nextZapSeq: 2,
      nextVigaSeq: 2,
      nextLosaSeq: 2,
    };
    assert.equal(saveV2(doc, storage), true);
    const loaded = loadV2(storage);
    assert.equal(loaded.columns[0]?.id, "C-001");
    assert.equal(loaded.footings[0]?.columnId, "C-001");
    assert.equal(loaded.beams[0]?.id, "VG-001");
    assert.equal(loaded.slabs[0]?.poly.length, 4);
    assert.equal(storage.getItem("obra.jefe"), null);

    const legacy = hydrateV2({
      product: "obra.v2",
      version: 1,
      walls: [{ id: "M-001", a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, espesor: 0.2 }],
      nextSeq: 2,
    });
    assert.ok(legacy);
    assert.equal(legacy.columns.length, 0);
    assert.equal(legacy.footings.length, 0);
    assert.equal(legacy.beams.length, 0);
    assert.equal(legacy.slabs.length, 0);
  });

  it("reset V2 no toca obra.jefe y conserva placas", () => {
    const storage = new Mem();
    const yuna = JSON.stringify({ version: 1, siteMinutes: 44, page: "plano" });
    storage.setItem("obra.jefe", yuna);
    storage.setItem("obra.visita", yuna);
    const placa = {
      id: "A-001",
      nombre: "Lámina 01",
      closedAt: "2026-09-12T14:00:00.000Z",
      largoMuroM: 8,
      losaM2: 12,
      estimado: 9000,
      estado: "cerrada" as const,
      recuento: { muros: 1, vanos: 0, columnas: 0, zapatas: 0, vigas: 0, losas: 1 },
      dibujo: null,
    };
    const doc = {
      ...emptyV2(),
      walls: [createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001")],
      archive: [placa],
      nextArchiveSeq: 2,
      nextSeq: 2,
    };
    assert.equal(saveV2(doc, storage), true);
    const cleared = resetDrawing(loadV2(storage));
    assert.equal(cleared.walls.length, 0);
    assert.equal(cleared.columns.length, 0);
    assert.equal(cleared.slabs.length, 0);
    assert.equal(cleared.archive.length, 1);
    assert.equal(cleared.archive[0]?.id, "A-001");
    assert.equal(cleared.clock.running, false);
    assert.equal(cleared.clock.pace, "pausa");
    assert.equal(saveV2(cleared, storage), true);
    assert.equal(storage.getItem("obra.jefe"), yuna);
    assert.equal(storage.getItem("obra.visita"), yuna);
    const loaded = loadV2(storage);
    assert.equal(loaded.walls.length, 0);
    assert.equal(loaded.archive.length, 1);
  });

  it("clock V2 hidrata sin tocar jefe; placa vieja es CERRADA", () => {
    const storage = new Mem();
    const yuna = JSON.stringify({ version: 1, siteMinutes: 99 });
    storage.setItem("obra.jefe", yuna);
    const legacy = hydrateV2({
      product: "obra.v2",
      version: 1,
      walls: [{ id: "M-001", a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, espesor: 0.2 }],
      archive: [{ id: "A-001", closedAt: "2026-09-12", largoMuroM: 4, losaM2: 9, estimado: 1, recuento: { muros: 1, vanos: 0, columnas: 0, zapatas: 0, vigas: 0, losas: 1 } }],
    });
    assert.ok(legacy);
    assert.equal(legacy.clock.running, false);
    assert.equal(legacy.clock.pace, "pausa");
    assert.equal(legacy.archive[0]?.estado, "cerrada");
    assert.equal(legacy.archive[0]?.losaM2, 9);
    saveV2(legacy, storage);
    assert.equal(storage.getItem("obra.jefe"), yuna);
  });

  it("un cierre = una placa; el segundo es no-op", () => {
    const wall = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const losa = createLosa(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
      "L-001",
    );
    const scene = {
      walls: [wall],
      openings: [],
      columns: [],
      footings: [],
      beams: [],
      slabs: [losa],
    };
    const draft = placaFromScene(scene, { id: placaId(1), estado: "cerrada", rework: false });
    assert.ok(draft.largoMuroM > 0);
    assert.ok(draft.losaM2 > 0);
    assert.equal(draft.losaM2, 12);
    const first = sealArchive([], 1, idleClock(), draft);
    assert.equal(first.archive.length, 1);
    assert.equal(first.clock.sealed, true);
    const again = sealArchive(first.archive, first.nextArchiveSeq, first.clock, {
      ...placaFromScene(scene, { id: placaId(2), estado: "ejecutada", rework: true }),
    });
    assert.equal(again.archive.length, 1);
    assert.equal(again.archive[0]?.id, "A-001");
    assert.equal(again.archive[0]?.estado, "cerrada");
    assert.equal(again.nextArchiveSeq, first.nextArchiveSeq);
    const reset = resetDrawing({ ...emptyV2(), archive: again.archive, nextArchiveSeq: again.nextArchiveSeq });
    assert.equal(reset.archive.length, 1);
    assert.equal(reset.clock.sealed, false);
    assert.equal(reset.clock.placaId, null);
  });

  it("hidrata clones consecutivos EJECUTADA como una sola placa", () => {
    const rec = { muros: 1, vanos: 0, columnas: 1, zapatas: 0, vigas: 0, losas: 1 };
    const parsed = hydrateV2({
      product: "obra.v2",
      version: 1,
      walls: [{ id: "M-001", a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, espesor: 0.2 }],
      columns: [{ id: "C-001", c: { x: 1, y: 1 }, lado: 0.3 }],
      slabs: [{ id: "L-001", poly: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] }],
      archive: [
        { id: "A-002", closedAt: "2026-09-12", largoMuroM: 8, losaM2: 12, estimado: 10, estado: "ejecutada", recuento: rec },
        { id: "A-003", closedAt: "2026-09-12", largoMuroM: 8, losaM2: 12, estimado: 10, estado: "ejecutada", recuento: rec },
      ],
    });
    assert.ok(parsed);
    assert.equal(parsed.archive.length, 1);
    assert.equal(parsed.archive[0]?.id, "A-002");
    assert.equal(parsed.archive[0]?.losaM2, 12);
    assert.equal(parsed.clock.sealed, true);
    assert.equal(parsed.clock.placaId, "A-002");
  });

  it("placa guarda dibujo; reabrir recupera el muro", () => {
    const wall = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const scene = {
      walls: [wall],
      openings: [],
      columns: [],
      footings: [],
      beams: [],
      slabs: [],
    };
    const draft = placaFromScene(scene, { id: placaId(1), estado: "cerrada", rework: false });
    assert.equal(draft.dibujo?.walls[0]?.id, "M-001");
    assert.equal(draft.dibujo?.walls[0]?.b.x, 8);
    const loaded = dibujoFromPlaca(draft);
    assert.equal(loaded?.walls.length, 1);
    assert.equal(loaded?.walls[0]?.id, "M-001");
    const sealed = sealArchive([], 1, idleClock(), draft);
    assert.equal(sealed.archive[0]?.dibujo?.walls[0]?.id, "M-001");
  });

  it("tope 10 placas; la 11ª desplaza la más vieja", () => {
    const wall = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const scene = {
      walls: [wall],
      openings: [],
      columns: [],
      footings: [],
      beams: [],
      slabs: [],
    };
    let archive: ReturnType<typeof placaFromScene>[] = [];
    let seq = 1;
    for (let i = 0; i < 11; i++) {
      const draft = placaFromScene(scene, { id: placaId(seq), estado: "cerrada", rework: false });
      const r = sealArchive(archive, seq, idleClock(), draft);
      archive = r.archive;
      seq = r.nextArchiveSeq;
    }
    assert.equal(V2_ARCHIVE_CAP, 10);
    assert.equal(archive.length, 10);
    assert.equal(archive[0]?.id, "A-002");
    assert.equal(archive[9]?.id, "A-011");
  });

  it("actualizar placa reescribe la misma A-00N; no clona", () => {
    const wall = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const extra = createMuro({ x: 0, y: 2 }, { x: 6, y: 2 }, "M-002");
    const scene1 = {
      walls: [wall],
      openings: [],
      columns: [],
      footings: [],
      beams: [],
      slabs: [],
    };
    const draft = placaFromScene(scene1, { id: placaId(1), estado: "cerrada", rework: false });
    const sealed = sealArchive([], 1, idleClock(), draft);
    assert.equal(sealed.archive.length, 1);
    const scene2 = { ...scene1, walls: [wall, extra] };
    const upd = actualizarPlaca(sealed.archive, sealed.clock, scene2, { rework: false });
    assert.ok(upd);
    assert.equal(upd!.id, "A-001");
    assert.equal(upd!.archive.length, 1);
    assert.equal(upd!.archive[0]?.id, "A-001");
    assert.equal(upd!.archive[0]?.recuento.muros, 2);
    assert.equal(upd!.archive[0]?.dibujo?.walls.length, 2);
    assert.equal(upd!.clock.placaId, "A-001");
    assert.equal(upd!.clock.sealed, true);
    assert.equal(upd!.archive[0]?.estado, "cerrada");
    const again = sealArchive(upd!.archive, sealed.nextArchiveSeq, upd!.clock, {
      ...placaFromScene(scene2, { id: placaId(2), estado: "cerrada", rework: false }),
    });
    assert.equal(again.archive.length, 1);
    assert.equal(again.archive[0]?.id, "A-001");
    const empty = actualizarPlaca(upd!.archive, upd!.clock, { ...scene1, walls: [] }, { rework: false });
    assert.equal(empty, null);
  });

  it("vacío = Lámina 01; nombre viaja en save y en la placa", () => {
    assert.equal(displayLaminaNombre(""), V2_NOMBRE_VACIO);
    assert.equal(displayLaminaNombre("   "), V2_NOMBRE_VACIO);
    assert.equal(displayLaminaNombre(null), V2_NOMBRE_VACIO);
    assert.equal(displayLaminaNombre("Casa norte"), "Casa norte");
    assert.equal(sanitizeNombre("  Casa   norte  "), "Casa norte");
    const wall = createMuro({ x: 0, y: 0 }, { x: 8, y: 0 }, "M-001");
    const scene = {
      walls: [wall],
      openings: [],
      columns: [],
      footings: [],
      beams: [],
      slabs: [],
    };
    const unnamed = placaFromScene(scene, { id: placaId(1), estado: "cerrada", rework: false });
    assert.equal(unnamed.nombre, V2_NOMBRE_VACIO);
    const named = placaFromScene(scene, {
      id: placaId(1),
      estado: "cerrada",
      rework: false,
      nombre: "Casa norte",
    });
    assert.equal(named.nombre, "Casa norte");
    const storage = new Mem();
    const doc = { ...emptyV2(), walls: [wall], nombre: "Casa norte", nextSeq: 2 };
    assert.equal(saveV2(doc, storage), true);
    const loaded = loadV2(storage);
    assert.equal(loaded.nombre, "Casa norte");
    const legacy = hydrateV2({
      product: "obra.v2",
      version: 1,
      walls: [{ id: "M-001", a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, espesor: 0.2 }],
      archive: [
        {
          id: "A-001",
          closedAt: "2026-09-12",
          largoMuroM: 8,
          losaM2: 0,
          estimado: 1,
          estado: "cerrada",
          recuento: { muros: 1, vanos: 0, columnas: 0, zapatas: 0, vigas: 0, losas: 0 },
        },
      ],
    });
    assert.ok(legacy);
    assert.equal(legacy.nombre, "");
    assert.equal(legacy.archive[0]?.nombre, V2_NOMBRE_VACIO);
    assert.equal(displayLaminaNombre(legacy.archive[0]?.nombre), "Lámina 01");
  });
});
