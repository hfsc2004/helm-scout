"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSpeakerEndpoint = resolveSpeakerEndpoint;
exports.playSpeakerFile = playSpeakerFile;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_http_1 = require("node:http");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const promises_1 = require("node:stream/promises");
async function decodeToPcm(source, destination) {
    const ffmpeg = (0, node_child_process_1.spawn)("ffmpeg", [
        "-nostdin", "-v", "error", "-i", source,
        "-f", "s16le", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "2", "-",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let spawnError = null;
    ffmpeg.on("error", (error) => { spawnError = error; });
    const completed = new Promise((resolve) => {
        ffmpeg.once("close", (code) => resolve(code ?? 1));
    });
    ffmpeg.stderr.on("data", (chunk) => { stderr += chunk.toString().slice(0, 2048); });
    try {
        await (0, promises_1.pipeline)(ffmpeg.stdout, (0, node_fs_1.createWriteStream)(destination));
    }
    catch (error) {
        ffmpeg.kill();
        throw error;
    }
    const exitCode = await completed;
    if (spawnError)
        throw spawnError;
    if (exitCode !== 0)
        throw new Error(`ffmpeg could not decode audio: ${stderr.trim() || `exit ${exitCode}`}`);
}
async function streamPcm(url, pcmFile, bytes) {
    const boundary = `helm-speaker-${Date.now().toString(36)}`;
    const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.pcm"\r\n` +
        "Content-Type: application/octet-stream\r\n\r\n");
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    return await new Promise((resolve, reject) => {
        const req = (0, node_http_1.request)(url, {
            method: "POST",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "Content-Length": header.length + bytes + footer.length,
            },
        }, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => {
                let parsed = body;
                try {
                    parsed = JSON.parse(body);
                }
                catch { /* preserve raw error */ }
                if ((res.statusCode ?? 500) >= 400)
                    reject(new Error(`speaker HTTP ${res.statusCode}: ${body}`));
                else
                    resolve(parsed);
            });
            res.on("error", reject);
        });
        req.on("error", reject);
        req.setTimeout(120000, () => req.destroy(new Error("speaker upload timed out")));
        req.write(header);
        const pcm = (0, node_fs_1.createReadStream)(pcmFile);
        pcm.on("error", (error) => req.destroy(error));
        pcm.on("end", () => req.end(footer));
        pcm.pipe(req, { end: false });
    });
}
async function resolveSpeakerEndpoint(endpoint) {
    // Existing boards use diagnostics on 82. Updated boards receive audio on
    // their own core-0 HTTP task, leaving diagnostics and LEDs responsive.
    if (endpoint.port !== "82")
        return endpoint;
    const health = new URL("/health", endpoint);
    health.port = "83";
    try {
        const response = await fetch(health, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
            const info = await response.json();
            if (info.ok && info.service === "psf-speaker") {
                const dedicated = new URL(endpoint);
                dedicated.port = "83";
                return dedicated;
            }
        }
    }
    catch { /* Older firmware has no listener on 83; retain legacy playback. */ }
    return endpoint;
}
async function playSpeakerFile(endpoint, file) {
    const tempDir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "helm-speaker-"));
    const pcmFile = (0, node_path_1.join)(tempDir, "audio.pcm");
    try {
        await decodeToPcm(file, pcmFile);
        const bytes = (0, node_fs_1.statSync)(pcmFile).size;
        if (!bytes || bytes % 4 !== 0)
            throw new Error("Decoded PCM is empty or not stereo-frame aligned.");
        return { pcmBytes: bytes, result: await streamPcm(await resolveSpeakerEndpoint(endpoint), pcmFile, bytes) };
    }
    finally {
        (0, node_fs_1.rmSync)(tempDir, { recursive: true, force: true });
    }
}
