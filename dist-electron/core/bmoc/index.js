"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * BMOC — sole authority over process lifecycle in Helm Scout.
 *
 * Imported verbatim from PSF Core's session-manager subsystem. The .js files
 * here are battle-tested across years of fighting process/port/orphan cleanup
 * bugs. Do not "modernize" them.
 *
 * Architectural rule (non-negotiable):
 *   Nothing in Helm Scout spawns or kills its own processes. Every subsystem that
 *   needs to run a child process — llama.cpp, whisper.cpp, piper, vehicle
 *   transports later — registers it here. BMOC owns the kill switch.
 *
 * If you find yourself reaching for `child_process.spawn` in a feature module,
 * stop. Route through BMOC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionUtils = exports.processUtils = void 0;
exports.initialize = initialize;
exports.registerSession = registerSession;
exports.getSession = getSession;
exports.closeSession = closeSession;
exports.closeAllSessions = closeAllSessions;
exports.getAllSessions = getAllSessions;
// Verbatim CommonJS modules from PSF Core.
// `require` is available in CJS context (the module system both this file
// and the .js siblings compile to).
const processUtils = require("./session-manager-process-utils.js");
exports.processUtils = processUtils;
const sessionUtils = require("./session-manager-session-utils.js");
exports.sessionUtils = sessionUtils;
const createStateManager = require("./session-manager-state.js");
const state = createStateManager({ processUtils, sessionUtils });
/**
 * Initialize BMOC. Call once at app startup.
 *
 * @param appPath  Path to the Helm Scout install dir. sessions.json is written
 *                 alongside it ("../sessions.json" relative to appPath, per
 *                 PSF Core convention).
 */
function initialize(appPath) {
    state.initialize(appPath);
    state.loadSessions();
    void state.validateSessions();
}
function registerSession(config) {
    return state.registerSession(config);
}
function getSession(sessionId) {
    return state.getSession(sessionId);
}
function closeSession(sessionId) {
    return state.closeSession(sessionId);
}
function closeAllSessions() {
    return state.closeAllSessions();
}
function getAllSessions() {
    return state.getAllSessions();
}
