"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const upload_args_js_1 = require("./upload-args.js");
const fqbn = "esp32:esp32:esp32s3:PSRAM=opi,PartitionScheme=no_ota,LoopCore=1,EventsCore=0";
(0, node_test_1.default)("erase uses the ESP32 upload recipe property and preserves the board options", () => {
    const base = ["--config-file", "/tmp/arduino.yaml"];
    strict_1.default.deepEqual((0, upload_args_js_1.buildUploadArgs)(base, fqbn, "/dev/ttyUSB0", "/tmp/sketch", true), [...base, "upload", "--fqbn", fqbn, "--port", "/dev/ttyUSB0", "--upload-property", "upload.erase_cmd=-e", "/tmp/sketch"]);
    strict_1.default.deepEqual(base, ["--config-file", "/tmp/arduino.yaml"]);
});
(0, node_test_1.default)("normal uploads do not request erasure", () => {
    strict_1.default.deepEqual((0, upload_args_js_1.buildUploadArgs)([], fqbn, "COM3", "/tmp/sketch"), ["upload", "--fqbn", fqbn, "--port", "COM3", "/tmp/sketch"]);
});
(0, node_test_1.default)("reject erase for platforms without the ESP32 erase recipe", () => {
    strict_1.default.throws(() => (0, upload_args_js_1.buildUploadArgs)([], "arduino:avr:uno", "COM3", "/tmp/sketch", true), /only for Espressif/);
});
