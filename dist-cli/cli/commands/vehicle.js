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
const vehicle_contract_js_1 = require("../../shared/vehicle-contract.js");
const vehicleList = {
    def: {
        name: "vehicle-list",
        summary: "List registered vehicles.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        (0, output_js_1.emit)({ vehicles: registry.list() });
        return 0;
    },
};
const vehicleAdd = {
    def: {
        name: "vehicle-add",
        summary: "Register a new vehicle by host and name.",
        args: [
            {
                name: "host",
                kind: "string",
                required: true,
                description: "IP address or hostname of the vehicle's HTTP control endpoint.",
            },
        ],
        flags: [
            {
                name: "name",
                kind: "string",
                description: "Friendly name. Must be unique. Defaults to the host.",
            },
            {
                name: "port",
                kind: "number",
                default: 8080,
                description: "HTTP port. Defaults to 8080.",
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
        const host = String(args["host"] ?? flags["host"] ?? "").trim();
        if (!host) {
            (0, output_js_1.emit)({ error: "vehicle-add requires <host>." });
            return 64;
        }
        const name = String(flags["name"] ?? host).trim();
        const port = Number(flags["port"] ?? 8080);
        try {
            const vehicle = registry.add({ name, host, port });
            (0, output_js_1.emit)({ vehicle });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({ error: err instanceof Error ? err.message : String(err) });
            return 1;
        }
    },
};
const vehicleRemove = {
    def: {
        name: "vehicle-remove",
        summary: "Unregister a vehicle by id.",
        args: [
            {
                name: "id",
                kind: "string",
                required: true,
                description: "Vehicle id (from vehicle-list).",
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
            (0, output_js_1.emit)({ error: "vehicle-remove requires <id>." });
            return 64;
        }
        const ok = registry.remove(id);
        if (!ok) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        (0, output_js_1.emit)({ removed: true, id });
        return 0;
    },
};
const vehicleHealth = {
    def: {
        name: "vehicle-health",
        summary: "Check health of a registered vehicle. Hits /health on the firmware.",
        args: [
            {
                name: "id",
                kind: "string",
                required: true,
                description: "Vehicle id (from vehicle-list).",
            },
        ],
        flags: [],
        streams: false,
        events: [],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            2: schema_js_1.COMMON_EXIT_CODES[2],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args }) {
        const id = String(args["id"] ?? "").trim();
        if (!id) {
            (0, output_js_1.emit)({ error: "vehicle-health requires <id>." });
            return 64;
        }
        const vehicle = registry.get(id);
        if (!vehicle) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        try {
            if (!(0, vehicle_contract_js_1.hasDriveControl)(vehicle)) {
                if (!vehicle.camera) {
                    (0, output_js_1.emit)({ ok: false, reachable: false, error: "no camera endpoint configured" });
                    return 2;
                }
                const path = vehicle.camera.flashStatusPath ?? "/health";
                const res = await fetch(`${vehicle.camera.baseUrl.replace(/\/$/, "")}${path}`, {
                    signal: AbortSignal.timeout(5000),
                });
                const health = await res.json();
                (0, output_js_1.emit)({ ok: res.ok, reachable: res.ok, health, endpoint: "camera" });
                return res.ok ? 0 : 2;
            }
            const health = await adapter.health(vehicle);
            if (!health) {
                (0, output_js_1.emit)({ ok: false, reachable: false });
                return 2;
            }
            (0, output_js_1.emit)({ ok: true, reachable: true, health });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({
                ok: false,
                reachable: false,
                error: err instanceof Error ? err.message : String(err),
            });
            return 2;
        }
    },
};
const vehicleState = {
    def: {
        name: "state",
        summary: "Get current vehicle state (motors, RSSI, deadman age). The vehicle reports about itself; stays local.",
        args: [
            {
                name: "id",
                kind: "string",
                required: true,
                description: "Vehicle id.",
            },
        ],
        flags: [
            {
                name: "follow",
                kind: "boolean",
                default: false,
                description: "Stream state as NDJSON. One line per poll.",
            },
            {
                name: "interval",
                kind: "number",
                default: 500,
                description: "Polling interval in ms when --follow is set.",
            },
        ],
        streams: true,
        events: [{ event: "state", description: "One state reading per emit." }],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            2: schema_js_1.COMMON_EXIT_CODES[2],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args, flags }) {
        const id = String(args["id"] ?? "").trim();
        if (!id) {
            (0, output_js_1.emit)({ error: "state requires <id>." });
            return 64;
        }
        const vehicle = registry.get(id);
        if (!vehicle) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        const follow = flags["follow"] === true || flags["follow"] === "true";
        const interval = Math.max(100, Number(flags["interval"] ?? 500));
        const pollOnce = async () => {
            const state = await adapter.getState(vehicle);
            if (!state) {
                (0, output_js_1.emit)({ event: "error", reachable: false });
                return 2;
            }
            (0, output_js_1.emit)({ event: "state", t: Date.now(), state });
            return 0;
        };
        if (!follow) {
            return pollOnce();
        }
        while (true) {
            const exit = await pollOnce();
            if (exit !== 0)
                return exit;
            await new Promise((r) => setTimeout(r, interval));
        }
    },
};
const vehicleStop = {
    def: {
        name: "stop",
        summary: "Emergency stop a vehicle. Always safe to call.",
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
            2: schema_js_1.COMMON_EXIT_CODES[2],
            3: schema_js_1.COMMON_EXIT_CODES[3],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args }) {
        const id = String(args["id"] ?? "").trim();
        if (!id) {
            (0, output_js_1.emit)({ error: "stop requires <id>." });
            return 64;
        }
        const vehicle = registry.get(id);
        if (!vehicle) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        try {
            const ack = await adapter.emergencyStop(vehicle);
            (0, output_js_1.emit)({ stopped: ack.ok, ack });
            return ack.ok ? 0 : 3;
        }
        catch (err) {
            (0, output_js_1.emit)({ error: err instanceof Error ? err.message : String(err) });
            return 2;
        }
    },
};
const vehicleCmd = {
    def: {
        name: "cmd",
        summary: "Send a direct (no-LLM) command to a vehicle. action: stop | fwd | rev | turn | tank.",
        args: [
            {
                name: "id",
                kind: "string",
                required: true,
                description: "Vehicle id.",
            },
            {
                name: "action",
                kind: "string",
                required: true,
                description: "One of: stop, fwd, rev, turn, tank.",
            },
        ],
        flags: [
            {
                name: "speed",
                kind: "number",
                description: "For fwd/rev: 0..255. For turn: signed -255..255 (negative = left).",
            },
            {
                name: "left",
                kind: "number",
                description: "For tank: left wheel -255..255.",
            },
            {
                name: "right",
                kind: "number",
                description: "For tank: right wheel -255..255.",
            },
            {
                name: "ms",
                kind: "number",
                description: "Duration in milliseconds (100..5000). Optional.",
            },
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
        const actionName = String(args["action"] ?? "").trim().toLowerCase();
        if (!id || !actionName) {
            (0, output_js_1.emit)({ error: "cmd requires <id> <action>." });
            return 64;
        }
        const vehicle = registry.get(id);
        if (!vehicle) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        const ms = flags["ms"] !== undefined ? Number(flags["ms"]) : undefined;
        const speed = flags["speed"] !== undefined ? Number(flags["speed"]) : undefined;
        let action;
        switch (actionName) {
            case "stop":
                action = { kind: "stop" };
                break;
            case "fwd":
                if (speed === undefined) {
                    (0, output_js_1.emit)({ error: "cmd fwd requires --speed." });
                    return 64;
                }
                action = { kind: "fwd", speed, durationMs: ms };
                break;
            case "rev":
                if (speed === undefined) {
                    (0, output_js_1.emit)({ error: "cmd rev requires --speed." });
                    return 64;
                }
                action = { kind: "rev", speed, durationMs: ms };
                break;
            case "turn":
                if (speed === undefined) {
                    (0, output_js_1.emit)({ error: "cmd turn requires --speed (signed; negative = left)." });
                    return 64;
                }
                action = { kind: "turn", signed: speed, durationMs: ms };
                break;
            case "tank": {
                const left = flags["left"] !== undefined ? Number(flags["left"]) : undefined;
                const right = flags["right"] !== undefined ? Number(flags["right"]) : undefined;
                if (left === undefined || right === undefined) {
                    (0, output_js_1.emit)({ error: "cmd tank requires --left and --right." });
                    return 64;
                }
                action = { kind: "tank", left, right, durationMs: ms };
                break;
            }
            default:
                (0, output_js_1.emit)({ error: `Unknown action: ${actionName}` });
                return 64;
        }
        try {
            const ack = await adapter.sendCommand(vehicle, action);
            (0, output_js_1.emit)({ ok: ack.ok, action, ack });
            return ack.ok ? 0 : 2;
        }
        catch (err) {
            (0, output_js_1.emit)({
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            });
            return 2;
        }
    },
};
(0, registry_js_1.register)(vehicleList);
(0, registry_js_1.register)(vehicleAdd);
(0, registry_js_1.register)(vehicleRemove);
(0, registry_js_1.register)(vehicleHealth);
(0, registry_js_1.register)(vehicleState);
(0, registry_js_1.register)(vehicleStop);
(0, registry_js_1.register)(vehicleCmd);
