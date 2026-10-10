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
const setSensorBoard = {
    def: {
        name: "vehicle-sensor-board-set",
        summary: "Set a vehicle's GSN Robotics / PSF Sensor Board revision.",
        args: [
            { name: "id", kind: "string", required: true, description: "Vehicle id." },
            { name: "revision", kind: "string", required: true, description: "1.1, 1.3, or none." },
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
        const raw = String(args["revision"] ?? "").trim();
        if (!id || (raw !== "1.1" && raw !== "1.3" && raw !== "none")) {
            (0, output_js_1.emit)({ error: "vehicle-sensor-board-set requires <id> <1.1|1.3|none>." });
            return 64;
        }
        const updated = registry.setSensorBoardRevision(id, raw === "none" ? null : raw);
        if (!updated) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        (0, output_js_1.emit)({ vehicle: updated });
        return 0;
    },
};
(0, registry_js_1.register)(setSensorBoard);
