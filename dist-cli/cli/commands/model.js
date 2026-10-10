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
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const paths_js_1 = require("../../core/paths.js");
const index_js_1 = require("../../core/download/index.js");
const wrap = __importStar(require("../../core/llm/ollama/wrap.js"));
const ollamaManager = __importStar(require("../../core/llm/ollama/manager.js"));
function ensureStagingDir() {
    const dir = paths_js_1.paths.modelStaging();
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    return dir;
}
function filenameFromUrl(url) {
    const cleaned = url.split("?")[0] ?? url;
    const tail = cleaned.split("/").pop() ?? "model.gguf";
    return tail || "model.gguf";
}
function modelNameFromFilename(filename) {
    return filename
        .replace(/\.gguf$/i, "")
        .replace(/[^a-zA-Z0-9.-]+/g, "-")
        .toLowerCase();
}
const list = {
    def: {
        name: "model-list",
        summary: "List models registered with Helm Scout's private Ollama.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0], 1: schema_js_1.COMMON_EXIT_CODES[1] },
    },
    async run() {
        try {
            const models = await wrap.listModels();
            (0, output_js_1.emit)({ models });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({
                error: err instanceof Error ? err.message : String(err),
                hint: "Is Helm Scout's private Ollama running? Try `helm ollama-start`.",
            });
            return 1;
        }
    },
};
const download = {
    def: {
        name: "model-download",
        summary: "Download a .gguf model from huggingface.co (or any direct URL) and register it with Helm Scout's private Ollama.",
        args: [
            {
                name: "url",
                kind: "string",
                required: true,
                description: "Direct URL to the .gguf file.",
            },
        ],
        flags: [
            {
                name: "name",
                kind: "string",
                description: "Name to register the model under in Ollama. Derived from filename if omitted.",
            },
            {
                name: "force-cpu",
                kind: "boolean",
                default: false,
                description: "Pin this model to CPU inference.",
            },
        ],
        streams: true,
        events: [
            { event: "fetch", description: "Download progress." },
            { event: "verify", description: "Checksum verification." },
            { event: "wrap", description: "Ollama registration (blob upload + create)." },
            { event: "complete", description: "Model is ready to use." },
        ],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            2: schema_js_1.COMMON_EXIT_CODES[2],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args, flags }) {
        const url = String(args["url"] ?? "").trim();
        if (!url) {
            (0, output_js_1.emit)({ error: "model-download requires <url>." });
            return 64;
        }
        if (!ollamaManager.isRunning()) {
            (0, output_js_1.emit)({
                error: "Helm Scout's private Ollama is not running.",
                hint: "Run `helm ollama-start` first (and `helm ollama-install --confirm` if you haven't yet).",
            });
            return 1;
        }
        const filename = filenameFromUrl(url);
        const modelName = String(flags["name"] ?? modelNameFromFilename(filename)).trim();
        const destinationDir = ensureStagingDir();
        const filePath = (0, node_path_1.join)(destinationDir, filename);
        try {
            const result = await (0, index_js_1.downloadModel)({
                url,
                filename,
                destinationDir,
                progressCallback: (p) => {
                    (0, output_js_1.emit)({ event: "fetch", ...p });
                },
            });
            if (!result.success || !result.filePath) {
                (0, output_js_1.emit)({ event: "error", error: result.error ?? "download failed" });
                return 2;
            }
            (0, output_js_1.emit)({ event: "verify", ok: true, sha256: result.sha256, bytes: result.bytes });
            const forceCpu = flags["force-cpu"] === true || flags["force-cpu"] === "true";
            const wrapResult = await wrap.wrapForOllama({
                ggufPath: filePath,
                modelName,
                forceCpu,
                onProgress: (e) => (0, output_js_1.emit)({ event: "wrap", ...e }),
            });
            const stat = (0, node_fs_1.statSync)(filePath);
            (0, output_js_1.emit)({
                event: "complete",
                model: {
                    name: wrapResult.modelName,
                    mainDigest: wrapResult.mainDigest,
                    hasVision: wrapResult.hasVision,
                    stagedFile: filePath,
                    bytes: stat.size,
                },
            });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({
                event: "error",
                error: err instanceof Error ? err.message : String(err),
            });
            return 1;
        }
    },
};
const remove = {
    def: {
        name: "model-remove",
        summary: "Remove a model from Helm Scout's private Ollama by name.",
        args: [
            {
                name: "name",
                kind: "string",
                required: true,
                description: "Model name as shown by `helm model-list`.",
            },
        ],
        flags: [],
        streams: false,
        events: [],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args }) {
        const name = String(args["name"] ?? "").trim();
        if (!name) {
            (0, output_js_1.emit)({ error: "model-remove requires <name>." });
            return 64;
        }
        try {
            await wrap.removeModel(name);
            (0, output_js_1.emit)({ removed: true, name });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({
                error: err instanceof Error ? err.message : String(err),
            });
            return 1;
        }
    },
};
(0, registry_js_1.register)(list);
(0, registry_js_1.register)(download);
(0, registry_js_1.register)(remove);
