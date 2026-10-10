"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const state_js_1 = require("../../core/voice/state.js");
const uninstall_js_1 = require("../../core/voice/uninstall.js");
const install_js_1 = require("../../core/voice/install.js");
const status = {
    def: {
        name: "voice-status",
        summary: "Report whether voice (STT/TTS) is installed and how much space it uses.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        (0, output_js_1.emit)({ ...(0, state_js_1.readVoiceState)() });
        return 0;
    },
};
const install = {
    def: {
        name: "voice-install",
        summary: "Download whisper.cpp + piper and the default voice model set.",
        args: [],
        flags: [
            {
                name: "confirm",
                kind: "boolean",
                default: false,
                description: "Required. Downloads ~300 MB the first time.",
            },
        ],
        streams: true,
        events: [
            { event: "plan", description: "Asset list and total size to download." },
            { event: "download", description: "Per-asset download progress." },
            { event: "verify", description: "Per-asset checksum verification." },
            { event: "complete", description: "Final installed state." },
        ],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ flags }) {
        if (flags["confirm"] !== true) {
            (0, output_js_1.emit)({
                error: "voice-install is a network operation. Re-run with --confirm.",
            });
            return 64;
        }
        try {
            const state = await (0, install_js_1.installVoice)();
            (0, output_js_1.emit)({ event: "complete", state });
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
        name: "voice-uninstall",
        summary: "Remove all voice binaries and models. Safe; reinstallable.",
        args: [],
        flags: [
            {
                name: "confirm",
                kind: "boolean",
                default: false,
                description: "Required. Deletes ~/.local/share/psf-helm/voice/.",
            },
        ],
        streams: false,
        events: [],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ flags }) {
        if (flags["confirm"] !== true) {
            const state = (0, state_js_1.readVoiceState)();
            (0, output_js_1.emit)({
                error: "voice-uninstall removes files. Re-run with --confirm.",
                wouldFreeBytes: state.bytesUsed,
            });
            return 64;
        }
        const result = await (0, uninstall_js_1.uninstallVoice)();
        (0, output_js_1.emit)(result);
        return 0;
    },
};
(0, registry_js_1.register)(status);
(0, registry_js_1.register)(install);
(0, registry_js_1.register)(uninstall);
