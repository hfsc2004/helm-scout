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
const registry = __importStar(require("../../core/vehicles/registry.js"));
const setAudio = {
    def: {
        name: "vehicle-audio-set",
        summary: "Attach a roving-microphone sidecar to a vehicle. Helm Scout plays its PCM stream locally; nothing leaves your LAN.",
        args: [
            {
                name: "id",
                kind: "string",
                required: true,
                description: "Vehicle id (from vehicle-list).",
            },
            {
                name: "baseUrl",
                kind: "string",
                required: true,
                description: 'Audio base URL, e.g. "http://172.20.0.17:82".',
            },
        ],
        flags: [
            {
                name: "stream-path",
                kind: "string",
                default: "/audio",
                description: "Chunked PCM endpoint path.",
            },
        ],
        streams: false,
        events: [],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args, flags }) {
        const id = String(args["id"] ?? "").trim();
        const baseUrl = String(args["baseUrl"] ?? "").trim();
        if (!id || !baseUrl) {
            (0, output_js_1.emit)({ error: "vehicle-audio-set requires <id> <baseUrl>." });
            return 64;
        }
        const updated = registry.setAudio(id, {
            baseUrl,
            streamPath: String(flags["stream-path"] ?? "/audio"),
        });
        if (!updated) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        (0, output_js_1.emit)({ vehicle: updated });
        return 0;
    },
};
const clearAudio = {
    def: {
        name: "vehicle-audio-clear",
        summary: "Remove the audio sidecar from a vehicle.",
        args: [
            {
                name: "id",
                kind: "string",
                required: true,
                description: "Vehicle id.",
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
        const id = String(args["id"] ?? "").trim();
        if (!id) {
            (0, output_js_1.emit)({ error: "vehicle-audio-clear requires <id>." });
            return 64;
        }
        const updated = registry.setAudio(id, null);
        if (!updated) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        (0, output_js_1.emit)({ vehicle: updated });
        return 0;
    },
};
(0, registry_js_1.register)(setAudio);
(0, registry_js_1.register)(clearAudio);
