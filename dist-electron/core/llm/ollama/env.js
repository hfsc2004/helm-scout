"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HELM_OLLAMA_PORT = void 0;
exports.buildOllamaEnv = buildOllamaEnv;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const paths_js_1 = require("../../paths.js");
/**
 * Helm Scout's private Ollama port.
 *
 * Picked above Core-CE's 52434-52443 range so Helm Scout and Core-CE can coexist
 * on the same machine without colliding. Distinct from system Ollama's 11434.
 */
exports.HELM_OLLAMA_PORT = 52450;
/**
 * Build the isolation env vars for Helm Scout's private Ollama instance.
 *
 * The four-variable contract is the entire reason Helm Scout's Ollama and the
 * system's Ollama can coexist without stepping on each other:
 *
 *  - OLLAMA_HOST    pins the bind address/port to Helm Scout's private port.
 *  - OLLAMA_MODELS  points at Helm Scout's own models dir, not ~/.ollama/models.
 *  - OLLAMA_ORIGINS allows Helm Scout's renderer to call the API (wildcard is fine
 *                   because the daemon is bound to localhost only via HOST).
 *  - CUDA_VISIBLE_DEVICES (optional) forces a specific GPU UUID. Headless GPU
 *                   selection comes from core/hardware before we spawn.
 */
function buildOllamaEnv(opts = {}) {
    const env = {
        ...process.env,
        OLLAMA_HOST: `127.0.0.1:${exports.HELM_OLLAMA_PORT}`,
        OLLAMA_ORIGINS: "*",
        OLLAMA_MODELS: paths_js_1.paths.ollamaModels(),
    };
    if (opts.forceCpu) {
        env["CUDA_VISIBLE_DEVICES"] = "";
    }
    else if (opts.cudaDeviceUuid) {
        env["CUDA_VISIBLE_DEVICES"] = opts.cudaDeviceUuid;
    }
    return env;
}
