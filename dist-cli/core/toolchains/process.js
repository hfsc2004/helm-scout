"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommandAsync = runCommandAsync;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_child_process_1 = require("node:child_process");
function runCommandAsync(bin, args = [], options = {}) {
    return new Promise((resolve) => {
        const startedAt = Date.now();
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let child;
        try {
            child = (0, node_child_process_1.spawn)(bin, args, {
                env: options.env ?? process.env,
                cwd: options.cwd,
                stdio: ["ignore", "pipe", "pipe"],
            });
            options.onProcess?.(child);
        }
        catch (err) {
            resolve({
                bin,
                args,
                status: null,
                signal: null,
                stdout: "",
                stderr: "",
                durationMs: 0,
                error: err instanceof Error ? err.message : String(err),
            });
            return;
        }
        const timer = options.timeoutMs && options.timeoutMs > 0
            ? setTimeout(() => {
                timedOut = true;
                try {
                    child.kill("SIGKILL");
                }
                catch {
                    // already gone
                }
            }, options.timeoutMs)
            : null;
        child.stdout?.on("data", (chunk) => {
            const s = chunk.toString();
            stdout += s;
            options.onStdout?.(s);
        });
        child.stderr?.on("data", (chunk) => {
            const s = chunk.toString();
            stderr += s;
            options.onStderr?.(s);
        });
        child.on("error", (err) => {
            if (timer)
                clearTimeout(timer);
            resolve({
                bin,
                args,
                status: null,
                signal: null,
                stdout,
                stderr,
                durationMs: Date.now() - startedAt,
                error: err.message,
                timedOut,
            });
        });
        child.on("exit", (code, signal) => {
            if (timer)
                clearTimeout(timer);
            resolve({
                bin,
                args,
                status: code,
                signal,
                stdout,
                stderr,
                durationMs: Date.now() - startedAt,
                ...(timedOut ? { timedOut: true, error: "timeout" } : {}),
            });
        });
    });
}
