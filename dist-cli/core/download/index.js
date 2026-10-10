"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Download subsystem — TypeScript surface over the verbatim Core-CE modules.
 *
 * The .js files in this directory are imported verbatim from PSF Core. They
 * handle HTTP/HTTPS + wget fallback, HF Bearer auth, SHA-256 checksumming,
 * multi-shard GGUF reassembly, and the HF REST API. Do not modify them.
 *
 * Helm Scout uses these to download model files. The HF token (if present) lives
 * in the project's .env (see core/secrets.ts) and is attached as
 * `Authorization: Bearer <token>` only on requests to huggingface.co.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hf = void 0;
exports.downloadModel = downloadModel;
exports.cancelDownload = cancelDownload;
const secrets_js_1 = require("../secrets.js");
const downloadManager = require("./download-manager.js");
const huggingfaceApi = require("./huggingface-api.js");
async function downloadModel(opts) {
    const token = opts.hfToken ?? (0, secrets_js_1.getSecret)("HF_TOKEN") ?? undefined;
    return downloadManager.downloadModel({ ...opts, hfToken: token });
}
function cancelDownload(id) {
    return downloadManager.cancelDownload(id);
}
exports.hf = {
    fetchModelInfo: huggingfaceApi.fetchModelInfo,
    fetchConfig: huggingfaceApi.fetchConfig,
    fetchFileInfo: huggingfaceApi.fetchFileInfo,
};
