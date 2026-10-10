"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * arduino-cli toolchain — Helm Scout's private installation, isolated from any
 * system Arduino IDE or arduino-cli the user may already have.
 *
 * Architectural rule (mirrors Helm Scout's Ollama isolation):
 *   Helm Scout sets ARDUINO_CONFIG_DIR / ARDUINO_DIRECTORIES_DATA /
 *   ARDUINO_DIRECTORIES_DOWNLOADS / ARDUINO_DIRECTORIES_USER to its private
 *   subdirs under <dataDir>/toolchains/arduino-cli/. Helm Scout's arduino-cli
 *   never touches ~/.arduino15. If the user has a system arduino-cli on
 *   PATH, Helm Scout uses it but still pins these env vars so it operates
 *   against Helm Scout's data, not the user's.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uninstallArduinoCli = exports.installArduinoCli = exports.resolveArduinoCli = exports.arduinoCliPaths = exports.ensureArduinoCliDirs = exports.buildArduinoCliEnv = void 0;
var env_js_1 = require("./env.js");
Object.defineProperty(exports, "buildArduinoCliEnv", { enumerable: true, get: function () { return env_js_1.buildArduinoCliEnv; } });
Object.defineProperty(exports, "ensureArduinoCliDirs", { enumerable: true, get: function () { return env_js_1.ensureArduinoCliDirs; } });
Object.defineProperty(exports, "arduinoCliPaths", { enumerable: true, get: function () { return env_js_1.arduinoCliPaths; } });
var resolve_js_1 = require("./resolve.js");
Object.defineProperty(exports, "resolveArduinoCli", { enumerable: true, get: function () { return resolve_js_1.resolveArduinoCli; } });
var install_js_1 = require("./install.js");
Object.defineProperty(exports, "installArduinoCli", { enumerable: true, get: function () { return install_js_1.installArduinoCli; } });
Object.defineProperty(exports, "uninstallArduinoCli", { enumerable: true, get: function () { return install_js_1.uninstallArduinoCli; } });
