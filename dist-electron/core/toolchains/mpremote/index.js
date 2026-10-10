"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMpremote = resolveMpremote;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const process_js_1 = require("../process.js");
async function probe(bin, args) {
    const res = await (0, process_js_1.runCommandAsync)(bin, [...args, "version"], {
        timeoutMs: 5000,
    });
    if (res.error || res.status !== 0)
        return null;
    // mpremote outputs e.g. "mpremote 1.24.1"
    const match = res.stdout.match(/mpremote\s+(\S+)/i);
    return match ? match[1] : "unknown";
}
async function resolveMpremote() {
    // Try system `mpremote` first — most common case.
    const sys = await probe("mpremote", []);
    if (sys) {
        return { bin: "mpremote", baseArgs: [], source: "system", version: sys };
    }
    // Fall back to `python3 -m mpremote` — works if pip-installed but not on PATH.
    for (const py of ["python3", "python"]) {
        const v = await probe(py, ["-m", "mpremote"]);
        if (v) {
            return {
                bin: py,
                baseArgs: ["-m", "mpremote"],
                source: "python-module",
                version: v,
            };
        }
    }
    return null;
}
