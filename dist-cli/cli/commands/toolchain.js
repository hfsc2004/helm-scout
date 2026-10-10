"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const index_js_1 = require("../../core/toolchains/arduino-cli/index.js");
const index_js_2 = require("../../core/toolchains/mpremote/index.js");
const status = {
    def: {
        name: "toolchain-status",
        summary: "Report which microcontroller toolchains are available (arduino-cli, mpremote).",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        const arduino = await (0, index_js_1.resolveArduinoCli)();
        const mpremote = await (0, index_js_2.resolveMpremote)();
        (0, output_js_1.emit)({
            arduinoCli: arduino
                ? {
                    available: true,
                    source: arduino.source,
                    version: arduino.version,
                    bin: arduino.bin,
                }
                : {
                    available: false,
                    hint: "Install with: helm toolchain-install --target arduino-cli --confirm",
                    installPath: index_js_1.arduinoCliPaths.bin(),
                },
            mpremote: mpremote
                ? {
                    available: true,
                    source: mpremote.source,
                    version: mpremote.version,
                    bin: mpremote.bin,
                }
                : {
                    available: false,
                    hint: "Install Python 3 and run: pip install mpremote",
                },
        });
        return 0;
    },
};
const install = {
    def: {
        name: "toolchain-install",
        summary: "Install a toolchain. arduino-cli is downloaded from downloads.arduino.cc; mpremote is detect-only and prints install instructions if missing.",
        args: [],
        flags: [
            {
                name: "target",
                kind: "string",
                description: "Toolchain to install: arduino-cli or mpremote.",
            },
            {
                name: "confirm",
                kind: "boolean",
                default: false,
                description: "Required for arduino-cli (network operation).",
            },
        ],
        streams: true,
        events: [
            { event: "fetch", description: "Download progress." },
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
        const target = String(flags["target"] ?? "").trim();
        if (!target) {
            (0, output_js_1.emit)({ error: "toolchain-install requires --target arduino-cli or --target mpremote" });
            return 64;
        }
        if (target === "mpremote") {
            const found = await (0, index_js_2.resolveMpremote)();
            if (found) {
                (0, output_js_1.emit)({ event: "complete", target, ...found });
                return 0;
            }
            (0, output_js_1.emit)({
                event: "error",
                message: "mpremote not found. Install with: pip install mpremote (requires Python 3).",
            });
            return 1;
        }
        if (target !== "arduino-cli") {
            (0, output_js_1.emit)({ error: `unknown target: ${target}` });
            return 64;
        }
        if (flags["confirm"] !== true) {
            (0, output_js_1.emit)({
                error: "arduino-cli install is a network operation. Re-run with --confirm to download from downloads.arduino.cc.",
            });
            return 64;
        }
        try {
            const result = await (0, index_js_1.installArduinoCli)((event) => {
                (0, output_js_1.emit)({ event: event.stage, ...event });
            });
            (0, output_js_1.emit)({ event: "complete", target: "arduino-cli", result });
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
        name: "toolchain-uninstall",
        summary: "Remove Helm Scout's private arduino-cli install. mpremote is system-managed; not removed.",
        args: [],
        flags: [
            {
                name: "target",
                kind: "string",
                description: "Toolchain to uninstall (currently only arduino-cli).",
            },
            {
                name: "confirm",
                kind: "boolean",
                default: false,
                description: "Required to actually delete files.",
            },
        ],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0], 64: schema_js_1.COMMON_EXIT_CODES[64] },
    },
    async run({ flags }) {
        const target = String(flags["target"] ?? "").trim();
        if (target !== "arduino-cli") {
            (0, output_js_1.emit)({ error: "toolchain-uninstall currently only supports --target arduino-cli" });
            return 64;
        }
        if (flags["confirm"] !== true) {
            (0, output_js_1.emit)({
                error: "toolchain-uninstall removes files. Re-run with --confirm.",
            });
            return 64;
        }
        const result = await (0, index_js_1.uninstallArduinoCli)();
        (0, output_js_1.emit)(result);
        return 0;
    },
};
(0, registry_js_1.register)(status);
(0, registry_js_1.register)(install);
(0, registry_js_1.register)(uninstall);
