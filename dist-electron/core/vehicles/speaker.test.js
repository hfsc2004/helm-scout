"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const speaker_js_1 = require("./speaker.js");
const originalFetch = globalThis.fetch;
(0, node_test_1.afterEach)(() => { globalThis.fetch = originalFetch; });
(0, node_test_1.test)("updated firmware routes audio to its own server without mutating the diagnostics URL", async () => {
    const endpoint = new URL("http://sensor.test:82/speaker-pcm");
    globalThis.fetch = async (input) => {
        strict_1.default.equal(String(input), "http://sensor.test:83/health");
        return Response.json({ ok: true, service: "psf-speaker" });
    };
    strict_1.default.equal(String(await (0, speaker_js_1.resolveSpeakerEndpoint)(endpoint)), "http://sensor.test:83/speaker-pcm");
    strict_1.default.equal(endpoint.port, "82");
});
(0, node_test_1.test)("older firmware and unrelated services keep legacy playback", async () => {
    const endpoint = new URL("http://sensor.test:82/speaker-pcm");
    globalThis.fetch = async () => new Response("Not found", { status: 404 });
    strict_1.default.equal(await (0, speaker_js_1.resolveSpeakerEndpoint)(endpoint), endpoint);
    globalThis.fetch = async () => { throw new Error("ECONNREFUSED"); };
    strict_1.default.equal(await (0, speaker_js_1.resolveSpeakerEndpoint)(endpoint), endpoint);
    globalThis.fetch = async () => Response.json({ ok: true, service: "unrelated" });
    strict_1.default.equal(await (0, speaker_js_1.resolveSpeakerEndpoint)(endpoint), endpoint);
});
(0, node_test_1.test)("explicit custom speaker ports bypass discovery", async () => {
    globalThis.fetch = async () => { throw new Error("Must not probe custom endpoints"); };
    const endpoint = new URL("http://sensor.test:9000/speaker-pcm");
    strict_1.default.equal(await (0, speaker_js_1.resolveSpeakerEndpoint)(endpoint), endpoint);
});
