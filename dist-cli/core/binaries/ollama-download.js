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
exports.downloadOllama = downloadOllama;
exports.uninstallOllama = uninstallOllama;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const paths_js_1 = require("../paths.js");
const limits_js_1 = require("../storage/limits.js");
/**
 * Download Helm Scout's private Ollama binary from ollama.com.
 *
 * Linux x64 only for v0.1. macOS and Windows arrive in their own branch.
 *
 * The download is opt-in and one-time per Helm Scout install. The privacy canary
 * acknowledges this destination explicitly.
 */
const LINUX_X64_URL = "https://ollama.com/download/ollama-linux-amd64.tar.zst";
function ensureDir(path) {
    if (!(0, node_fs_1.existsSync)(path))
        (0, node_fs_1.mkdirSync)(path, { recursive: true });
}
async function downloadToFile(url, destPath, onProgress) {
    ensureDir((0, node_path_1.dirname)(destPath));
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Download failed: HTTP ${res.status} from ${url}`);
    }
    const totalBytes = Number(res.headers.get("content-length")) || undefined;
    if (totalBytes && totalBytes > limits_js_1.STORAGE_LIMITS.voiceAssetsBytes) {
        // Reusing the voice cap as a rough sanity ceiling for any single binary
        // download; if Ollama tarballs ever exceed 2 GB something is off.
        throw new Error(`Refusing download: ${totalBytes} bytes exceeds the single-asset ceiling.`);
    }
    if (!res.body) {
        throw new Error("Download failed: no response body.");
    }
    const file = (0, node_fs_1.createWriteStream)(destPath);
    let bytesDownloaded = 0;
    const reader = res.body.getReader();
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        file.write(value);
        bytesDownloaded += value.byteLength;
        onProgress?.({
            stage: "fetch",
            message: "downloading",
            bytesDownloaded,
            totalBytes,
        });
    }
    await new Promise((resolve, reject) => {
        file.end((err) => (err ? reject(err) : resolve()));
    });
}
function runCmd(cmd, args, onProgress, stage = "extract") {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
        child.stderr.on("data", (chunk) => {
            onProgress?.({
                stage,
                message: String(chunk).trim().slice(0, 200),
            });
        });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`${cmd} exited with code ${code}`));
        });
    });
}
/**
 * Download + extract Ollama for Linux x64. Other platforms throw NotImplemented.
 */
async function downloadOllama(onProgress) {
    if (process.platform !== "linux" || process.arch !== "x64") {
        throw new Error(`Ollama install for ${process.platform}-${process.arch} not implemented in this branch. Linux x64 only for v0.1.`);
    }
    const root = paths_js_1.paths.ollamaRoot();
    ensureDir(root);
    const tarballPath = `${root}/ollama-linux-amd64.tar.zst`;
    onProgress?.({ stage: "fetch", message: `fetching ${LINUX_X64_URL}` });
    await downloadToFile(LINUX_X64_URL, tarballPath, onProgress);
    onProgress?.({ stage: "extract", message: "extracting tarball (zstd)" });
    await runCmd("tar", ["--zstd", "-xf", tarballPath, "-C", root], onProgress, "extract");
    onProgress?.({ stage: "verify", message: "verifying binary" });
    const binaryPath = paths_js_1.paths.ollamaBin();
    if (!(0, node_fs_1.existsSync)(binaryPath)) {
        throw new Error(`Extraction completed but binary not at expected path: ${binaryPath}`);
    }
    const stat = (0, node_fs_1.statSync)(binaryPath);
    if (stat.size < 1_000_000) {
        throw new Error(`Binary at ${binaryPath} looks too small: ${stat.size} bytes`);
    }
    ensureDir(paths_js_1.paths.ollamaModels());
    onProgress?.({ stage: "complete", message: "Ollama installed" });
    return { installed: true, bytesUsed: stat.size, binaryPath };
}
/**
 * Remove the entire Helm Scout-private Ollama tree.
 */
async function uninstallOllama() {
    const { rmSync, existsSync: exists, statSync: stat } = await Promise.resolve().then(() => __importStar(require("node:fs")));
    const root = paths_js_1.paths.ollamaRoot();
    if (!exists(root))
        return { removed: false, freedBytes: 0 };
    // Measure before removing.
    const before = await Promise.resolve().then(() => __importStar(require("node:fs"))).then((fs) => {
        function size(d) {
            let t = 0;
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const p = `${d}/${e.name}`;
                if (e.isDirectory())
                    t += size(p);
                else if (e.isFile())
                    t += stat(p).size;
            }
            return t;
        }
        return size(root);
    });
    rmSync(root, { recursive: true, force: true });
    return { removed: true, freedBytes: before };
}
