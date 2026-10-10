"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const wide_tof_js_1 = require("./wide-tof.js");
const vehicle = {
    sensorBoardRevision: "1.3", camera: { baseUrl: "http://sensor.local:81" },
};
const originalFetch = globalThis.fetch;
(0, node_test_1.afterEach)(() => { globalThis.fetch = originalFetch; });
(0, node_test_1.test)("Fast requests 4×4 profile at 60 Hz through the diagnostic port", async () => {
    globalThis.fetch = async (input, options) => {
        strict_1.default.equal(String(input), "http://sensor.local:82/wide-tof-config?profile=fast&hz=60");
        strict_1.default.equal(options?.method, "POST");
        return Response.json({ ok: true, ready: false, profile: "fast", profileControlVersion: 1, resolution: 16, frequencyHz: 60 });
    };
    const result = await (0, wide_tof_js_1.configureWideTof)(vehicle, "fast", undefined, 60);
    strict_1.default.equal(result.ok, true);
    strict_1.default.equal(result.resolution, 16);
    strict_1.default.equal(result.ready, false);
});
(0, node_test_1.test)("profile frequency bounds reject incompatible rates before any request", async () => {
    globalThis.fetch = async () => { throw new Error("must not contact board"); };
    for (const [profile, hz] of [["fast", 61], ["fast", 29], ["navigation", 16], ["idle", 3], ["detail", 5], ["inspect", 4], ["fast", 30.5]]) {
        const result = await (0, wide_tof_js_1.configureWideTof)(vehicle, profile, undefined, hz);
        strict_1.default.equal(result.ok, false);
        strict_1.default.match(result.error, /profile range/);
    }
});
(0, node_test_1.test)("status uses GET and preserves autonomous idle metadata", async () => {
    globalThis.fetch = async (input, options) => {
        strict_1.default.equal(String(input), "http://sensor.local:82/wide-tof-config");
        strict_1.default.equal(options?.method, "GET");
        return Response.json({ ok: true, ready: true, profile: "idle", profileControlVersion: 1,
            resolution: 16, frequencyHz: 2, rangingMode: "autonomous", integrationMs: 5 });
    };
    const result = await (0, wide_tof_js_1.configureWideTof)(vehicle);
    strict_1.default.equal(result.rangingMode, "autonomous");
    strict_1.default.equal(result.integrationMs, 5);
});
(0, node_test_1.test)("old firmware returns an actionable upgrade message even for plain-text 404", async () => {
    globalThis.fetch = async () => new Response("Not found", { status: 404 });
    strict_1.default.match((await (0, wide_tof_js_1.configureWideTof)(vehicle, "detail")).error, /Update.*firmware/);
});
(0, node_test_1.test)("a failed switch does not become an acknowledged profile", async () => {
    globalThis.fetch = async () => Response.json({ ok: false, error: "profile change failed" }, { status: 503 });
    strict_1.default.equal((await (0, wide_tof_js_1.configureWideTof)(vehicle, "fast")).ok, false);
    globalThis.fetch = async () => Response.json({ ok: true, ready: true, resolution: 64,
        profile: "detail", profileControlVersion: 1, frequencyHz: 10 });
    strict_1.default.equal((await (0, wide_tof_js_1.configureWideTof)(vehicle, "fast")).ok, false);
});
(0, node_test_1.test)("frame size must match advertised resolution", async () => {
    globalThis.fetch = async () => Response.json({ ok: true, ready: true, resolution: 16,
        rawDistanceMm: Array(64).fill(250), targetStatus: Array(64).fill(5) });
    strict_1.default.equal((await (0, wide_tof_js_1.readWideTof)(vehicle)).ok, false);
});
(0, node_test_1.test)("16-zone and legacy 64-zone frames retain their actual dimensions", async () => {
    for (const resolution of [16, 64]) {
        globalThis.fetch = async () => Response.json({ ok: true, ready: true,
            ...(resolution === 16 ? { resolution } : {}),
            ageMs: 120, rawDistanceMm: Array(resolution).fill(500), targetStatus: Array(resolution).fill(5) });
        const result = await (0, wide_tof_js_1.readWideTof)(vehicle);
        strict_1.default.equal(result.ok, true);
        strict_1.default.equal(result.rawDistanceMm.length, resolution);
    }
});
(0, node_test_1.test)("a waiting frame after switching is accepted without old distance arrays", async () => {
    globalThis.fetch = async () => Response.json({ ok: true, ready: false, resolution: 16, profile: "fast" }, { status: 202 });
    const result = await (0, wide_tof_js_1.readWideTof)(vehicle);
    strict_1.default.equal(result.ok, true);
    strict_1.default.equal(result.rawDistanceMm, undefined);
});
(0, node_test_1.test)("Inspect frames expose diagnostic arrays and use an explicit base URL", async () => {
    globalThis.fetch = async (input) => {
        strict_1.default.equal(String(input), "http://bench.local:8082/wide-range");
        return Response.json({ ok: true, ready: true, resolution: 64, profile: "inspect",
            rawDistanceMm: Array(64).fill(300), targetStatus: Array(64).fill(9),
            signalKcpsPerSpad: Array(64).fill(42), ambientKcpsPerSpad: Array(64).fill(7), targetCount: Array(64).fill(1) });
    };
    const result = await (0, wide_tof_js_1.readWideTof)(vehicle, "http://bench.local:8082");
    strict_1.default.equal(result.signalKcpsPerSpad[0], 42);
    strict_1.default.equal(result.ambientKcpsPerSpad[0], 7);
});
