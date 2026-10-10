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
const adapter = __importStar(require("../../core/vehicles/ground-skidsteer.js"));
const planner_js_1 = require("../../core/llm/planner.js");
const ollamaManager = __importStar(require("../../core/llm/ollama/manager.js"));
const limits_js_1 = require("../../core/storage/limits.js");
const drive = {
    def: {
        name: "drive",
        summary: "Drive a vehicle by natural-language intent. Helm Scout plans, validates, then sends a single command.",
        args: [
            {
                name: "id",
                kind: "string",
                required: true,
                description: "Vehicle id (from helm vehicle-list).",
            },
            {
                name: "intent",
                kind: "string",
                required: true,
                description: 'Quoted natural-language intent, e.g. "go forward 2 seconds".',
            },
        ],
        flags: [
            {
                name: "model",
                kind: "string",
                default: planner_js_1.DEFAULT_PLANNER_MODEL,
                description: "Model to plan with. Must be registered in Helm Scout's private Ollama.",
            },
            {
                name: "dry-run",
                kind: "boolean",
                default: false,
                description: "Plan and validate; do not actually send the command.",
            },
            {
                name: "no-retry",
                kind: "boolean",
                default: false,
                description: "Fail on first invalid model output; do not retry.",
            },
            {
                name: "temperature",
                kind: "number",
                default: 0.0,
                description: "Sampling temperature. 0.0 = deterministic.",
            },
        ],
        streams: true,
        events: [
            { event: "plan", description: "The proposed command after planner validation." },
            { event: "validate", description: "Planner validation result (ok or reason)." },
            { event: "execute", description: "Command being sent to the vehicle." },
            { event: "complete", description: "Final result." },
        ],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            2: schema_js_1.COMMON_EXIT_CODES[2],
            3: schema_js_1.COMMON_EXIT_CODES[3],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args, flags }) {
        const id = String(args["id"] ?? "").trim();
        const intent = String(args["intent"] ?? "").trim();
        if (!id || !intent) {
            (0, output_js_1.emit)({ error: "drive requires <id> <intent>." });
            return 64;
        }
        if (intent.length > limits_js_1.STORAGE_LIMITS.intentMaxBytes) {
            (0, output_js_1.emit)({
                error: `intent exceeds ${limits_js_1.STORAGE_LIMITS.intentMaxBytes}-byte limit`,
            });
            return 64;
        }
        const vehicle = registry.get(id);
        if (!vehicle) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        if (!ollamaManager.isRunning()) {
            (0, output_js_1.emit)({
                error: "Helm Scout's private Ollama is not running.",
                hint: "Run `helm ollama-start` first.",
            });
            return 1;
        }
        const model = String(flags["model"] ?? planner_js_1.DEFAULT_PLANNER_MODEL);
        const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
        const noRetry = flags["no-retry"] === true || flags["no-retry"] === "true";
        const temperature = Number(flags["temperature"] ?? 0.0);
        // 1. Plan.
        let result;
        try {
            result = await (0, planner_js_1.plan)({
                vehicle,
                intent,
                model,
                temperature,
                retryOnInvalid: !noRetry,
            });
        }
        catch (err) {
            (0, output_js_1.emit)({
                event: "error",
                error: err instanceof Error ? err.message : String(err),
            });
            return 1;
        }
        if (!result.ok) {
            (0, output_js_1.emit)({
                event: "validate",
                ok: false,
                reason: result.reason,
                modelUsed: result.modelUsed,
                attempts: result.attempts,
                raw: result.raw.slice(0, 500),
            });
            (0, output_js_1.emit)({ event: "complete", ok: false, reason: result.reason });
            return 1;
        }
        (0, output_js_1.emit)({
            event: "plan",
            command: result.command,
            modelUsed: result.modelUsed,
            attempts: result.attempts,
        });
        (0, output_js_1.emit)({ event: "validate", ok: true });
        if (dryRun) {
            (0, output_js_1.emit)({ event: "complete", ok: true, dryRun: true });
            return 0;
        }
        // 2. Execute.
        (0, output_js_1.emit)({ event: "execute", command: result.command });
        try {
            const ack = await adapter.sendCommand(vehicle, result.command);
            if (!ack.ok) {
                (0, output_js_1.emit)({ event: "complete", ok: false, ack });
                return 3;
            }
            (0, output_js_1.emit)({ event: "complete", ok: true, ack });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({
                event: "complete",
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            });
            return 2;
        }
    },
};
(0, registry_js_1.register)(drive);
