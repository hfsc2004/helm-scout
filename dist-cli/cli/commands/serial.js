"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const index_js_1 = require("../../core/serial/index.js");
const list = {
    def: {
        name: "serial-list",
        summary: "List USB/serial devices on the host. Detects raspberry-pi-pico and esp32 boards.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        const ports = (0, index_js_1.listSerialPorts)();
        (0, output_js_1.emit)({ ports });
        return 0;
    },
};
(0, registry_js_1.register)(list);
