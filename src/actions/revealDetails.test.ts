// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { revealScrollTop } from "./revealDetails.js";
test("expanding near the lower edge reveals the section with the smallest scroll", () => {
  assert.equal(revealScrollTop(480, 780, 100, 600, 200, 1000), 380);
});
test("sections that already fit never move the user's scroll", () => {
  assert.equal(revealScrollTop(150, 550, 100, 600, 200, 1000), null);
});
test("a tall expanded panel aligns its heading rather than hiding it above the viewport", () => {
  assert.equal(revealScrollTop(480, 1500, 100, 600, 200, 1400), 580);
});
test("collapse correction reveals a heading above the viewport and clamps scroll bounds", () => {
  assert.equal(revealScrollTop(50, 90, 100, 600, 200, 1000), 150);
  assert.equal(revealScrollTop(480, 780, 100, 600, 200, 250), 250);
  assert.equal(revealScrollTop(0, 40, 100, 600, 20, 1000), 0);
});
