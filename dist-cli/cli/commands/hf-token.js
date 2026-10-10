"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_readline_1 = require("node:readline");
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const secrets_js_1 = require("../../core/secrets.js");
async function readFromStdin() {
    return new Promise((resolve) => {
        const rl = (0, node_readline_1.createInterface)({ input: process.stdin, terminal: false });
        let buf = "";
        rl.on("line", (line) => {
            if (buf === "")
                buf = line;
        });
        rl.on("close", () => resolve(buf.trim()));
    });
}
const set = {
    def: {
        name: "hf-token-set",
        summary: "Store the Hugging Face access token in .env. Token never appears on the command line or in logs.",
        args: [],
        flags: [
            {
                name: "from-stdin",
                kind: "boolean",
                default: false,
                description: "Read the token from stdin (recommended).",
            },
            {
                name: "from-env",
                kind: "string",
                description: "Copy the value of the named env var (e.g., --from-env HF_TOKEN).",
            },
        ],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0], 64: schema_js_1.COMMON_EXIT_CODES[64] },
    },
    async run({ flags }) {
        let token = null;
        if (flags["from-stdin"] === true || flags["from-stdin"] === "true") {
            token = await readFromStdin();
        }
        else if (typeof flags["from-env"] === "string") {
            token = process.env[flags["from-env"]] ?? null;
        }
        else {
            (0, output_js_1.emit)({
                error: "hf-token-set requires --from-stdin or --from-env <NAME>. The token must not appear on the command line.",
            });
            return 64;
        }
        if (!token) {
            (0, output_js_1.emit)({ error: "no token provided." });
            return 64;
        }
        (0, secrets_js_1.setSecret)("HF_TOKEN", token);
        (0, output_js_1.emit)({ stored: true, length: token.length });
        return 0;
    },
};
const status = {
    def: {
        name: "hf-token-status",
        summary: "Report whether an HF token is configured. Never emits the token itself.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        (0, output_js_1.emit)({ present: (0, secrets_js_1.hasSecret)("HF_TOKEN") });
        return 0;
    },
};
const clear = {
    def: {
        name: "hf-token-clear",
        summary: "Remove the stored HF token from .env.",
        args: [],
        flags: [],
        streams: false,
        events: [],
        exitCodes: { 0: schema_js_1.COMMON_EXIT_CODES[0] },
    },
    async run() {
        const cleared = (0, secrets_js_1.clearSecret)("HF_TOKEN");
        (0, output_js_1.emit)({ cleared });
        return 0;
    },
};
(0, registry_js_1.register)(set);
(0, registry_js_1.register)(status);
(0, registry_js_1.register)(clear);
