// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadTemplate } from "./templates.js";
import { renderSketch } from "./render.js";

test("bench firmware renders with OTA disabled and ships all support headers", () => {
  const template = loadTemplate("sensor-board-v1-3-esp32s3")!;
  const rendered = renderSketch(template, { "wifi.ssid": "test", "wifi.password": "test" });
  assert.equal(rendered.ok, true);
  if (!rendered.ok) return;
  assert.match(rendered.sketch, /OTA_PASSWORD = "";/);
  assert.doesNotMatch(rendered.sketch, /\{\{/);
  for (const header of ["bench_api.h", "bench_config.h", "wide_tof_control.h"]) {
    assert.ok(template.manifest.sketchFiles?.includes(header));
    assert.ok(existsSync(join(template.dir, header)));
  }
  assert.match(template.manifest.fqbn, /PartitionScheme=min_spiffs/);
});

test("OTA build secret uses explicit C++ string escaping", () => {
  const template = loadTemplate("sensor-board-v1-3-esp32s3")!;
  const rendered = renderSketch(template, {
    "wifi.ssid": "test", "wifi.password": "test", "ota.password": 'test-password-"quoted"',
  });
  assert.equal(rendered.ok, true);
  if (!rendered.ok) return;
  assert.ok(rendered.sketch.includes('OTA_PASSWORD = "test-password-\\"quoted\\"";'));
});

test("OTA C++ string variant escapes backslashes and control characters", () => {
  const template = loadTemplate("sensor-board-v1-3-esp32s3")!;
  const rendered = renderSketch(template, {
    "wifi.ssid": "test", "wifi.password": "test", "ota.password": "test\\password\nend",
  });
  assert.equal(rendered.ok, true);
  if (!rendered.ok) return;
  assert.ok(rendered.sketch.includes('OTA_PASSWORD = "test\\\\password\\012end";'));
});

test("all ESP32 templates render optional secondary credentials and ship matching failover headers", async () => {
  const { readFileSync } = await import("node:fs");
  let header: string | undefined;
  for (const name of ["sensor-board-v1-3-esp32s3", "video-esp32-s3", "ground-skidsteer-esp32"]) {
    const template = loadTemplate(name)!;
    assert.ok(template.manifest.sketchFiles?.includes("wifi_failover.h"));
    const contents = readFileSync(join(template.dir, "wifi_failover.h"), "utf8");
    if (header) assert.equal(contents, header); else header = contents;
    for (const extra of [{}, { "wifi.secondarySsid": 'backup"network', "wifi.secondaryPassword": 'password\\with"quotes' }]) {
      const result = renderSketch(template, { "wifi.ssid": "primary", "wifi.password": "secret", ...extra });
      assert.equal(result.ok, true);
      if (!result.ok) continue;
      assert.doesNotMatch(result.sketch, /\{\{/);
      assert.ok(result.sketch.includes(extra["wifi.secondarySsid"] ? 'WIFI_SECONDARY_SSID = "backup\\"network";' : 'WIFI_SECONDARY_SSID = "";'));
      assert.ok(result.sketch.includes("wifiFailover.poll();"));
    }
  }
});
