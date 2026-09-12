import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canRedo, canUndo, histInit, histPush, histRedo, histUndo } from "./history.ts";

describe("v2 history", () => {
  it("undo y redo restauran el presente", () => {
    let h = histInit(["a"]);
    h = histPush(h, ["a", "b"]);
    h = histPush(h, ["a", "b", "c"]);
    assert.equal(canUndo(h), true);
    h = histUndo(h);
    assert.deepEqual(h.present, ["a", "b"]);
    h = histUndo(h);
    assert.deepEqual(h.present, ["a"]);
    assert.equal(canUndo(h), false);
    h = histRedo(h);
    assert.deepEqual(h.present, ["a", "b"]);
    assert.equal(canRedo(h), true);
    h = histPush(h, ["a", "b", "d"]);
    assert.equal(canRedo(h), false);
    assert.deepEqual(h.present, ["a", "b", "d"]);
  });
});
