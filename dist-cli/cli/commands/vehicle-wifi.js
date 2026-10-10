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
const VALID_BOARDS = ["drive", "video"];
function parseBoard(value) {
    const s = String(value ?? "").trim().toLowerCase();
    if (!VALID_BOARDS.includes(s)) {
        return { error: `--board must be one of: ${VALID_BOARDS.join(", ")}` };
    }
    return s;
}
const wifiSet = {
    def: {
        name: "vehicle-wifi-set",
        summary: "Set the Wi-Fi credentials (and optional static IP) for one board of a vehicle.",
        args: [
            { name: "id", kind: "string", required: true, description: "Vehicle id." },
        ],
        flags: [
            { name: "board", kind: "string", description: "Which board: drive | video." },
            { name: "ssid", kind: "string", description: "Wi-Fi SSID." },
            { name: "password", kind: "string", description: "Wi-Fi password (secret)." },
            { name: "static-ip", kind: "string", description: "Static IP. Omit for DHCP." },
            { name: "static-cidr", kind: "number", default: 24, description: "Static-IP CIDR prefix." },
            {
                name: "static-gateway",
                kind: "string",
                description: "Gateway IP (only if static).",
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
        if (!id) {
            (0, output_js_1.emit)({ error: "vehicle-wifi-set requires <id>." });
            return 64;
        }
        const board = parseBoard(flags["board"]);
        if (typeof board !== "string") {
            (0, output_js_1.emit)({ error: board.error });
            return 64;
        }
        const ssid = String(flags["ssid"] ?? "").trim();
        const password = String(flags["password"] ?? "");
        if (!ssid || !password) {
            (0, output_js_1.emit)({ error: "vehicle-wifi-set requires --ssid and --password." });
            return 64;
        }
        const cfg = { ssid, password };
        const staticIp = String(flags["static-ip"] ?? "").trim();
        if (staticIp) {
            const cidrRaw = Number(flags["static-cidr"] ?? 24);
            const cidr = Number.isFinite(cidrRaw) ? cidrRaw : 24;
            const gateway = String(flags["static-gateway"] ?? "").trim();
            cfg.static = {
                ip: staticIp,
                cidr,
                gatewayEnabled: gateway.length > 0,
                gateway,
            };
        }
        const updated = registry.setWifi(id, board, cfg);
        if (!updated) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        (0, output_js_1.emit)({ vehicle: updated });
        return 0;
    },
};
const wifiClear = {
    def: {
        name: "vehicle-wifi-clear",
        summary: "Remove the Wi-Fi config for one board of a vehicle.",
        args: [
            { name: "id", kind: "string", required: true, description: "Vehicle id." },
        ],
        flags: [
            { name: "board", kind: "string", description: "Which board: drive | video." },
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
        if (!id) {
            (0, output_js_1.emit)({ error: "vehicle-wifi-clear requires <id>." });
            return 64;
        }
        const board = parseBoard(flags["board"]);
        if (typeof board !== "string") {
            (0, output_js_1.emit)({ error: board.error });
            return 64;
        }
        const updated = registry.setWifi(id, board, null);
        if (!updated) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        (0, output_js_1.emit)({ vehicle: updated });
        return 0;
    },
};
(0, registry_js_1.register)(wifiSet);
(0, registry_js_1.register)(wifiClear);
