// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Vehicle } from "../../shared/vehicle-contract.js";
import { sensorControls, SENSOR_NAMES } from "./sensor-controls.js";
const vehicle = { sensorBoardRevision: "1.3", camera: { baseUrl: "http://sensor.local:81/stream" } } as Vehicle;
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
const states = () => Object.fromEntries(SENSOR_NAMES.map(name => [name, { enabled: true, ready: true }]));
test("status does not change any sensor", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "http://sensor.local:82/sensors"); assert.equal(options?.method, "GET");
    return Response.json({ ok: true, sensors: states() });
  };
  assert.equal((await sensorControls(vehicle)).ok, true);
});
test("each toggle targets exactly one sensor and requires matching confirmation", async () => {
  for (const name of SENSOR_NAMES) for (const enabled of [false, true]) {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), `http://sensor.local:82/sensors?sensor=${name}&enabled=${enabled ? 1 : 0}`);
      assert.equal(options?.method, "POST");
      return Response.json({ ok: true, sensors: { ...states(), [name]: { enabled, ready: enabled } } });
    };
    assert.equal((await sensorControls(vehicle, name, enabled)).ok, true);
  }
  globalThis.fetch = async () => Response.json({ ok: true, sensors: states() });
  assert.equal((await sensorControls(vehicle, "front", false)).ok, false);
});
test("invalid requests and wrong boards never contact hardware", async () => {
  globalThis.fetch = async () => { throw new Error("must not fetch"); };
  assert.equal((await sensorControls(vehicle, "front")).ok, false);
  assert.equal((await sensorControls(vehicle, undefined, true)).ok, false);
  assert.equal((await sensorControls({ ...vehicle, sensorBoardRevision: "1.1" })).ok, false);
});
test("unsupported firmware and malformed responses are errors", async () => {
  globalThis.fetch = async () => new Response("not found", { status: 404 });
  assert.match((await sensorControls(vehicle)).error!, /firmware/);
  globalThis.fetch = async () => Response.json({ ok: true });
  assert.equal((await sensorControls(vehicle)).ok, false);
  globalThis.fetch = async () => Response.json({ ok: false, error: "I2C failure" }, { status: 503 });
  assert.match((await sensorControls(vehicle)).error!, /I2C/);
});
