// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Vehicle } from "../../shared/vehicle-contract.js";
import { rebootBoard } from "./reboot.js";
const vehicle = {
  transport: { host: "drive.local", port: 8080 }, capabilities: ["drive.skidsteer"],
  camera: { baseUrl: "http://sensor.local:81/stream" },
} as Vehicle;
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
test("reboot targets exactly the selected board with POST", async () => {
  for (const board of ["drive", "video"] as const) {
    let count = 0;
    globalThis.fetch = async (url, options) => {
      count++;
      assert.equal(String(url), board === "drive" ? "http://drive.local:8080/reboot" : "http://sensor.local:82/reboot");
      assert.equal(options?.method, "POST");
      return Response.json({ ok: true, rebooting: true });
    };
    assert.equal((await rebootBoard(vehicle, board)).ok, true);
    assert.equal(count, 1);
  }
});
test("standalone sensor board refuses a drive reboot without contacting hardware", async () => {
  globalThis.fetch = async () => { throw new Error("must not contact board"); };
  assert.equal((await rebootBoard({ ...vehicle, sensorBoardRevision: "1.3" }, "drive")).ok, false);
});
test("unsupported firmware, rejections and missing acknowledgement are failures", async () => {
  globalThis.fetch = async () => new Response("not found", { status: 404 });
  assert.match((await rebootBoard(vehicle, "video")).error!, /firmware/);
  globalThis.fetch = async () => new Response("busy", { status: 503 });
  assert.equal((await rebootBoard(vehicle, "video")).ok, false);
  globalThis.fetch = async () => Response.json({ ok: true });
  assert.equal((await rebootBoard(vehicle, "video")).ok, false);
});
test("a disconnected board is not treated as reboot success or retried", async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; throw new Error("connection lost"); };
  await assert.rejects(rebootBoard(vehicle, "video"), /connection lost/);
  assert.equal(count, 1);
});
