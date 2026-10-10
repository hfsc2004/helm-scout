"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paths = void 0;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_process_1 = require("node:process");
const APP_NAME = "psf-helm";
function dataDir() {
    switch ((0, node_os_1.platform)()) {
        case "darwin":
            return (0, node_path_1.join)((0, node_os_1.homedir)(), "Library", "Application Support", APP_NAME);
        case "win32":
            return (0, node_path_1.join)(node_process_1.env.APPDATA ?? (0, node_path_1.join)((0, node_os_1.homedir)(), "AppData", "Roaming"), APP_NAME);
        default:
            return (0, node_path_1.join)(node_process_1.env.XDG_DATA_HOME ?? (0, node_path_1.join)((0, node_os_1.homedir)(), ".local", "share"), APP_NAME);
    }
}
function configDir() {
    switch ((0, node_os_1.platform)()) {
        case "darwin":
            return (0, node_path_1.join)((0, node_os_1.homedir)(), "Library", "Preferences", APP_NAME);
        case "win32":
            return (0, node_path_1.join)(node_process_1.env.APPDATA ?? (0, node_path_1.join)((0, node_os_1.homedir)(), "AppData", "Roaming"), APP_NAME, "config");
        default:
            return (0, node_path_1.join)(node_process_1.env.XDG_CONFIG_HOME ?? (0, node_path_1.join)((0, node_os_1.homedir)(), ".config"), APP_NAME);
    }
}
exports.paths = {
    data: dataDir(),
    config: configDir(),
    registry: () => (0, node_path_1.join)(dataDir(), "registry.json"),
    state: (vehicleId) => (0, node_path_1.join)(dataDir(), "state", `${vehicleId}.ndjson`),
    commandHistory: (vehicleId) => (0, node_path_1.join)(dataDir(), "history", `${vehicleId}.ndjson`),
    trace: (traceId) => (0, node_path_1.join)(dataDir(), "traces", `${traceId}.ndjson`),
    errors: () => (0, node_path_1.join)(dataDir(), "errors.ndjson"),
    ollamaRoot: () => (0, node_path_1.join)(dataDir(), "ollama"),
    ollamaBin: () => (0, node_path_1.join)(dataDir(), "ollama", "bin", "ollama"),
    ollamaModels: () => (0, node_path_1.join)(dataDir(), "ollama", "models"),
    modelStaging: () => (0, node_path_1.join)(dataDir(), "model-staging"),
    toolchainsRoot: () => (0, node_path_1.join)(dataDir(), "toolchains"),
    arduinoCliRoot: () => (0, node_path_1.join)(dataDir(), "toolchains", "arduino-cli"),
    arduinoCliBin: () => (0, node_path_1.join)(dataDir(), "toolchains", "arduino-cli", "arduino-cli"),
    controlPlane: () => (0, node_path_1.join)(dataDir(), "control-plane.json"),
};
