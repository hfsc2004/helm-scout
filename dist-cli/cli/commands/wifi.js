"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const scan_js_1 = require("../../core/wifi/scan.js");
const wifiScan = {
    def: {
        name: "wifi-scan",
        summary: "Scan Wi-Fi networks visible to this host. Linux uses nmcli; other platforms not yet wired.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0], 1: schema_js_1.COMMON_EXIT_CODES[1] },
    },
    async run() {
        const result = await (0, scan_js_1.scan)();
        (0, output_js_1.emit)(result);
        return result.ok ? 0 : 1;
    },
};
(0, registry_js_1.register)(wifiScan);
