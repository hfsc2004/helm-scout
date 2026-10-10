"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapForOllama = wrapForOllama;
exports.listModels = listModels;
exports.removeModel = removeModel;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const env_js_1 = require("./env.js");
function sha256OfFile(path) {
    return new Promise((resolve, reject) => {
        const hash = (0, node_crypto_1.createHash)("sha256");
        const stream = (0, node_fs_1.createReadStream)(path);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
}
async function uploadBlob(digest, filePath, totalBytes, onProgress, stage = "blob-main") {
    const url = `http://127.0.0.1:${env_js_1.HELM_OLLAMA_PORT}/api/blobs/sha256:${digest}`;
    let bytesUploaded = 0;
    // Build a stream that reports progress to the caller.
    const fileStream = (0, node_fs_1.createReadStream)(filePath);
    const reader = new ReadableStream({
        start(controller) {
            fileStream.on("data", (chunk) => {
                bytesUploaded += chunk.length;
                onProgress?.({
                    stage,
                    message: "uploading blob",
                    bytesUploaded,
                    totalBytes,
                });
                controller.enqueue(chunk);
            });
            fileStream.on("end", () => controller.close());
            fileStream.on("error", (err) => controller.error(err));
        },
    });
    const res = await fetch(url, {
        method: "POST",
        body: reader,
        // @ts-expect-error Node's fetch requires this when sending a stream body.
        duplex: "half",
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama blob upload failed (${res.status}): ${body || res.statusText}`);
    }
}
async function createModel(opts) {
    const requestBody = {
        model: opts.name,
        files: { [opts.mainFilename]: opts.mainDigest },
    };
    if (opts.projectorDigest && opts.projectorFilename) {
        requestBody["adapters"] = { [opts.projectorFilename]: opts.projectorDigest };
    }
    if (opts.forceCpu) {
        requestBody["modelfile"] = `FROM @${opts.mainDigest}\nPARAMETER num_gpu 0`;
    }
    const url = `http://127.0.0.1:${env_js_1.HELM_OLLAMA_PORT}/api/create`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama model creation failed (${res.status}): ${body || res.statusText}`);
    }
    // Drain the streaming create response and bail loudly on any error line.
    const text = await res.text();
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed.error === "string" && parsed.error.trim()) {
                throw new Error(`Ollama create stream error: ${parsed.error.trim()}`);
            }
        }
        catch {
            // Ignore non-JSON lines (Ollama mixes JSON and plain text on this endpoint).
        }
    }
}
async function wrapForOllama(opts) {
    const onProgress = opts.onProgress;
    const totalBytes = (0, node_fs_1.statSync)(opts.ggufPath).size;
    onProgress?.({ stage: "digest", message: "computing SHA-256" });
    const mainDigest = await sha256OfFile(opts.ggufPath);
    onProgress?.({ stage: "blob-main", message: "uploading main blob", totalBytes });
    await uploadBlob(mainDigest, opts.ggufPath, totalBytes, onProgress, "blob-main");
    let projectorDigest;
    let projectorFilename;
    if (opts.projectorPath) {
        const projectorBytes = (0, node_fs_1.statSync)(opts.projectorPath).size;
        onProgress?.({
            stage: "blob-projector",
            message: "uploading vision projector blob",
            totalBytes: projectorBytes,
        });
        projectorDigest = await sha256OfFile(opts.projectorPath);
        await uploadBlob(projectorDigest, opts.projectorPath, projectorBytes, onProgress, "blob-projector");
        projectorFilename = opts.projectorPath.split("/").pop() ?? "mmproj.gguf";
    }
    onProgress?.({ stage: "create", message: "registering model with Ollama" });
    const mainFilename = opts.ggufPath.split("/").pop() ?? "model.gguf";
    await createModel({
        name: opts.modelName,
        mainDigest,
        mainFilename,
        projectorDigest,
        projectorFilename,
        forceCpu: opts.forceCpu,
    });
    onProgress?.({ stage: "complete", message: `registered as ${opts.modelName}` });
    return {
        modelName: opts.modelName,
        mainDigest,
        projectorDigest,
        hasVision: !!projectorDigest,
    };
}
/**
 * List models currently registered with Helm Scout's private Ollama.
 */
async function listModels() {
    const url = `http://127.0.0.1:${env_js_1.HELM_OLLAMA_PORT}/api/tags`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Ollama list failed: HTTP ${res.status}`);
    }
    const parsed = (await res.json());
    return parsed.models ?? [];
}
/**
 * Remove a model from Helm Scout's private Ollama.
 */
async function removeModel(name) {
    const url = `http://127.0.0.1:${env_js_1.HELM_OLLAMA_PORT}/api/delete`;
    const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: name }),
    });
    if (!res.ok) {
        throw new Error(`Ollama remove failed: HTTP ${res.status}`);
    }
}
