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
exports.flash = flash;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const bmoc = __importStar(require("../bmoc/index.js"));
const paths_js_1 = require("../paths.js");
const process_js_1 = require("../toolchains/process.js");
const index_js_1 = require("../toolchains/arduino-cli/index.js");
const templates_js_1 = require("./templates.js");
const render_js_1 = require("./render.js");
const upload_args_js_1 = require("./upload-args.js");
function jobId() {
    return `flash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function stagingDir(id) {
    return (0, node_path_1.join)(paths_js_1.paths.data, "flash-staging", id);
}
/**
 * Translate arduino-cli's terse failure modes into one-line user-readable
 * causes. Falls back to a sliced stderr when nothing obvious matches.
 */
function diagnoseCoreFailure(stderr, fallbackPrefix) {
    const s = stderr.toLowerCase();
    if (/getaddrinfo|enotfound|econnrefused|network is unreachable|no route to host/.test(s)) {
        return `${fallbackPrefix}: couldn't reach the Arduino index server — check your internet connection`;
    }
    if (/permission denied|eacces|read-?only/.test(s)) {
        return `${fallbackPrefix}: permission denied writing to the arduino-cli data dir`;
    }
    if (/no space left|enospc|disk full/.test(s)) {
        return `${fallbackPrefix}: out of disk space while installing the board core`;
    }
    if (/checksum|verification failed|sha-?256/.test(s)) {
        return `${fallbackPrefix}: download verification failed (partial install) — re-run to retry`;
    }
    return `${fallbackPrefix}: ${stderr.slice(0, 200).trim() || "no stderr output"}`;
}
/**
 * Heuristic: does an arduino-cli compile failure look like "the ESP32 core
 * isn't really installed, even if `core list` showed it"? Triggers an
 * auto-heal reinstall. Strings copied from arduino-cli's own emissions —
 * what we saw on the partial-install case.
 */
function looksLikeMissingPlatform(stderr, core) {
    const s = stderr.toLowerCase();
    const coreLower = core.toLowerCase();
    return (s.includes(`platform ${coreLower} not found`) ||
        s.includes(`${coreLower} not found`) ||
        s.includes("missing platform") ||
        s.includes("platform not installed") ||
        // arduino-cli sometimes emits FQBN-shaped errors instead of core-shaped
        /fqbn .* not found/.test(s) ||
        /unknown fqbn/.test(s));
}
async function ensureCore(bin, baseArgs, env, core, onProgress, 
/** If true, skip the installed-check and force re-install (auto-heal path). */
forceReinstall = false) {
    if (!forceReinstall) {
        // Check if installed.
        const check = await (0, process_js_1.runCommandAsync)(bin, [...baseArgs, "core", "list", "--format", "json"], { env, timeoutMs: 30000 });
        if (check.error || check.status !== 0) {
            return {
                ok: false,
                reason: diagnoseCoreFailure(check.stderr, "arduino-cli core list failed"),
            };
        }
        try {
            const parsed = JSON.parse(check.stdout);
            const cores = parsed.platforms ?? [];
            if (cores.some((c) => c.id === core && c.installed_version)) {
                return { ok: true };
            }
        }
        catch {
            // Older arduino-cli versions returned a different shape; fall through to install.
        }
    }
    onProgress({
        stage: "core-install",
        message: forceReinstall
            ? `reinstalling ${core} core (auto-heal — last compile reported it missing)`
            : `installing ${core} core (one-time, may take several minutes)`,
    });
    // index update + core install
    const update = await (0, process_js_1.runCommandAsync)(bin, [...baseArgs, "core", "update-index"], {
        env,
        timeoutMs: 120000,
        onStderr: (c) => onProgress({ stage: "core-install", message: "index", chunk: c }),
    });
    if (update.error || update.status !== 0) {
        return {
            ok: false,
            reason: diagnoseCoreFailure(update.stderr, "core update-index failed"),
        };
    }
    const install = await (0, process_js_1.runCommandAsync)(bin, [...baseArgs, "core", "install", core], {
        env,
        timeoutMs: 900000, // 15 minutes; the ESP32 core is large
        onStdout: (c) => onProgress({ stage: "core-install", message: "downloading", chunk: c }),
        onStderr: (c) => onProgress({ stage: "core-install", message: "downloading", chunk: c }),
    });
    if (install.error || install.status !== 0) {
        return {
            ok: false,
            reason: diagnoseCoreFailure(install.stderr, `core install ${core} failed`),
        };
    }
    return { ok: true };
}
async function ensureLibraries(bin, baseArgs, env, libraries, onProgress) {
    if (libraries.length === 0)
        return { ok: true };
    const check = await (0, process_js_1.runCommandAsync)(bin, [...baseArgs, "lib", "list", "--format", "json"], { env, timeoutMs: 30000 });
    if (check.error || check.status !== 0) {
        return { ok: false, reason: diagnoseCoreFailure(check.stderr, "arduino-cli lib list failed") };
    }
    let installed;
    try {
        const parsed = JSON.parse(check.stdout);
        installed = parsed.installed_libraries ?? [];
    }
    catch {
        return { ok: false, reason: "arduino-cli lib list returned invalid JSON" };
    }
    for (const library of libraries) {
        if (installed.some((item) => item.library?.name === library.name && item.library.version === library.version))
            continue;
        const spec = `${library.name}@${library.version}`;
        onProgress({ stage: "library-install", message: `installing ${spec}` });
        const result = await (0, process_js_1.runCommandAsync)(bin, [...baseArgs, "lib", "install", spec], {
            env,
            timeoutMs: 180000,
            onStdout: (chunk) => onProgress({ stage: "library-install", message: "downloading", chunk }),
            onStderr: (chunk) => onProgress({ stage: "library-install", message: "downloading", chunk }),
        });
        if (result.error || result.status !== 0) {
            return { ok: false, reason: diagnoseCoreFailure(result.stderr, `lib install ${spec} failed`) };
        }
    }
    return { ok: true };
}
async function flash(req, onProgress, 
/** Optional. If provided, .cancel() will be wired to kill any active
 *  arduino-cli subprocess (compile or upload). */
controller) {
    const startedAt = Date.now();
    // Track the active subprocess so cancellation can kill it. Only one runs
    // at a time (compile, then upload), so a single slot is enough.
    let active = null;
    let cancelled = false;
    if (controller) {
        controller.cancel = () => {
            cancelled = true;
            const target = active;
            if (target) {
                try {
                    target.kill();
                }
                catch {
                    // already dead
                }
            }
        };
    }
    const boardLabel = req.board ? ` [${req.board} board]` : "";
    onProgress({
        stage: "prepare",
        message: `loading template ${req.templateId}${boardLabel}`,
    });
    const tmpl = (0, templates_js_1.loadTemplate)(req.templateId);
    if (!tmpl) {
        onProgress({ stage: "error", message: `template not found: ${req.templateId}` });
        return { ok: false, reason: "template not found" };
    }
    const fqbn = req.fqbnOverride && req.fqbnOverride.trim()
        ? req.fqbnOverride.trim()
        : tmpl.manifest.fqbn;
    if (req.eraseBeforeUpload && !fqbn.startsWith("esp32:esp32:")) {
        const reason = "Erase before Flash is supported only for Espressif ESP32 boards.";
        onProgress({ stage: "error", message: reason, reason });
        return { ok: false, reason };
    }
    onProgress({ stage: "render", message: "applying template variables" });
    const rendered = (0, render_js_1.renderSketch)(tmpl, req.vars);
    if (!rendered.ok) {
        onProgress({ stage: "error", message: rendered.errors.join("; ") });
        return { ok: false, reason: rendered.errors.join("; ") };
    }
    const id = jobId();
    const dir = stagingDir(id);
    // arduino-cli requires the sketch dir name to match the .ino filename.
    const sketchDir = (0, node_path_1.join)(dir, req.templateId);
    (0, node_fs_1.mkdirSync)(sketchDir, { recursive: true });
    const sketchPath = (0, node_path_1.join)(sketchDir, `${req.templateId}.ino`);
    (0, node_fs_1.writeFileSync)(sketchPath, rendered.sketch, "utf8");
    for (const filename of tmpl.manifest.sketchFiles ?? []) {
        if ((0, node_path_1.basename)(filename) !== filename || filename === "." || filename === "..") {
            onProgress({ stage: "error", message: `invalid sketch file name: ${filename}` });
            return { ok: false, reason: `invalid sketch file name: ${filename}` };
        }
        try {
            (0, node_fs_1.copyFileSync)((0, node_path_1.join)(tmpl.dir, filename), (0, node_path_1.join)(sketchDir, filename));
        }
        catch (error) {
            const reason = `could not stage sketch file ${filename}: ${String(error)}`;
            onProgress({ stage: "error", message: reason });
            return { ok: false, reason };
        }
    }
    // Arduino compiles source files recursively beneath a sketch's src/ folder.
    // Keep large, template-local drivers there rather than flattening their
    // source trees into sketchFiles or mutating the user's global libraries.
    const templateSrc = (0, node_path_1.join)(tmpl.dir, "src");
    if ((0, node_fs_1.existsSync)(templateSrc)) {
        try {
            (0, node_fs_1.cpSync)(templateSrc, (0, node_path_1.join)(sketchDir, "src"), { recursive: true });
        }
        catch (error) {
            const reason = `could not stage template src: ${String(error)}`;
            onProgress({ stage: "error", message: reason });
            return { ok: false, reason };
        }
    }
    if (req.dryRun) {
        onProgress({
            stage: "complete",
            message: "dry-run: sketch written, not flashed",
            ok: true,
            fqbn,
            sketchPath,
            durationMs: Date.now() - startedAt,
        });
        return { ok: true, sketchPath };
    }
    onProgress({ stage: "resolve-toolchain", message: "resolving arduino-cli" });
    const cli = await (0, index_js_1.resolveArduinoCli)();
    if (!cli) {
        const reason = "arduino-cli not installed. Run: helm toolchain-install --target arduino-cli --confirm";
        onProgress({ stage: "error", message: reason, reason });
        return { ok: false, reason };
    }
    // Make sure the right core is installed.
    const coreResult = await ensureCore(cli.bin, cli.baseArgs, cli.env, tmpl.manifest.core, onProgress);
    if (!coreResult.ok) {
        onProgress({ stage: "error", message: coreResult.reason ?? "core install failed" });
        return { ok: false, reason: coreResult.reason };
    }
    const libraryResult = await ensureLibraries(cli.bin, cli.baseArgs, cli.env, tmpl.manifest.libraries ?? [], onProgress);
    if (!libraryResult.ok) {
        onProgress({ stage: "error", message: libraryResult.reason ?? "library install failed" });
        return { ok: false, reason: libraryResult.reason };
    }
    // Compile.
    // If the first compile fails with a "platform not found" style error
    // (rare — usually means a partial install: `core list` saw it but the
    // actual files are gone or corrupted), we run ensureCore() once more
    // with forceReinstall, then retry the compile a single time. Anything
    // beyond that is a real bug and we surface the error to the user.
    const compileArgs = [...cli.baseArgs, "compile", "--fqbn", fqbn];
    for (const prop of req.buildProperties ?? []) {
        compileArgs.push("--build-property", prop);
    }
    compileArgs.push(sketchDir);
    const runCompile = async (attempt) => {
        onProgress({
            stage: "compile",
            message: attempt === 1
                ? `arduino-cli compile (${fqbn})`
                : `arduino-cli compile retry after auto-heal (${fqbn})`,
        });
        const session = bmoc.registerSession({
            type: "arduino-compile",
            pid: undefined,
            sketchPath,
            fqbn,
        });
        const result = await (0, process_js_1.runCommandAsync)(cli.bin, compileArgs, {
            env: cli.env,
            timeoutMs: 600000,
            onStdout: (c) => onProgress({ stage: "compile", message: "stdout", chunk: c }),
            onStderr: (c) => onProgress({ stage: "compile", message: "stderr", chunk: c }),
            onProcess: (child) => {
                active = { kill: () => child.kill("SIGKILL") };
            },
        });
        active = null;
        try {
            await bmoc.closeSession(session);
        }
        catch {
            // session may already be torn down; that's fine
        }
        return result;
    };
    let compile = await runCompile(1);
    if (!cancelled &&
        (compile.error || compile.status !== 0) &&
        looksLikeMissingPlatform(compile.stderr, tmpl.manifest.core)) {
        onProgress({
            stage: "core-install",
            message: `[auto-heal] compile reported missing ${tmpl.manifest.core} — reinstalling and retrying`,
        });
        const heal = await ensureCore(cli.bin, cli.baseArgs, cli.env, tmpl.manifest.core, onProgress, true);
        if (heal.ok) {
            compile = await runCompile(2);
        }
        else {
            onProgress({
                stage: "compile",
                message: `[auto-heal failed] ${heal.reason ?? "core reinstall failed"}`,
            });
        }
    }
    if (compile.error || compile.status !== 0) {
        const reason = cancelled
            ? "cancelled"
            : compile.error ?? compile.stderr.slice(0, 400) ?? "compile failed";
        onProgress({ stage: "error", message: cancelled ? "cancelled" : "compile failed", reason });
        return { ok: false, reason };
    }
    // Upload.
    onProgress({ stage: "upload", message: `arduino-cli upload to ${req.port}` });
    const uploadSession = bmoc.registerSession({
        type: "arduino-upload",
        pid: undefined,
        sketchPath,
        fqbn,
        serialPort: req.port,
    });
    const uploadArgs = (0, upload_args_js_1.buildUploadArgs)(cli.baseArgs, fqbn, req.port, sketchDir, req.eraseBeforeUpload);
    const upload = await (0, process_js_1.runCommandAsync)(cli.bin, uploadArgs, {
        env: cli.env,
        timeoutMs: 300000,
        onStdout: (c) => onProgress({ stage: "upload", message: "stdout", chunk: c }),
        onStderr: (c) => onProgress({ stage: "upload", message: "stderr", chunk: c }),
        onProcess: (child) => {
            active = { kill: () => child.kill("SIGKILL") };
        },
    });
    active = null;
    try {
        await bmoc.closeSession(uploadSession);
    }
    catch {
        // ditto
    }
    if (upload.error || upload.status !== 0) {
        const reason = cancelled
            ? "cancelled"
            : upload.error ?? upload.stderr.slice(0, 400) ?? "upload failed";
        onProgress({ stage: "error", message: cancelled ? "cancelled" : "upload failed", reason });
        return { ok: false, reason };
    }
    // Optional post-upload serial capture (lets the user see the first-boot
    // output — IP acquired, sensor init, etc.). Best-effort: if arduino-cli
    // monitor isn't supported on this version, we just skip.
    const captureMs = req.captureRuntimeSerialMs ?? 0;
    if (captureMs > 0) {
        const baud = req.monitorBaudRate ?? 115200;
        onProgress({
            stage: "upload",
            message: `capturing serial output for ${Math.round(captureMs / 1000)}s @ ${baud}`,
        });
        const monitorArgs = [
            ...cli.baseArgs,
            "monitor",
            "--port",
            req.port,
            "--config",
            `baudrate=${baud}`,
        ];
        let killed = false;
        const killTimer = setTimeout(() => {
            killed = true;
            const target = active;
            if (target) {
                try {
                    target.kill();
                }
                catch {
                    // already dead
                }
            }
        }, captureMs);
        try {
            await (0, process_js_1.runCommandAsync)(cli.bin, monitorArgs, {
                env: cli.env,
                timeoutMs: captureMs + 5000,
                onStdout: (c) => onProgress({ stage: "upload", message: "serial", chunk: c }),
                onStderr: (c) => onProgress({ stage: "upload", message: "serial-err", chunk: c }),
                onProcess: (child) => {
                    active = { kill: () => child.kill("SIGKILL") };
                },
            });
        }
        finally {
            clearTimeout(killTimer);
            active = null;
            if (!killed) {
                // arduino-cli monitor exited on its own (probably unsupported); fine.
            }
        }
    }
    onProgress({
        stage: "complete",
        message: "flashed",
        ok: true,
        fqbn,
        port: req.port,
        sketchPath,
        durationMs: Date.now() - startedAt,
    });
    return { ok: true, sketchPath };
}
