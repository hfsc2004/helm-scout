"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const privacy_js_1 = require("../../core/privacy.js");
const paths_js_1 = require("../../core/paths.js");
function readVersion() {
    const pkgPath = (0, node_path_1.join)(__dirname, "..", "..", "package.json");
    const raw = (0, node_fs_1.readFileSync)(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    return pkg.version ?? "0.0.0";
}
const command = {
    def: {
        name: "privacy",
        summary: "Emit the privacy posture (canary, outbound destinations, local data) as JSON.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        (0, output_js_1.emit)((0, privacy_js_1.buildPrivacyPosture)({
            version: readVersion(),
            dataPath: paths_js_1.paths.data,
        }));
        return 0;
    },
};
(0, registry_js_1.register)(command);
exports.default = command;
