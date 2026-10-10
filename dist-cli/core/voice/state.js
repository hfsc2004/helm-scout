"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readVoiceState = readVoiceState;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const limits_js_1 = require("../storage/limits.js");
const paths_js_1 = require("./paths.js");
/**
 * Read the current voice install state from disk.
 *
 * "Not installed" returns a well-formed state object with installed=false.
 * Never throws on missing files — absence is a valid state.
 */
function readVoiceState() {
    const root = paths_js_1.voicePaths.root();
    const stateFile = paths_js_1.voicePaths.stateFile();
    if (!(0, node_fs_1.existsSync)(stateFile)) {
        return {
            installed: false,
            declined: false,
            root,
            bytesUsed: 0,
            bytesCap: limits_js_1.STORAGE_LIMITS.voiceAssetsBytes,
            assets: [],
        };
    }
    let parsed = {};
    try {
        parsed = JSON.parse((0, node_fs_1.readFileSync)(stateFile, "utf8"));
    }
    catch {
        // Treat corrupt state as "not installed" — safer than crashing.
        return {
            installed: false,
            declined: false,
            root,
            bytesUsed: 0,
            bytesCap: limits_js_1.STORAGE_LIMITS.voiceAssetsBytes,
            assets: [],
        };
    }
    const assets = Array.isArray(parsed.assets) ? parsed.assets : [];
    const installed = (0, node_fs_1.existsSync)(paths_js_1.voicePaths.binaries()) && assets.length > 0;
    return {
        installed,
        declined: parsed.declined === true,
        root,
        bytesUsed: measureDir(root),
        bytesCap: limits_js_1.STORAGE_LIMITS.voiceAssetsBytes,
        assets,
    };
}
function measureDir(dir) {
    if (!(0, node_fs_1.existsSync)(dir))
        return 0;
    let total = 0;
    for (const entry of (0, node_fs_1.readdirSync)(dir, { withFileTypes: true })) {
        const full = (0, node_path_1.join)(dir, entry.name);
        if (entry.isDirectory()) {
            total += measureDir(full);
        }
        else if (entry.isFile()) {
            total += (0, node_fs_1.statSync)(full).size;
        }
    }
    return total;
}
