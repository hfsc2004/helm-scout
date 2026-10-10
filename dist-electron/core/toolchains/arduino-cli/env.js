"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arduinoCliPaths = void 0;
exports.ensureArduinoCliDirs = ensureArduinoCliDirs;
exports.buildArduinoCliEnv = buildArduinoCliEnv;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const paths_js_1 = require("../../paths.js");
/**
 * Isolated arduino-cli environment.
 *
 * Same isolation pattern as Helm Scout's private Ollama: never touches the user's
 * ~/.arduino15. Helm Scout's arduino-cli reads/writes config, downloads cores, and
 * stores user libraries entirely under <dataDir>/toolchains/arduino-cli/.
 *
 * If a system arduino-cli is also installed, the user's setup is unaffected.
 */
function arduinoCliConfigDir() {
    return (0, node_path_1.join)(paths_js_1.paths.arduinoCliRoot(), "config");
}
function arduinoCliDataDir() {
    return (0, node_path_1.join)(paths_js_1.paths.arduinoCliRoot(), "data");
}
function arduinoCliDownloadsDir() {
    return (0, node_path_1.join)(paths_js_1.paths.arduinoCliRoot(), "downloads");
}
function arduinoCliUserDir() {
    return (0, node_path_1.join)(paths_js_1.paths.arduinoCliRoot(), "user");
}
function ensureArduinoCliDirs() {
    for (const p of [
        paths_js_1.paths.arduinoCliRoot(),
        arduinoCliConfigDir(),
        arduinoCliDataDir(),
        arduinoCliDownloadsDir(),
        arduinoCliUserDir(),
    ]) {
        if (!(0, node_fs_1.existsSync)(p))
            (0, node_fs_1.mkdirSync)(p, { recursive: true });
    }
}
function buildArduinoCliEnv() {
    ensureArduinoCliDirs();
    return {
        ...process.env,
        ARDUINO_CONFIG_DIR: arduinoCliConfigDir(),
        ARDUINO_DIRECTORIES_DATA: arduinoCliDataDir(),
        ARDUINO_DIRECTORIES_DOWNLOADS: arduinoCliDownloadsDir(),
        ARDUINO_DIRECTORIES_USER: arduinoCliUserDir(),
    };
}
exports.arduinoCliPaths = {
    root: () => paths_js_1.paths.arduinoCliRoot(),
    bin: () => paths_js_1.paths.arduinoCliBin(),
    config: arduinoCliConfigDir,
    data: arduinoCliDataDir,
    downloads: arduinoCliDownloadsDir,
    user: arduinoCliUserDir,
};
