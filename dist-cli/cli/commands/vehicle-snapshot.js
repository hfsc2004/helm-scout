"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const output_js_1 = require("../output.js");
const registry_js_1 = require("../registry.js");
const schema_js_1 = require("../../core/schema.js");
const registry = __importStar(require("../../core/vehicles/registry.js"));
const adapter = __importStar(require("../../core/vehicles/ground-skidsteer.js"));
const cp = __importStar(require("../../core/control-plane/client.js"));
const vehicle_contract_js_1 = require("../../shared/vehicle-contract.js");
/**
 * Pull a single JPEG snapshot from a vehicle's camera sidecar.
 *
 * Two paths:
 *
 * 1. If a Helm Scout process is running, its loopback control plane is
 *    advertised in <dataDir>/control-plane.json. We GET
 *    /v1/vehicles/<id>/snapshot from it — the UI's main process already
 *    has the one upstream connection to the camera open, and serves us
 *    a frame out of its shared cache. Both the live UI and this CLI see
 *    the same camera, on the same single connection. The response header
 *    `x-helm-snapshot-source` is "cache" when it came from a live MJPEG
 *    stream, "direct" when the main process had to issue its own
 *    /capture (no stream was open).
 *
 * 2. Otherwise — Helm Scout isn't running — we hit the camera's /capture
 *    endpoint directly. Same behavior as before the control plane.
 *
 * NOTE: most ESP32-S3 camera firmwares are single-threaded HTTP. Option (2)
 * will block while a /stream client is active on the same camera. Option
 * (1) doesn't have that problem because everything goes through the one
 * connection the main process holds.
 *
 * Default: writes the JPEG to `<cwd>/<slug>-<iso-timestamp>.jpg` and emits a
 * structured handle on stdout so an agent gets a path + size + content-type
 * without scraping stderr.
 *
 * Flags:
 *   --out <path>        write the JPEG to a specific path
 *   --base64            emit { base64, bytes, contentType } instead of writing
 *   --stdout            pipe the raw JPEG bytes to stdout, no JSON wrapping
 *   --no-bridge         skip the control plane; always hit /capture directly
 *   --no-telemetry      skip the paired /telemetry fetch (default: included)
 *
 * Why telemetry is on by default:
 *   An LLM driver looking at a frame almost always wants to know whether
 *   the collision guard would block a forward command, what the IR
 *   distances say about peripheral obstacles, etc. Pairing both in one
 *   call means the agent doesn't have to issue a separate request and
 *   reason about whether the two were taken at the same moment. Humans
 *   reading the JPEG directly can pass --no-telemetry to skip the cost.
 */
function slugify(name) {
    return (name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "vehicle");
}
function timestamp() {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace(/Z$/, "Z");
}
function isoNow() {
    return new Date().toISOString();
}
const vehicleSnapshot = {
    def: {
        name: "vehicle-snapshot",
        summary: "Fetch one JPEG frame from a vehicle's camera sidecar and either write it to disk, emit it as base64, or stream it on stdout.",
        args: [
            {
                name: "id",
                kind: "string",
                required: true,
                description: "Vehicle id (from vehicle-list) or vehicle name.",
            },
        ],
        flags: [
            {
                name: "out",
                kind: "string",
                description: "Path to write the JPEG. Default: <cwd>/<slug>-<iso-ts>.jpg. Ignored when --base64 or --stdout is set.",
            },
            {
                name: "base64",
                kind: "boolean",
                default: false,
                description: "Emit { base64, bytes, contentType } on stdout instead of writing a file.",
            },
            {
                name: "stdout",
                kind: "boolean",
                default: false,
                description: "Pipe the raw JPEG bytes to stdout. No JSON wrapping. Use with shell redirection.",
            },
            {
                name: "timeout-ms",
                kind: "number",
                default: 5000,
                description: "HTTP timeout for the snapshot fetch.",
            },
            {
                name: "no-bridge",
                kind: "boolean",
                default: false,
                description: "Skip the running Helm Scout's loopback control plane; always hit /capture directly.",
            },
            {
                name: "no-telemetry",
                kind: "boolean",
                default: false,
                description: "Skip the paired /telemetry fetch. Telemetry is included by default so an LLM driver gets IR distances + guard state alongside the frame.",
            },
        ],
        streams: false,
        events: [],
        exitCodes: {
            0: schema_js_1.COMMON_EXIT_CODES[0],
            1: schema_js_1.COMMON_EXIT_CODES[1],
            2: schema_js_1.COMMON_EXIT_CODES[2],
            64: schema_js_1.COMMON_EXIT_CODES[64],
        },
    },
    async run({ args, flags }) {
        const idOrName = String(args["id"] ?? "").trim();
        if (!idOrName) {
            (0, output_js_1.emit)({ error: "vehicle-snapshot requires <id>." });
            return 64;
        }
        const vehicle = registry.get(idOrName) ?? registry.findByName(idOrName);
        if (!vehicle) {
            (0, output_js_1.emit)({ error: `No vehicle with id or name ${idOrName}.` });
            return 1;
        }
        if (!vehicle.camera) {
            (0, output_js_1.emit)({
                error: `Vehicle ${vehicle.name} has no camera sidecar configured. Attach one with: helm vehicle-camera-set ${vehicle.id} http://<host>:<port>`,
            });
            return 1;
        }
        const base = vehicle.camera.baseUrl.replace(/\/$/, "");
        const path = vehicle.camera.snapshotPath ?? "/capture";
        const url = `${base}${path}`;
        const timeoutMs = Math.max(100, Number(flags["timeout-ms"] ?? 5000));
        const wantStdout = flags["stdout"] === true || flags["stdout"] === "true";
        const wantBase64 = flags["base64"] === true || flags["base64"] === "true";
        const skipBridge = flags["no-bridge"] === true || flags["no-bridge"] === "true";
        const skipTelemetry = flags["no-telemetry"] === true || flags["no-telemetry"] === "true";
        // Kick off the telemetry fetch in parallel with the snapshot so the
        // paired data costs us a single round-trip's worth of latency, not two.
        // Best-effort: if the drive board is slow or unreachable, we surface
        // the failure inline but never block the camera grab.
        const telemetryPromise = skipTelemetry || !(0, vehicle_contract_js_1.hasDriveControl)(vehicle)
            ? null
            : adapter
                .getState(vehicle, { timeoutMs })
                .then((data) => data
                ? { ok: true, data: data }
                : { ok: false, error: "drive board returned no telemetry body" })
                .catch((err) => ({
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            }));
        let bytes;
        let contentType;
        let source = "direct";
        // Prefer the running Helm Scout's loopback control plane if it answers.
        const bridgeDesc = skipBridge ? null : await cp.probe(500);
        if (bridgeDesc) {
            try {
                const remote = await cp.snapshot(bridgeDesc, vehicle.id, timeoutMs);
                bytes = remote.bytes;
                contentType = remote.contentType;
                source = remote.source;
            }
            catch (err) {
                (0, output_js_1.emit)({
                    ok: false,
                    error: `control plane snapshot failed: ${err instanceof Error ? err.message : String(err)}`,
                });
                return 2;
            }
        }
        else {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, { method: "GET", signal: controller.signal });
                if (res.status < 200 || res.status >= 300) {
                    (0, output_js_1.emit)({
                        ok: false,
                        error: `Camera returned HTTP ${res.status} at ${url}`,
                        httpStatus: res.status,
                        url,
                    });
                    return 2;
                }
                contentType = res.headers.get("content-type") ?? "application/octet-stream";
                const arrayBuf = await res.arrayBuffer();
                bytes = Buffer.from(arrayBuf);
            }
            catch (err) {
                (0, output_js_1.emit)({
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                    url,
                });
                return 2;
            }
            finally {
                clearTimeout(timer);
            }
        }
        // Resolve telemetry now (it was kicked off in parallel with the snapshot
        // so the wait is usually instant). Always returns an object; the agent
        // can branch on telemetry.ok to know whether to trust the values.
        const telemetry = telemetryPromise ? await telemetryPromise : null;
        if (wantStdout) {
            // Pipe raw bytes — no JSON wrapping. Status (and telemetry, if any)
            // goes to stderr so an agent redirecting stdout still sees what
            // happened and gets the proximity data.
            process.stdout.write(bytes);
            (0, output_js_1.log)(`vehicle-snapshot: ${bytes.length} bytes (${contentType}, source=${source})`);
            if (telemetry?.ok && telemetry.data) {
                (0, output_js_1.log)(`telemetry: ${JSON.stringify(telemetry.data)}`);
            }
            else if (telemetry && !telemetry.ok) {
                (0, output_js_1.log)(`telemetry-failed: ${telemetry.error ?? "unknown"}`);
            }
            return 0;
        }
        if (wantBase64) {
            (0, output_js_1.emit)({
                ok: true,
                vehicleId: vehicle.id,
                vehicleName: vehicle.name,
                url,
                bytes: bytes.length,
                contentType,
                capturedAt: isoNow(),
                source,
                base64: bytes.toString("base64"),
                telemetry,
            });
            return 0;
        }
        // Default: write to disk.
        const explicitOut = String(flags["out"] ?? "").trim();
        const outPath = explicitOut
            ? (0, node_path_1.isAbsolute)(explicitOut)
                ? explicitOut
                : (0, node_path_1.resolve)(process.cwd(), explicitOut)
            : (0, node_path_1.join)(process.cwd(), `${slugify(vehicle.name)}-${timestamp()}.jpg`);
        try {
            (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(outPath), { recursive: true });
            (0, node_fs_1.writeFileSync)(outPath, bytes);
        }
        catch (err) {
            (0, output_js_1.emit)({
                ok: false,
                error: `Saved snapshot fetch but failed to write ${outPath}: ${err instanceof Error ? err.message : String(err)}`,
                url,
                bytes: bytes.length,
            });
            return 2;
        }
        (0, output_js_1.emit)({
            ok: true,
            vehicleId: vehicle.id,
            vehicleName: vehicle.name,
            url,
            path: outPath,
            bytes: bytes.length,
            contentType,
            capturedAt: isoNow(),
            source,
            telemetry,
        });
        return 0;
    },
};
(0, registry_js_1.register)(vehicleSnapshot);
