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
function flagBool(flags, name) {
    if (!(name in flags))
        return undefined;
    const v = flags[name];
    if (typeof v === "boolean")
        return v;
    const s = String(v).toLowerCase().trim();
    if (s === "true" || s === "1" || s === "yes")
        return true;
    if (s === "false" || s === "0" || s === "no")
        return false;
    return undefined;
}
function flagNumber(flags, name) {
    if (!(name in flags))
        return undefined;
    const v = flags[name];
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}
const flashConfigSet = {
    def: {
        name: "vehicle-flash-config-set",
        summary: "Set per-board flash params (FQBN, profile, library path, USB CDC, erase, runtime serial).",
        args: [
            { name: "id", kind: "string", required: true, description: "Vehicle id." },
        ],
        flags: [
            { name: "board", kind: "string", description: "Which board: drive | video." },
            { name: "fqbn", kind: "string", description: "Arduino FQBN (e.g. esp32:esp32:esp32 or esp32:esp32:esp32s3)." },
            // drive-only
            { name: "sketch-name", kind: "string", description: "(drive) Sketch name for compile staging." },
            { name: "compile-timeout-ms", kind: "number", description: "(drive) Compile timeout in ms." },
            { name: "upload-timeout-ms", kind: "number", description: "(drive) Upload timeout in ms." },
            { name: "monitor-baud", kind: "number", description: "(drive) Serial monitor baud rate." },
            // video-only
            { name: "board-profile", kind: "string", description: "(video) Board profile (e.g. elegoo-esp32s3-camera-v1)." },
            { name: "pin-profile", kind: "string", description: "(video) Camera pin profile override." },
            { name: "library-path", kind: "string", description: "(video) Alt esp32-camera library path." },
            { name: "usb-cdc-on-boot", kind: "boolean", description: "(video) Enable USB CDC on boot." },
            { name: "erase-before-upload", kind: "boolean", description: "(video) Erase flash before upload." },
            { name: "capture-runtime-serial", kind: "boolean", description: "(video) Capture serial after upload." },
            { name: "runtime-serial-capture-ms", kind: "number", description: "(video) ms to capture serial after upload." },
            { name: "sta-enabled", kind: "boolean", description: "(video) Join the LAN as STA (vs AP-only)." },
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
            (0, output_js_1.emit)({ error: "vehicle-flash-config-set requires <id>." });
            return 64;
        }
        const board = parseBoard(flags["board"]);
        if (typeof board !== "string") {
            (0, output_js_1.emit)({ error: board.error });
            return 64;
        }
        const fqbn = String(flags["fqbn"] ?? "").trim();
        if (!fqbn) {
            (0, output_js_1.emit)({ error: "vehicle-flash-config-set requires --fqbn." });
            return 64;
        }
        if (board === "drive") {
            const cfg = {
                fqbn,
                sketchName: String(flags["sketch-name"] ?? "psf_helm_drive"),
            };
            const ct = flagNumber(flags, "compile-timeout-ms");
            if (ct !== undefined)
                cfg.compileTimeoutMs = ct;
            const ut = flagNumber(flags, "upload-timeout-ms");
            if (ut !== undefined)
                cfg.uploadTimeoutMs = ut;
            const baud = flagNumber(flags, "monitor-baud");
            if (baud !== undefined)
                cfg.monitorBaudRate = baud;
            const updated = registry.setFlash(id, "drive", cfg);
            if (!updated) {
                (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
                return 1;
            }
            (0, output_js_1.emit)({ vehicle: updated });
            return 0;
        }
        // board === "video"
        const cfg = { fqbn };
        const profile = String(flags["board-profile"] ?? "").trim();
        if (profile)
            cfg.boardProfile = profile;
        const pin = String(flags["pin-profile"] ?? "").trim();
        if (pin)
            cfg.pinProfile = pin;
        const lib = String(flags["library-path"] ?? "").trim();
        if (lib)
            cfg.libraryPath = lib;
        const usb = flagBool(flags, "usb-cdc-on-boot");
        if (usb !== undefined)
            cfg.usbCdcOnBoot = usb;
        const erase = flagBool(flags, "erase-before-upload");
        if (erase !== undefined)
            cfg.eraseBeforeUpload = erase;
        const cap = flagBool(flags, "capture-runtime-serial");
        if (cap !== undefined)
            cfg.captureRuntimeSerial = cap;
        const capMs = flagNumber(flags, "runtime-serial-capture-ms");
        if (capMs !== undefined)
            cfg.runtimeSerialCaptureMs = capMs;
        const sta = flagBool(flags, "sta-enabled");
        if (sta !== undefined)
            cfg.staEnabled = sta;
        const updated = registry.setFlash(id, "video", cfg);
        if (!updated) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        (0, output_js_1.emit)({ vehicle: updated });
        return 0;
    },
};
const flashConfigClear = {
    def: {
        name: "vehicle-flash-config-clear",
        summary: "Remove the saved flash params for one board of a vehicle.",
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
            (0, output_js_1.emit)({ error: "vehicle-flash-config-clear requires <id>." });
            return 64;
        }
        const board = parseBoard(flags["board"]);
        if (typeof board !== "string") {
            (0, output_js_1.emit)({ error: board.error });
            return 64;
        }
        const updated = board === "drive"
            ? registry.setFlash(id, "drive", null)
            : registry.setFlash(id, "video", null);
        if (!updated) {
            (0, output_js_1.emit)({ error: `No vehicle with id ${id}.` });
            return 1;
        }
        (0, output_js_1.emit)({ vehicle: updated });
        return 0;
    },
};
(0, registry_js_1.register)(flashConfigSet);
(0, registry_js_1.register)(flashConfigClear);
