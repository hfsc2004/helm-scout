"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Introspectable command schema.
 *
 * The CLI registers each subcommand into this schema at startup. `helm describe`
 * emits the schema as JSON so agents can discover the entire surface without
 * scraping --help text.
 *
 * Both the CLI and the schema-emission share one source of truth: the
 * CommandDef objects below.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMON_EXIT_CODES = exports.GLOBAL_FLAGS = void 0;
exports.GLOBAL_FLAGS = [
    {
        name: "json",
        kind: "boolean",
        default: true,
        description: "Emit machine-readable JSON output (default).",
    },
    {
        name: "pretty",
        kind: "boolean",
        default: false,
        description: "Emit human-readable output instead of JSON.",
    },
    {
        name: "timeout",
        kind: "number",
        description: "Bound execution time in milliseconds. Streams stop when exceeded.",
    },
    {
        name: "trace-id",
        kind: "string",
        description: "Correlation ID for grouping related commands across invocations.",
    },
    {
        name: "dry-run",
        kind: "boolean",
        default: false,
        description: "Emit the plan but do not execute mutating actions.",
    },
];
exports.COMMON_EXIT_CODES = {
    0: "success",
    1: "command-level failure (validation, vehicle rejected action)",
    2: "transport failure (vehicle unreachable)",
    3: "safety abort (deadman, STOP, or guard tripped)",
    64: "usage error (bad arguments)",
};
