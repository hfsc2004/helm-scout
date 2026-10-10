"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Client-side bindings for the loopback control plane (see ./server.ts).
 *
 * The standalone `helm` CLI uses this to ask a running Helm Scout for a frame
 * out of its shared camera-stream cache, so the CLI and the live UI don't
 * fight over the camera firmware's single HTTP slot.
 *
 * Liveness check: even if control-plane.json exists, the Helm Scout may have
 * died ungracefully. We always probe /v1/health (short timeout) before
 * relying on the descriptor.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDescriptor = readDescriptor;
exports.clearDescriptor = clearDescriptor;
exports.probe = probe;
exports.snapshot = snapshot;
const node_fs_1 = require("node:fs");
const paths_js_1 = require("../paths.js");
function readDescriptor() {
    const path = paths_js_1.paths.controlPlane();
    if (!(0, node_fs_1.existsSync)(path))
        return null;
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(path, "utf8"));
        if (parsed.version !== 1 ||
            typeof parsed.port !== "number" ||
            typeof parsed.token !== "string") {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
function clearDescriptor() {
    try {
        (0, node_fs_1.rmSync)(paths_js_1.paths.controlPlane(), { force: true });
    }
    catch {
        // best-effort
    }
}
function baseUrl(desc) {
    return `http://${desc.host}:${desc.port}`;
}
async function timedFetch(url, init, timeoutMs) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: ac.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Returns the descriptor if a running Helm Scout's control plane answers
 * /v1/health within `timeoutMs`. Returns null on any failure (file
 * missing, port stale, wrong token, network error). Stale descriptor
 * files are removed so future invocations skip the probe entirely.
 */
async function probe(timeoutMs = 500) {
    const desc = readDescriptor();
    if (!desc)
        return null;
    try {
        const res = await timedFetch(`${baseUrl(desc)}/v1/health`, { headers: { authorization: `Bearer ${desc.token}` } }, timeoutMs);
        if (!res.ok) {
            clearDescriptor();
            return null;
        }
        return desc;
    }
    catch {
        clearDescriptor();
        return null;
    }
}
async function snapshot(desc, vehicleIdOrName, timeoutMs) {
    const url = `${baseUrl(desc)}/v1/vehicles/${encodeURIComponent(vehicleIdOrName)}/snapshot?timeoutMs=${timeoutMs}`;
    const res = await timedFetch(url, { headers: { authorization: `Bearer ${desc.token}` } }, timeoutMs + 2000 // give the server its own timeout budget plus a little
    );
    if (!res.ok) {
        let detail = "";
        try {
            const body = (await res.json());
            detail = body.error ? `: ${body.error}` : "";
        }
        catch {
            // body wasn't JSON
        }
        throw new Error(`control plane returned HTTP ${res.status}${detail}`);
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const source = res.headers.get("x-helm-snapshot-source") ?? "direct";
    const capturedAt = Number(res.headers.get("x-helm-captured-at") ?? Date.now());
    const vehicleId = res.headers.get("x-helm-vehicle-id") ?? undefined;
    const vehicleName = res.headers.get("x-helm-vehicle-name") ?? undefined;
    const bytes = Buffer.from(await res.arrayBuffer());
    return { bytes, contentType, source, capturedAt, vehicleId, vehicleName };
}
