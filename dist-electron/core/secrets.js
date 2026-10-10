"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
exports.setSecret = setSecret;
exports.clearSecret = clearSecret;
exports.hasSecret = hasSecret;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
/**
 * Secret storage backed by a .env file in the project root.
 *
 * Why .env: the Node convention developers expect. The file is git-ignored
 * (see .gitignore) and never logged. We don't ship to OS keychain in v0.1
 * — that's a cross-platform engineering effort better suited to its own
 * polish branch later.
 *
 * Rules:
 *   - File mode 0600 on write. Never world-readable.
 *   - Values are never logged, never echoed in command output, never
 *     emitted in JSON output unless the caller explicitly asked for a
 *     "status" view that returns presence only.
 *   - Read on demand, not cached at startup. Token rotation works without
 *     restarting Helm Scout.
 */
const ENV_PATH = (0, node_path_1.join)(process.cwd(), ".env");
function readDotenv() {
    if (!(0, node_fs_1.existsSync)(ENV_PATH))
        return {};
    const text = (0, node_fs_1.readFileSync)(ENV_PATH, "utf8");
    const out = {};
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#"))
            continue;
        const eq = line.indexOf("=");
        if (eq < 0)
            continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}
function writeDotenv(values) {
    const lines = [];
    lines.push("# Helm Scout local secrets. Do not commit. (Already in .gitignore.)");
    lines.push("");
    for (const [k, v] of Object.entries(values)) {
        lines.push(`${k}=${v}`);
    }
    (0, node_fs_1.writeFileSync)(ENV_PATH, lines.join("\n") + "\n", { encoding: "utf8" });
    try {
        (0, node_fs_1.chmodSync)(ENV_PATH, 0o600);
    }
    catch {
        // Filesystem may not support chmod (e.g. Windows on some FS); the
        // gitignore is the primary safeguard.
    }
}
function getSecret(key) {
    const env = readDotenv();
    const v = env[key];
    return v && v.length > 0 ? v : null;
}
function setSecret(key, value) {
    const env = readDotenv();
    env[key] = value;
    writeDotenv(env);
}
function clearSecret(key) {
    const env = readDotenv();
    if (env[key] === undefined)
        return false;
    delete env[key];
    writeDotenv(env);
    return true;
}
function hasSecret(key) {
    return getSecret(key) !== null;
}
