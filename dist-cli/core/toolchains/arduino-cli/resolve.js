"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveArduinoCli = resolveArduinoCli;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const process_js_1 = require("../process.js");
const env_js_1 = require("./env.js");
async function probeVersion(bin, env) {
    const res = await (0, process_js_1.runCommandAsync)(bin, ["version"], { env, timeoutMs: 5000 });
    if (res.error || res.status !== 0)
        return null;
    // arduino-cli prints e.g. "arduino-cli  Version: 1.0.4 Commit: ..."
    const match = res.stdout.match(/Version:\s*(\S+)/i);
    return match ? match[1] : "unknown";
}
async function resolveArduinoCli() {
    const env = (0, env_js_1.buildArduinoCliEnv)();
    // Managed binary first.
    const managed = env_js_1.arduinoCliPaths.bin();
    if ((0, node_fs_1.existsSync)(managed)) {
        const v = await probeVersion(managed, env);
        if (v) {
            return { bin: managed, baseArgs: [], env, source: "managed", version: v };
        }
    }
    // System fallback.
    const v = await probeVersion("arduino-cli", env);
    if (v) {
        return { bin: "arduino-cli", baseArgs: [], env, source: "system", version: v };
    }
    return null;
}
