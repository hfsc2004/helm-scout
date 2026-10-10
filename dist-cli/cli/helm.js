#!/usr/bin/env node
"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Helm Scout CLI entrypoint.
 *
 * Agent-first surface: structured output, NDJSON streams, distinct exit codes,
 * machine-introspectable schema via `helm describe`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const output_js_1 = require("./output.js");
const registry_js_1 = require("./registry.js");
// Register all commands by importing them. Side-effect import is intentional;
// each module calls `register(...)` at load time.
require("./commands/version.js");
require("./commands/privacy.js");
require("./commands/describe.js");
require("./commands/voice.js");
require("./commands/hardware.js");
require("./commands/vehicle.js");
require("./commands/vehicle-camera.js");
require("./commands/vehicle-snapshot.js");
require("./commands/vehicle-audio.js");
require("./commands/vehicle-speaker.js");
require("./commands/vehicle-mic-clock.js");
require("./commands/vehicle-uno.js");
require("./commands/vehicle-tof-mode.js");
require("./commands/vehicle-wide-tof.js");
require("./commands/vehicle-imu-zero.js");
require("./commands/vehicle-sensor-board.js");
require("./commands/vehicle-drive.js");
require("./commands/vehicle-wifi.js");
require("./commands/vehicle-flash-config.js");
require("./commands/ollama.js");
require("./commands/hf-token.js");
require("./commands/model.js");
require("./commands/drive.js");
require("./commands/serial.js");
require("./commands/wifi.js");
require("./commands/toolchain.js");
require("./commands/flash.js");
const USAGE = `helm <command> [args] [flags]

Run 'helm describe' for the full machine-readable schema.
Run 'helm version' to print the version.
`;
function parseArgs(argv) {
    const args = [];
    const flags = {};
    let command;
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token.startsWith("--")) {
            const eq = token.indexOf("=");
            if (eq > -1) {
                flags[token.slice(2, eq)] = token.slice(eq + 1);
            }
            else {
                const next = argv[i + 1];
                if (next !== undefined && !next.startsWith("--")) {
                    flags[token.slice(2)] = next;
                    i++;
                }
                else {
                    flags[token.slice(2)] = true;
                }
            }
        }
        else if (command === undefined) {
            command = token;
        }
        else {
            args.push(token);
        }
    }
    return { command, args, flags };
}
async function main() {
    const argv = process.argv.slice(2);
    const parsed = parseArgs(argv);
    if (!parsed.command || parsed.command === "help" || parsed.flags["help"] === true) {
        (0, output_js_1.log)(USAGE);
        (0, output_js_1.log)("Available commands:");
        for (const c of (0, registry_js_1.all)()) {
            (0, output_js_1.log)(`  ${c.def.name.padEnd(12)} ${c.def.summary}`);
        }
        process.exit(0);
    }
    const cmd = (0, registry_js_1.get)(parsed.command);
    if (!cmd) {
        (0, output_js_1.fatal)(`Unknown command: ${parsed.command}\n\n${USAGE}`, 64);
    }
    // Map positional args by their declared order in the command definition.
    const args = {};
    cmd.def.args.forEach((argDef, i) => {
        const value = parsed.args[i];
        if (value !== undefined)
            args[argDef.name] = value;
    });
    const exitCode = await cmd.run({ args, flags: parsed.flags });
    process.exit(exitCode);
}
void main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    (0, output_js_1.fatal)(`helm: ${msg}`, 1);
});
