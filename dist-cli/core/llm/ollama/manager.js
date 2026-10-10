"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInstalled = isInstalled;
exports.isRunning = isRunning;
exports.start = start;
exports.stop = stop;
exports.status = status;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const paths_js_1 = require("../../paths.js");
const bmoc = __importStar(require("../../bmoc/index.js"));
const env_js_1 = require("./env.js");
const process_utils_js_1 = require("./process-utils.js");
let running = null;
function measureDir(dir) {
    if (!(0, node_fs_1.existsSync)(dir))
        return 0;
    let total = 0;
    for (const entry of (0, node_fs_1.readdirSync)(dir, { withFileTypes: true })) {
        const full = (0, node_path_1.join)(dir, entry.name);
        if (entry.isDirectory())
            total += measureDir(full);
        else if (entry.isFile())
            total += (0, node_fs_1.statSync)(full).size;
    }
    return total;
}
function isInstalled() {
    return (0, node_fs_1.existsSync)(paths_js_1.paths.ollamaBin());
}
function isRunning() {
    return running !== null && running.child.exitCode === null;
}
/**
 * Spawn the private Ollama instance.
 *
 * Throws if the binary isn't installed, if a foreign process holds the port,
 * or if the daemon doesn't become reachable within the timeout.
 */
async function start(opts = {}) {
    if (running !== null && running.child.exitCode === null) {
        return running;
    }
    if (!isInstalled()) {
        throw new Error(`Ollama binary not installed at ${paths_js_1.paths.ollamaBin()}. Run 'helm ollama-install' first.`);
    }
    // Defensive: clean up any stale Helm Scout Ollama processes from a prior crash.
    await (0, process_utils_js_1.killStaleHelmOllama)(env_js_1.HELM_OLLAMA_PORT);
    const claim = await (0, process_utils_js_1.portIsClaimableByHelm)(env_js_1.HELM_OLLAMA_PORT);
    if (!claim.claimable) {
        throw new Error(`Cannot start Helm Scout Ollama: ${claim.reason}. Helm Scout only manages its own Ollama on port ${env_js_1.HELM_OLLAMA_PORT}; it will not touch any other process.`);
    }
    const env = (0, env_js_1.buildOllamaEnv)(opts);
    const child = (0, node_child_process_1.spawn)(paths_js_1.paths.ollamaBin(), ["serve"], {
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
        env,
    });
    if (!child.pid) {
        throw new Error("Failed to spawn Ollama: no PID returned.");
    }
    const sessionId = bmoc.registerSession({
        type: "ollama",
        pid: child.pid,
        port: env_js_1.HELM_OLLAMA_PORT,
    });
    const ref = {
        child,
        sessionId,
        pid: child.pid,
        port: env_js_1.HELM_OLLAMA_PORT,
    };
    running = ref;
    // Surface stderr to Helm Scout's stderr (not stdout) so NDJSON output stays clean.
    child.stderr?.on("data", (chunk) => {
        process.stderr.write(`[ollama] ${chunk}`);
    });
    child.on("exit", (code) => {
        if (running?.pid === ref.pid)
            running = null;
        if (code !== null && code !== 0) {
            process.stderr.write(`[ollama] exited with code ${code}\n`);
        }
    });
    await waitUntilReachable(env_js_1.HELM_OLLAMA_PORT, opts.readyTimeoutMs ?? 30000);
    return ref;
}
async function waitUntilReachable(port, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    const url = `http://127.0.0.1:${port}/api/tags`;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
            if (res.ok || res.status === 200)
                return;
        }
        catch {
            // not ready yet
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Ollama did not become reachable on port ${port} within ${timeoutMs} ms.`);
}
async function stop() {
    if (running === null) {
        // Defense in depth: nothing in-memory, but check for orphans on disk too.
        const killed = await (0, process_utils_js_1.killStaleHelmOllama)(env_js_1.HELM_OLLAMA_PORT);
        return killed > 0;
    }
    const sessionId = running.sessionId;
    await bmoc.closeSession(sessionId);
    running = null;
    return true;
}
async function status() {
    const installed = isInstalled();
    const live = isRunning();
    return {
        installed,
        running: live,
        port: env_js_1.HELM_OLLAMA_PORT,
        pid: live && running ? running.pid : null,
        binaryPath: paths_js_1.paths.ollamaBin(),
        modelsPath: paths_js_1.paths.ollamaModels(),
        env: {
            OLLAMA_HOST: `127.0.0.1:${env_js_1.HELM_OLLAMA_PORT}`,
            OLLAMA_MODELS: paths_js_1.paths.ollamaModels(),
            OLLAMA_ORIGINS: "*",
        },
        bytesUsed: measureDir(paths_js_1.paths.ollamaRoot()),
    };
}
