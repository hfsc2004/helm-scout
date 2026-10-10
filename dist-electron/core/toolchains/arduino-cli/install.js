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
exports.installArduinoCli = installArduinoCli;
exports.uninstallArduinoCli = uninstallArduinoCli;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const env_js_1 = require("./env.js");
/**
 * Download arduino-cli for the current platform.
 *
 * Linux x64 only for v0.1; macOS/Windows variants land in their own branch.
 *
 * Source: official downloads.arduino.cc CDN. The latest tarball is fetched
 * (Arduino-CLI publishes a "latest" alias). One outbound destination,
 * acknowledged in the privacy canary.
 */
const LINUX_X64_URL = "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_64bit.tar.gz";
function ensureDir(p) {
    if (!(0, node_fs_1.existsSync)(p))
        (0, node_fs_1.mkdirSync)(p, { recursive: true });
}
async function downloadToFile(url, destPath, onProgress) {
    ensureDir((0, node_path_1.dirname)(destPath));
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
        throw new Error(`Download failed: HTTP ${res.status} from ${url}`);
    }
    const totalBytes = Number(res.headers.get("content-length")) || undefined;
    if (!res.body)
        throw new Error("Download failed: no response body.");
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
function runTar(args) {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)("tar", args, { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (c) => (stderr += c.toString()));
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`tar exited ${code}: ${stderr.slice(0, 200)}`));
        });
    });
}
async function installArduinoCli(onProgress) {
    if (process.platform !== "linux" || process.arch !== "x64") {
        throw new Error(`arduino-cli install for ${process.platform}-${process.arch} not implemented in this branch. Linux x64 only for v0.1.`);
    }
    (0, env_js_1.ensureArduinoCliDirs)();
    const root = env_js_1.arduinoCliPaths.root();
    const tarballPath = (0, node_path_1.join)(root, "arduino-cli_latest_Linux_64bit.tar.gz");
    onProgress?.({ stage: "fetch", message: `fetching ${LINUX_X64_URL}` });
    await downloadToFile(LINUX_X64_URL, tarballPath, onProgress);
    onProgress?.({ stage: "extract", message: "extracting tarball" });
    // Extract to a staging dir, then move just the arduino-cli binary into place.
    const stagingDir = (0, node_path_1.join)(root, ".staging");
    ensureDir(stagingDir);
    await runTar(["-xzf", tarballPath, "-C", stagingDir]);
    const stagedBin = (0, node_path_1.join)(stagingDir, "arduino-cli");
    const finalBin = env_js_1.arduinoCliPaths.bin();
    if (!(0, node_fs_1.existsSync)(stagedBin)) {
        throw new Error(`Expected arduino-cli binary at ${stagedBin} after extract`);
    }
    (0, node_fs_1.renameSync)(stagedBin, finalBin);
    (0, node_fs_1.chmodSync)(finalBin, 0o755);
    onProgress?.({ stage: "verify", message: "verifying binary" });
    onProgress?.({ stage: "complete", message: "arduino-cli installed" });
    return { installed: true, binaryPath: finalBin };
}
async function uninstallArduinoCli() {
    const fs = await Promise.resolve().then(() => __importStar(require("node:fs")));
    const root = env_js_1.arduinoCliPaths.root();
    if (!fs.existsSync(root))
        return { removed: false, freedBytes: 0 };
    const measure = (d) => {
        let t = 0;
        try {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const p = (0, node_path_1.join)(d, e.name);
                if (e.isDirectory())
                    t += measure(p);
                else if (e.isFile())
                    t += fs.statSync(p).size;
            }
        }
        catch {
            // ignore
        }
        return t;
    };
    const before = measure(root);
    fs.rmSync(root, { recursive: true, force: true });
    return { removed: true, freedBytes: before };
}
