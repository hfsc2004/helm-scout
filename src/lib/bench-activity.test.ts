// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { get } from "svelte/store";
import { boardEpoch, boardOperations, withBoardOperation } from "./bench-activity.js";
test("conflicting board mutations are rejected and operation epochs invalidate old reads", async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const epoch = boardEpoch("test-one");
  const first = withBoardOperation("test-one", "Recovering", () => pending);
  assert.equal(get(boardOperations)["test-one"], "Recovering");
  assert.notEqual(boardEpoch("test-one"), epoch);
  let called = false;
  await assert.rejects(withBoardOperation("test-one", "Saving", async () => { called = true; }), /Wait/);
  assert.equal(called, false);
  await withBoardOperation("test-two", "Independent board", async () => {});
  finish(); await first;
  assert.equal(get(boardOperations)["test-one"], undefined);
  assert.equal(boardEpoch("test-one"), epoch+2);
});
test("failed mutations release the busy state so controls can be used again", async () => {
  await assert.rejects(withBoardOperation("test-fail", "Writing", async () => { throw new Error("offline"); }), /offline/);
  assert.equal(get(boardOperations)["test-fail"], undefined);
  assert.equal(await withBoardOperation("test-fail", "Retry", async () => "ok"), "ok");
});
