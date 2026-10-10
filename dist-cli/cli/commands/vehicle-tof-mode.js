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
(0, registry_js_1.register)({
    def: {
        name: "vehicle-tof-mode",
        summary: "Read or change v1.3 single-zone ToF distance modes at runtime. Auto retries another mode after persistent invalid returns.",
        args: [
            { name: "id", kind: "string", required: true, description: "Vehicle id or name." },
            { name: "mode", kind: "string", required: true, description: "status | auto | short | medium | long" },
        ],
        flags: [
            { name: "sensor", kind: "string", default: "both", description: "front | rear | both (for mode changes)." },
            { name: "base-url", kind: "string", description: "Sensor board diagnostics URL; defaults to camera host on port 82." },
        ],
        streams: false,
        events: [],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            2: schema_js_1.COMMON_EXIT_CODES[2],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args, flags }) {
        const id = String(args["id"] ?? "").trim();
        const mode = String(args["mode"] ?? "").trim().toLowerCase();
        const sensor = String(flags["sensor"] ?? "both").trim().toLowerCase();
        if (!id || !["status", "auto", "short", "medium", "long"].includes(mode) ||
            !["front", "rear", "both"].includes(sensor)) {
            (0, output_js_1.emit)({ error: "vehicle-tof-mode requires <id> <status|auto|short|medium|long> [--sensor front|rear|both]." });
            return 64;
        }
        const vehicle = registry.get(id) ?? registry.findByName(id);
        if (!vehicle || vehicle.sensorBoardRevision !== "1.3") {
            (0, output_js_1.emit)({ error: "A registered v1.3 sensor-board vehicle is required." });
            return 1;
        }
        if (!vehicle.camera && !flags["base-url"]) {
            (0, output_js_1.emit)({ error: "No sensor-board address: configure the vehicle camera or pass --base-url." });
            return 1;
        }
        let endpoint;
        try {
            const base = new URL(String(flags["base-url"] ?? vehicle.camera.baseUrl));
            if (base.protocol !== "http:")
                throw new Error("HTTP is required");
            if (!flags["base-url"])
                base.port = "82";
            endpoint = new URL("/tof-mode", base);
            if (mode !== "status") {
                endpoint.searchParams.set("sensor", sensor);
                endpoint.searchParams.set("mode", mode);
            }
        }
        catch (error) {
            (0, output_js_1.emit)({ error: error instanceof Error ? error.message : String(error) });
            return 1;
        }
        try {
            const response = await fetch(endpoint, {
                method: mode === "status" ? "GET" : "POST",
                signal: AbortSignal.timeout(5000),
            });
            const body = await response.json();
            (0, output_js_1.emit)(body);
            return response.ok && body.ok === true ? 0 : 1;
        }
        catch (error) {
            (0, output_js_1.emit)({ ok: false, error: error instanceof Error ? error.message : String(error) });
            return 2;
        }
    },
});
