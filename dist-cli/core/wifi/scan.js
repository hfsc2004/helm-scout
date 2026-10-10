"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNmcli = parseNmcli;
exports.scan = scan;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_os_1 = require("node:os");
const process_js_1 = require("../toolchains/process.js");
/** Linux: NetworkManager via nmcli. Most desktop distros ship it. */
async function scanLinux() {
    const res = await (0, process_js_1.runCommandAsync)("nmcli", ["-t", "-f", "SSID,SIGNAL,SECURITY,FREQ", "device", "wifi", "list"], { timeoutMs: 8000 });
    if (res.error || res.status !== 0) {
        const stderr = (res.stderr || "").toLowerCase();
        if (stderr.includes("not running") || stderr.includes("not authorized")) {
            return {
                ok: false,
                networks: [],
                reason: "NetworkManager isn't running, or this user can't query it",
            };
        }
        if (res.error?.includes("ENOENT")) {
            return {
                ok: false,
                networks: [],
                unsupported: true,
                reason: "nmcli not installed — Helm Scout uses NetworkManager to scan on Linux",
            };
        }
        return {
            ok: false,
            networks: [],
            reason: `nmcli failed: ${(res.stderr || "").slice(0, 200).trim()}`,
        };
    }
    return { ok: true, networks: parseNmcli(res.stdout) };
}
/**
 * nmcli -t (terse) emits one network per line, colon-separated, with any
 * embedded colons in field values backslash-escaped. We honor the escape
 * so an SSID containing ":" doesn't shred our parse.
 */
function parseNmcli(stdout) {
    const out = [];
    const seen = new Set();
    for (const rawLine of stdout.split("\n")) {
        const line = rawLine.trimEnd();
        if (!line)
            continue;
        const fields = splitNmcliLine(line);
        if (fields.length < 4)
            continue;
        const [ssid, signalRaw, security, freqRaw] = fields;
        if (!ssid)
            continue; // hidden network; user can still type SSID manually
        // Dedupe — nmcli sometimes lists the same SSID once per BSSID.
        if (seen.has(ssid))
            continue;
        seen.add(ssid);
        const signal = Number.parseInt(signalRaw, 10);
        const freqMhz = Number.parseInt(freqRaw, 10);
        out.push({
            ssid,
            signal: Number.isFinite(signal) ? signal : null,
            security: security || "OPEN",
            band: bandFromMhz(Number.isFinite(freqMhz) ? freqMhz : null),
        });
    }
    out.sort((a, b) => (b.signal ?? -1) - (a.signal ?? -1));
    return out;
}
function splitNmcliLine(line) {
    const parts = [];
    let buf = "";
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "\\" && i + 1 < line.length) {
            buf += line[i + 1];
            i++;
            continue;
        }
        if (ch === ":") {
            parts.push(buf);
            buf = "";
            continue;
        }
        buf += ch;
    }
    parts.push(buf);
    return parts;
}
function bandFromMhz(mhz) {
    if (mhz === null)
        return null;
    if (mhz >= 2400 && mhz <= 2500)
        return "2.4GHz";
    if (mhz >= 5000 && mhz <= 5900)
        return "5GHz";
    if (mhz >= 5925 && mhz <= 7125)
        return "6GHz";
    return null;
}
async function scan() {
    const os = (0, node_os_1.platform)();
    if (os === "linux")
        return scanLinux();
    if (os === "darwin") {
        return {
            ok: false,
            networks: [],
            unsupported: true,
            reason: "macOS Wi-Fi scan isn't wired yet — type the SSID manually or paste from your menu bar",
        };
    }
    if (os === "win32") {
        return {
            ok: false,
            networks: [],
            unsupported: true,
            reason: "Windows Wi-Fi scan isn't wired yet — type the SSID manually",
        };
    }
    return {
        ok: false,
        networks: [],
        unsupported: true,
        reason: `Wi-Fi scan not implemented for ${os}`,
    };
}
