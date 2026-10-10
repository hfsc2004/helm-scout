"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uninstallVoice = uninstallVoice;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const limits_js_1 = require("../storage/limits.js");
const paths_js_1 = require("./paths.js");
const state_js_1 = require("./state.js");
/**
 * Remove voice entirely.
 *
 * Stops nothing for v0.1 (no engines spawn yet); the real implementation will
 * terminate child processes first. For now this is a clean directory delete.
 */
async function uninstallVoice() {
    const before = (0, state_js_1.readVoiceState)();
    const root = paths_js_1.voicePaths.root();
    if ((0, node_fs_1.existsSync)(root)) {
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
    }
    const state = {
        installed: false,
        declined: before.declined,
        root,
        bytesUsed: 0,
        bytesCap: limits_js_1.STORAGE_LIMITS.voiceAssetsBytes,
        assets: [],
    };
    return {
        removed: before.installed,
        freedBytes: before.bytesUsed,
        state,
    };
}
