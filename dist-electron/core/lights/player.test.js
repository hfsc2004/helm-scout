"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const player_js_1 = require("./player.js");
const light_scripts_js_1 = require("../../shared/light-scripts.js");
const originalFetch = globalThis.fetch;
const players = new Set();
const endpoint = new URL("http://sensor.test:82");
function player() { const result = new player_js_1.LightPlayer(); players.add(result); return result; }
function light(target, extra = {}) {
    return { target, mode: "flash", r: 100, g: 0, b: 0, w: 0, flashes: 1, durationMs: 100, ...extra };
}
function show(actions) { return { id: "show", name: "show", lines: [{ actions, durationMs: 100 }] }; }
async function until(condition) {
    const deadline = Date.now() + 3000;
    while (!condition() && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 10));
    strict_1.default.ok(condition(), "Playback did not reach expected state within three seconds");
}
(0, node_test_1.afterEach)(async () => {
    for (const item of players)
        await item.stop();
    players.clear();
    globalThis.fetch = originalFetch;
});
(0, node_test_1.test)("legacy scripts retain colors, flashes and No Action duration", () => {
    const action = light("LED1");
    const old = { id: "old", name: "old", lines: [action, { ...action, target: "No Action", durationMs: 2000 }] };
    const result = (0, light_scripts_js_1.validateLightScript)(old);
    strict_1.default.deepEqual(result.lines[0].actions[0], action);
    strict_1.default.deepEqual(result.lines[1], { actions: [], durationMs: 2000 });
    strict_1.default.throws(() => (0, light_scripts_js_1.validateLightScript)(show([action, action])), /only once/);
});
(0, node_test_1.test)("selected lights start together and retain independent colors and flash counts", async () => {
    const writes = [];
    let release;
    const startBarrier = new Promise(resolve => { release = resolve; });
    let started = 0;
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        writes.push(url);
        if (Number(url.searchParams.get("r")) > 0 && started < 2) {
            if (++started === 2)
                release();
            await startBarrier;
        }
        return Response.json({ ok: true });
    };
    const script = show([light("LED1", { flashes: 2, w: 20 }), light("LED2", { r: 50, w: 100, durationMs: 150 })]);
    const p = player();
    await p.start(script, endpoint);
    await until(() => !p.status().running);
    strict_1.default.equal(p.status().error, "");
    strict_1.default.equal(started, 2);
    strict_1.default.ok(writes.slice(0, 2).every(url => Number(url.searchParams.get("r")) > 0));
    strict_1.default.equal(writes.filter(url => url.searchParams.get("index") === "0" && url.searchParams.get("r") === "100").length, 2);
    strict_1.default.equal(writes.filter(url => url.searchParams.get("index") === "1" && url.searchParams.get("r") === "50").length, 1);
    strict_1.default.equal(writes[0].searchParams.get("w"), "20");
    strict_1.default.equal(writes[1].searchParams.get("w"), "100");
    strict_1.default.equal((0, light_scripts_js_1.lightLineDuration)(script.lines[0]), 400);
});
(0, node_test_1.test)("steady headlights remain on across loop repeats; Stop turns every light off", async () => {
    const writes = [];
    globalThis.fetch = async (input) => { writes.push(new URL(String(input))); return Response.json({ ok: true }); };
    const script = show(["LED1", "LED2", "LED3"].map(target => light(target, { mode: "steady", r: 0, w: 255 })));
    const p = player();
    await p.start(script, endpoint, true);
    await until(() => writes.length >= 9);
    strict_1.default.ok(writes.every(url => url.searchParams.get("w") === "255"));
    strict_1.default.equal(p.status().looping, true);
    await p.stop();
    strict_1.default.equal(p.status().running, false);
    for (const index of [0, 1, 2])
        strict_1.default.equal(writes.filter(url => url.searchParams.get("index") === String(index)).at(-1).searchParams.get("w"), "0");
    const count = writes.length;
    await new Promise(resolve => setTimeout(resolve, 150));
    strict_1.default.equal(writes.length, count);
});
(0, node_test_1.test)("No Action issues no light command and uses its own pause duration", async () => {
    globalThis.fetch = async () => { throw new Error("No Action must not contact the robot"); };
    const p = player();
    const script = { id: "pause", name: "pause", lines: [{ actions: [], durationMs: 100 }] };
    const started = Date.now();
    await p.start(script, endpoint);
    await until(() => !p.status().running);
    strict_1.default.ok(Date.now() - started >= 90);
    strict_1.default.equal(p.status().error, "");
});
(0, node_test_1.test)("looping network failure stops the show and attempts off cleanup", async () => {
    let requests = 0;
    globalThis.fetch = async () => Response.json({ ok: ++requests !== 1 }, { status: requests === 1 ? 503 : 200 });
    const p = player();
    await p.start(show([light("LED1")]), endpoint, true);
    await until(() => !p.status().running);
    strict_1.default.match(p.status().error, /503/);
    strict_1.default.equal(p.status().looping, false);
    strict_1.default.equal(requests, 2);
});
(0, node_test_1.test)("unknown ESP32 GPIOs and missing IR firmware reject before a show starts", async () => {
    let requests = 0;
    globalThis.fetch = async () => { requests++; return new Response("Not found", { status: 404 }); };
    const p = player();
    await strict_1.default.rejects(p.start(show([light("ESP32-LED4")]), endpoint), /GPIO/);
    strict_1.default.equal(requests, 0);
    await strict_1.default.rejects(p.start(show([light("IR")]), endpoint), /firmware/);
    strict_1.default.equal(requests, 1);
    strict_1.default.equal(p.status().running, false);
});
