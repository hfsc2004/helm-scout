"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const index_js_1 = require("../../core/hardware/index.js");
const command = {
    def: {
        name: "hardware",
        summary: "Detect installed GPUs and report the inference classification (headless-first NVIDIA selection).",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0], 1: schema_js_1.COMMON_EXIT_CODES[1] },
    },
    async run() {
        try {
            const hw = await (0, index_js_1.detectHardware)(process.cwd());
            const classification = (0, index_js_1.classifyForInference)(hw);
            const selection = classification.accelerationType === "nvidia"
                ? (0, index_js_1.selectNvidiaGpu)(classification)
                : null;
            (0, output_js_1.emit)({ hardware: hw, classification, nvidiaSelection: selection });
            return 0;
        }
        catch (err) {
            (0, output_js_1.emit)({
                error: err instanceof Error ? err.message : String(err),
            });
            return 1;
        }
    },
};
(0, registry_js_1.register)(command);
exports.default = command;
