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
const wide_tof_js_1 = require("../../core/vehicles/wide-tof.js");
const wide_tof_js_2 = require("../../shared/wide-tof.js");
(0, registry_js_1.register)({
    def: {
        name: "vehicle-wide-tof",
        summary: "Inspect SR Front VL53L5CX data or select detail/navigation/fast/idle/inspect profiles and 4×4/8×8 grids.",
        args: [
            { name: "id", kind: "string", required: true, description: "Vehicle id or name." },
            { name: "mode", kind: "string", required: true, description: "status | frame | detail | navigation | fast | idle | inspect | 4x4 | 8x8" },
        ],
        flags: [
            { name: "base-url", kind: "string", description: "Diagnostics URL; defaults to camera host on port 82." },
            { name: "hz", kind: "number", description: "Requested Hz: detail 10; navigation 10–15; fast 30–60; idle 1–2; inspect 5–10." },
        ],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0], 1: schema_js_1.COMMON_EXIT_CODES[1], 2: schema_js_1.COMMON_EXIT_CODES[2], 64: schema_js_1.COMMON_EXIT_CODES[64] },
    },
    async run({ args, flags }) {
        const id = String(args["id"] ?? "").trim();
        const rawMode = String(args["mode"] ?? "").toLowerCase();
        const mode = rawMode === "4x4" ? "fast" : rawMode === "8x8" ? "detail" : rawMode;
        if (!id || (mode !== "status" && mode !== "frame" && !(0, wide_tof_js_2.isWideTofProfile)(mode)) ||
            ((mode === "status" || mode === "frame") && flags["hz"] !== undefined)) {
            (0, output_js_1.emit)({ error: "Use <id> <status|frame|detail|navigation|fast|idle|inspect|4x4|8x8> [--hz N]." });
            return 64;
        }
        const vehicle = registry.get(id) ?? registry.findByName(id);
        if (!vehicle) {
            (0, output_js_1.emit)({ error: "Vehicle not found." });
            return 1;
        }
        try {
            if (mode === "frame") {
                const result = await (0, wide_tof_js_1.readWideTof)(vehicle, flags["base-url"] ? String(flags["base-url"]) : undefined);
                (0, output_js_1.emit)(result);
                return result.ok ? 0 : 1;
            }
            const result = await (0, wide_tof_js_1.configureWideTof)(vehicle, mode === "status" ? undefined : mode, flags["base-url"] ? String(flags["base-url"]) : undefined, flags["hz"] === undefined ? undefined : Number(flags["hz"]));
            (0, output_js_1.emit)(result);
            return result.ok ? 0 : 1;
        }
        catch (error) {
            (0, output_js_1.emit)({ ok: false, error: error instanceof Error ? error.message : String(error) });
            return 2;
        }
    },
});
