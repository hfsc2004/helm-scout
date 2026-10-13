// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { buildUploadArgs } from "./upload-args.js";
const fqbn = "esp32:esp32:esp32s3:PSRAM=opi,PartitionScheme=no_ota,LoopCore=1,EventsCore=0";
test("erase uses the ESP32 upload recipe property and preserves the board options", () => {
  const base = ["--config-file", "/tmp/arduino.yaml"];
  assert.deepEqual(buildUploadArgs(base, fqbn, "/dev/ttyUSB0", "/tmp/sketch", true),
    [...base, "upload", "--fqbn", fqbn, "--port", "/dev/ttyUSB0", "--upload-property", "upload.erase_cmd=-e", "/tmp/sketch"]);
  assert.deepEqual(base, ["--config-file", "/tmp/arduino.yaml"]);
});
test("normal uploads do not request erasure", () => {
  assert.deepEqual(buildUploadArgs([], fqbn, "COM3", "/tmp/sketch"),
    ["upload", "--fqbn", fqbn, "--port", "COM3", "/tmp/sketch"]);
});
test("reject erase for platforms without the ESP32 erase recipe", () => {
  assert.throws(() => buildUploadArgs([], "arduino:avr:uno", "COM3", "/tmp/sketch", true), /only for Espressif/);
});
