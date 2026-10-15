// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Vehicle } from "../../shared/vehicle-contract.js";
import { benchRequest } from "./bench.js";
import { isS3ApplicationImage } from "./board-image.js";
const vehicle = { sensorBoardRevision: "1.3", camera: { baseUrl: "http://board.local:81/stream" } } as Vehicle;
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
test("GET health is read-only and routes through the registered diagnostics host", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "http://board.local:82/system"); assert.equal(options?.method, "GET");
    return Response.json({ ok: true, firmware: "bench-12" });
  };
  assert.equal((await benchRequest(vehicle, { action: "system" })).ok, true);
});
test("writes target the requested board setting with validated parameters", async () => {
  const requests = [
    ["camera-set", { control: "brightness", value: -1 }, "/camera/controls?control=brightness&value=-1"],
    ["resolution-set", { size: "HD" }, "/camera/resolution?size=HD"],
    ["recover", { sensor: "rear" }, "/sensors/recover?sensor=rear"],
    ["calibration-set", { accelBiasX: 0.125, axisX: 2, axisY: -1, axisZ: 3 }, "/imu/calibration?accelBiasX=0.125&axisX=2&axisY=-1&axisZ=3"],
    ["events-set", { proximityMm: 250 }, "/events?proximityMm=250"],
    ["save", {}, "/settings?action=save"], ["defaults", {}, "/settings?action=defaults"],
    ["narrow-mode-set", { sensor: "front", mode: "auto" }, "/tof-mode?sensor=front&mode=auto"],
  ] as const;
  for (const [action, params, path] of requests) {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "http://board.local:82"+path); assert.equal(options?.method, "POST");
      return Response.json({ ok: true });
    };
    assert.equal((await benchRequest(vehicle, { action, params })).ok, true);
  }
});
test("invalid and arbitrary endpoint requests never reach hardware", async () => {
  globalThis.fetch = async () => { throw new Error("must not contact board"); };
  for (const req of [
    { action: "camera-set", params: { control: "brightness", value: 3 } },
    { action: "camera-set", params: { control: "gain", value: 0.5 } },
    { action: "events-set", params: { impactG: NaN } },
    { action: "events-set", params: { proximityMm: 100.5 } },
    { action: "recover", params: { sensor: "both" } },
    { action: "save", params: { action: "defaults" } },
    { action: "calibration-set", params: { axisX: 0 } },
    { action: "/reboot", params: {} }, { action: "__proto__", params: {} },
  ]) assert.equal((await benchRequest(vehicle, req as Parameters<typeof benchRequest>[1])).ok, false);
});
test("old firmware and transport failures are not treated as successful actions", async () => {
  globalThis.fetch = async () => new Response("not found", { status: 404 });
  assert.match((await benchRequest(vehicle, { action: "system" })).error!, /firmware/);
  globalThis.fetch = async () => Response.json({ ok: false, error: "sensor unavailable" }, { status: 503 });
  assert.match((await benchRequest(vehicle, { action: "recover", params: { sensor: "imu" } })).error!, /unavailable/);
  globalThis.fetch = async () => { throw new Error("connection lost"); };
  await assert.rejects(benchRequest(vehicle, { action: "save" }), /connection lost/);
});
test("firmware picker distinguishes an S3 app from other flash binaries", () => {
  const bytes = new Uint8Array(512), view = new DataView(bytes.buffer);
  bytes[0] = 0xe9; view.setUint16(12, 9, true); view.setUint32(32, 0xabcd5432, true);
  assert.equal(isS3ApplicationImage(bytes), true);
  view.setUint16(12, 0, true); assert.equal(isS3ApplicationImage(bytes), false);
  view.setUint16(12, 9, true); view.setUint32(32, 0, true); assert.equal(isS3ApplicationImage(bytes), false);
  assert.equal(isS3ApplicationImage(bytes.subarray(0, 32)), false);
});
