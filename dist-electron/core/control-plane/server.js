"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Local control plane.
 *
 * A tiny HTTP server bound to 127.0.0.1 only — never the LAN. Lets the
 * standalone `helm` CLI (a separate Node process) talk to a running
 * Helm Scout's main process, so cross-process consumers can share the same
 * camera-stream cache, BMOC sessions, and registry view.
 *
 * Auth is a bearer token written into the OS-appropriate data dir (mode
 * 0600). The CLI reads the same file. No network exposure beyond loopback;
 * the token guards against another local user on the same host poking at
 * the endpoint.
 *
 * Started by the Electron main process on ready, stopped on quit, and
 * registered with BMOC so a crash still cleans up the listener.
 */
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
exports.start = start;
exports.stop = stop;
exports.getDescriptor = getDescriptor;
const node_http_1 = require("node:http");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const bmoc = __importStar(require("../bmoc/index.js"));
const paths_js_1 = require("../paths.js");
const registry = __importStar(require("../vehicles/registry.js"));
const cameraStream = __importStar(require("../vehicles/camera-stream.js"));
let server = null;
let descriptor = null;
let sessionId = null;
function writeDescriptor(d) {
    const path = paths_js_1.paths.controlPlane();
    const dir = (0, node_path_1.dirname)(path);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    (0, node_fs_1.writeFileSync)(path, JSON.stringify(d, null, 2), { encoding: "utf8", mode: 0o600 });
    try {
        (0, node_fs_1.chmodSync)(path, 0o600); // defensive — writeFileSync mode is umask-modified on some platforms
    }
    catch {
        // best-effort
    }
}
function removeDescriptor() {
    try {
        (0, node_fs_1.rmSync)(paths_js_1.paths.controlPlane(), { force: true });
    }
    catch {
        // best-effort
    }
}
function authOk(req, token) {
    const header = req.headers.authorization ?? "";
    if (!header.toLowerCase().startsWith("bearer "))
        return false;
    // Constant-time-ish compare. The token is high-entropy, so timing isn't
    // a meaningful attack surface here, but no reason to be sloppy.
    const presented = header.slice(7).trim();
    if (presented.length !== token.length)
        return false;
    let diff = 0;
    for (let i = 0; i < token.length; i++) {
        diff |= presented.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return diff === 0;
}
function json(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(text),
    });
    res.end(text);
}
async function handleSnapshot(res, vehicleId, timeoutMs) {
    const vehicle = registry.get(vehicleId) ?? registry.findByName(vehicleId);
    if (!vehicle) {
        json(res, 404, { ok: false, error: `no vehicle with id or name ${vehicleId}` });
        return;
    }
    if (!vehicle.camera) {
        json(res, 400, {
            ok: false,
            error: `vehicle ${vehicle.name} has no camera sidecar configured`,
        });
        return;
    }
    // Prefer the cached frame from the shared stream when something is
    // already holding /stream open (the Drive view, typically).
    if (cameraStream.isStalled(vehicle.id))
        cameraStream.invalidate(vehicle.id);
    const existing = cameraStream.peek(vehicle.id);
    if (existing) {
        const handle = cameraStream.acquire(vehicle);
        if (!handle) {
            json(res, 500, { ok: false, error: "failed to acquire camera stream handle" });
            return;
        }
        try {
            const frame = await handle.waitForFirstFrame(timeoutMs);
            res.writeHead(200, {
                "content-type": frame.contentType,
                "content-length": frame.bytes.length,
                "x-helm-snapshot-source": "cache",
                "x-helm-captured-at": String(frame.capturedAt),
                "x-helm-vehicle-id": vehicle.id,
                "x-helm-vehicle-name": vehicle.name,
            });
            res.end(Buffer.from(frame.bytes));
            return;
        }
        catch {
            // The stream can fail after the renderer acquires it. Drop the stale
            // connection and try /capture rather than returning its old failure.
            cameraStream.invalidate(vehicle.id);
        }
        finally {
            await handle.release();
        }
    }
    // No stream open — hit /capture directly.
    const base = vehicle.camera.baseUrl.replace(/\/$/, "");
    const path = vehicle.camera.snapshotPath ?? "/capture";
    const url = `${base}${path}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
        const upstream = await fetch(url, { method: "GET", signal: ac.signal });
        if (!upstream.ok) {
            json(res, 502, {
                ok: false,
                error: `camera returned HTTP ${upstream.status} at ${url}`,
            });
            return;
        }
        const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(200, {
            "content-type": contentType,
            "content-length": buf.length,
            "x-helm-snapshot-source": "direct",
            "x-helm-captured-at": String(Date.now()),
            "x-helm-vehicle-id": vehicle.id,
            "x-helm-vehicle-name": vehicle.name,
        });
        res.end(buf);
    }
    catch (err) {
        json(res, 502, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
    finally {
        clearTimeout(timer);
    }
}
function route(req, res, token) {
    // Loopback-only check is enforced by the listen() bind below; refuse
    // anything non-127.0.0.1 just in case a future change to the bind slips.
    const remote = req.socket.remoteAddress ?? "";
    const isLoopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
    if (!isLoopback) {
        json(res, 403, { ok: false, error: "loopback only" });
        return;
    }
    if (!authOk(req, token)) {
        json(res, 401, { ok: false, error: "unauthorized" });
        return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1/health") {
        json(res, 200, { ok: true, pid: process.pid, startedAt: descriptor?.startedAt });
        return;
    }
    // GET /v1/vehicles/:idOrName/snapshot
    const snapMatch = url.pathname.match(/^\/v1\/vehicles\/([^/]+)\/snapshot$/);
    if (req.method === "GET" && snapMatch) {
        const idOrName = decodeURIComponent(snapMatch[1]);
        const timeoutMs = Math.max(100, Math.min(60000, Number(url.searchParams.get("timeoutMs") ?? "8000")));
        void handleSnapshot(res, idOrName, timeoutMs);
        return;
    }
    if (req.method === "GET" && url.pathname === "/v1/vehicles") {
        json(res, 200, { ok: true, vehicles: registry.list() });
        return;
    }
    json(res, 404, { ok: false, error: `no route ${req.method} ${url.pathname}` });
}
/** Start the control plane. Idempotent — calling twice is a no-op. */
async function start() {
    if (descriptor && server)
        return descriptor;
    const token = (0, node_crypto_1.randomBytes)(32).toString("hex");
    const srv = (0, node_http_1.createServer)((req, res) => {
        try {
            route(req, res, token);
        }
        catch (err) {
            json(res, 500, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });
    await new Promise((resolve, reject) => {
        srv.once("error", reject);
        srv.listen({ host: "127.0.0.1", port: 0 }, () => {
            srv.off("error", reject);
            resolve();
        });
    });
    const addr = srv.address();
    if (!addr || typeof addr === "string") {
        srv.close();
        throw new Error("control-plane listen returned no address");
    }
    descriptor = {
        host: "127.0.0.1",
        port: addr.port,
        token,
        pid: process.pid,
        startedAt: Date.now(),
        version: 1,
    };
    writeDescriptor(descriptor);
    sessionId = bmoc.registerSession({
        type: "control-plane",
        pid: process.pid,
        port: addr.port,
    });
    server = srv;
    return descriptor;
}
/** Stop the control plane, remove the descriptor file, close the BMOC session. */
async function stop() {
    const s = server;
    server = null;
    descriptor = null;
    if (s) {
        await new Promise((resolve) => s.close(() => resolve()));
    }
    if (sessionId) {
        const id = sessionId;
        sessionId = null;
        try {
            await bmoc.closeSession(id);
        }
        catch {
            // best-effort
        }
    }
    removeDescriptor();
}
function getDescriptor() {
    return descriptor;
}
