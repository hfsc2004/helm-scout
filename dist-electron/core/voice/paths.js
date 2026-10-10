"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voicePaths = void 0;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_path_1 = require("node:path");
const paths_js_1 = require("../paths.js");
/**
 * Every voice-related file in Helm Scout lives under one directory.
 *
 * Uninstall is therefore "stop processes + delete this directory." Nothing
 * voice-related leaks elsewhere. This is the architectural rule that makes
 * voice removal clean and reversible.
 */
exports.voicePaths = {
    root: () => (0, node_path_1.join)(paths_js_1.paths.data, "voice"),
    binaries: () => (0, node_path_1.join)(paths_js_1.paths.data, "voice", "bin"),
    models: () => (0, node_path_1.join)(paths_js_1.paths.data, "voice", "models"),
    stateFile: () => (0, node_path_1.join)(paths_js_1.paths.data, "voice", "state.json"),
};
