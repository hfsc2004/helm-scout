"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Hardware detection — verbatim import from PSF Core.
 *
 * The underlying .js files are kept exactly as written and proven there.
 * This file is the thin TypeScript surface the rest of Helm Scout uses.
 *
 * If you find a bug in the detector, fix it in the .js file directly. Do not
 * "modernize" the implementation; it works.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectHardware = detectHardware;
exports.classifyForInference = classifyForInference;
exports.selectNvidiaGpu = selectNvidiaGpu;
exports.selectNvidiaGpuAsync = selectNvidiaGpuAsync;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
// Verbatim CommonJS modules from PSF Core.
const detector = require("./gpu-detector.js");
const createStartupGpuTools = require("./gpu-select.js");
/**
 * The verbatim .js modules emit `[GPU Detector]` and `[GPU Classifier]` lines
 * via `console.log`. Those land on stdout, which would corrupt the agent-facing
 * NDJSON stream from the CLI. Redirect them to stderr for the duration of the
 * call. Nothing is silenced — the diagnostic logs are still available for the
 * user / agent reading stderr.
 */
async function withStdoutToStderr(fn) {
    const originalLog = console.log;
    console.log = (...args) => {
        process.stderr.write(args.map((a) => String(a)).join(" ") + "\n");
    };
    try {
        return await fn();
    }
    finally {
        console.log = originalLog;
    }
}
async function detectHardware(appDir) {
    return withStdoutToStderr(() => detector.detectAll(appDir));
}
function classifyForInference(hardware) {
    // Synchronous; redirect by direct swap.
    const originalLog = console.log;
    console.log = (...args) => {
        process.stderr.write(args.map((a) => String(a)).join(" ") + "\n");
    };
    try {
        return detector.classifyForInference(hardware);
    }
    finally {
        console.log = originalLog;
    }
}
/**
 * Pick the right NVIDIA GPU when multiple are present.
 * Headless beats display-active; more VRAM wins ties.
 */
function selectNvidiaGpu(classification, override) {
    const { execFileSync } = require("node:child_process");
    const tools = createStartupGpuTools({ execFileSync });
    return {
        index: tools.resolvePreferredNvidiaGpuIndex(classification, override?.index),
        uuid: tools.resolvePreferredNvidiaGpuUuid(classification, override?.uuid),
    };
}
/** Keep GPU selection from blocking Electron's main event loop while forms are open. */
async function selectNvidiaGpuAsync(classification, override) {
    let output = "";
    let failed = false;
    try {
        const result = await (0, node_util_1.promisify)(node_child_process_1.execFile)("nvidia-smi", ["--query-gpu=index,memory.total,display_active", "--format=csv,noheader,nounits"], { timeout: 5000, encoding: "utf8" });
        output = result.stdout;
    }
    catch {
        failed = true;
    }
    // Preserve the existing headless-first ranking and fallback rules. Its
    // injected synchronous reader returns already-collected data immediately.
    const tools = createStartupGpuTools({
        execFileSync: (() => {
            if (failed)
                throw new Error("GPU query unavailable");
            return output;
        }),
    });
    return {
        index: tools.resolvePreferredNvidiaGpuIndex(classification, override?.index),
        uuid: tools.resolvePreferredNvidiaGpuUuid(classification, override?.uuid),
    };
}
