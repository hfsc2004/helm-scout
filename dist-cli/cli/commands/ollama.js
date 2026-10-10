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
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const manager = __importStar(require("../../core/llm/ollama/manager.js"));
const ollama_download_js_1 = require("../../core/binaries/ollama-download.js");
const status = {
    def: {
        name: "ollama-status",
        summary: "Report Helm Scout's private Ollama state. Helm Scout never touches the system Ollama on 11434.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        (0, output_js_1.emit)({ ...(await manager.status()) });
        return 0;
    },
};
const install = {
    def: {
        name: "ollama-install",
        summary: "Download Helm Scout's private Ollama binary from ollama.com. Opt-in network call; one-time.",
        args: [],
        flags: [
            {
                name: "confirm",
                kind: "boolean",
                default: false,
                description: "Required. Downloads from ollama.com.",
            },
        ],
        streams: true,
        events: [
            { event: "fetch", description: "Tarball download progress." },
            { event: "extract", description: "Tarball extraction." },
            { event: "verify", description: "Binary verification." },
            { event: "complete", description: "Install complete." },
        ],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ flags }) {
        if (flags["confirm"] !== true) {
            (0, output_js_1.emit)({
                error: "ollama-install is a network operation. Re-run with --confirm to download from ollama.com.",
            });
            return 64;
        }
        try {
            const result = await (0, ollama_download_js_1.downloadOllama)((event) => {
                (0, output_js_1.emit)({ event: event.stage, ...event });
            });
            (0, output_js_1.emit)({ event: "complete", result });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({
                event: "error",
                message: err instanceof Error ? err.message : String(err),
            });
            return 1;
        }
    },
};
const uninstall = {
    def: {
        name: "ollama-uninstall",
        summary: "Remove Helm Scout's private Ollama (binary + libraries + models). Reinstallable.",
        args: [],
        flags: [
            {
                name: "confirm",
                kind: "boolean",
                default: false,
                description: "Required. Removes all Helm Scout-private Ollama files.",
            },
        ],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0], 64: schema_js_1.COMMON_EXIT_CODES[64] },
    },
    async run({ flags }) {
        if (flags["confirm"] !== true) {
            const s = await manager.status();
            (0, output_js_1.emit)({
                error: "ollama-uninstall removes files. Re-run with --confirm.",
                wouldFreeBytes: s.bytesUsed,
            });
            return 64;
        }
        if (manager.isRunning()) {
            await manager.stop();
        }
        const result = await (0, ollama_download_js_1.uninstallOllama)();
        (0, output_js_1.emit)(result);
        return 0;
    },
};
const start = {
    def: {
        name: "ollama-start",
        summary: "Start Helm Scout's private Ollama instance on its private port.",
        args: [],
        flags: [
            {
                name: "force-cpu",
                kind: "boolean",
                default: false,
                description: "Disable GPU acceleration for this Ollama instance.",
            },
        ],
        streams: false,
        events: [],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            3: schema_js_1.COMMON_EXIT_CODES[3],
        },
    },
    async run({ flags }) {
        try {
            const ref = await manager.start({
                forceCpu: flags["force-cpu"] === true || flags["force-cpu"] === "true",
            });
            (0, output_js_1.emit)({
                started: true,
                pid: ref.pid,
                port: ref.port,
                sessionId: ref.sessionId,
            });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({
                started: false,
                error: err instanceof Error ? err.message : String(err),
            });
            return 1;
        }
    },
};
const stop = {
    def: {
        name: "ollama-stop",
        summary: "Stop Helm Scout's private Ollama. Never touches the system Ollama.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        const stopped = await manager.stop();
        (0, output_js_1.emit)({ stopped });
        return 0;
    },
};
(0, registry_js_1.register)(status);
(0, registry_js_1.register)(install);
(0, registry_js_1.register)(uninstall);
(0, registry_js_1.register)(start);
(0, registry_js_1.register)(stop);
