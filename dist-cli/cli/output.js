"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Output discipline for the CLI.
 *
 * - stdout: JSON or NDJSON events only. Never log noise here.
 * - stderr: human-readable status messages, --pretty rendering, errors.
 *
 * Anything an agent might parse goes to stdout. Anything a human might read
 * but a machine should ignore goes to stderr.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emit = emit;
exports.log = log;
exports.fatal = fatal;
function emit(value) {
    process.stdout.write(JSON.stringify(value) + "\n");
}
function log(message) {
    process.stderr.write(message + "\n");
}
function fatal(message, exitCode) {
    process.stderr.write(message + "\n");
    process.exit(exitCode);
}
