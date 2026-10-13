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
exports.registerIpcHandlers = registerIpcHandlers;
const lights_js_1 = require("./lights.js");
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const audio_js_1 = require("./audio.js");
const electron_1 = require("electron");
const ipc_channels_js_1 = require("../../shared/ipc-channels.js");
const vehicle_contract_js_1 = require("../../shared/vehicle-contract.js");
const registry = __importStar(require("../../core/vehicles/registry.js"));
const adapter = __importStar(require("../../core/vehicles/ground-skidsteer.js"));
const cameraStream = __importStar(require("../../core/vehicles/camera-stream.js"));
const wide_tof_js_1 = require("../../core/vehicles/wide-tof.js");
const ollamaManager = __importStar(require("../../core/llm/ollama/manager.js"));
const planner_js_1 = require("../../core/llm/planner.js");
const index_js_1 = require("../../core/serial/index.js");
const scan_js_1 = require("../../core/wifi/scan.js");
const index_js_2 = require("../../core/hardware/index.js");
const index_js_3 = require("../../core/firmware-flash/index.js");
const subscriptions_js_1 = require("./subscriptions.js");
/**
 * IPC registration. Plain Electron — the dispatch is whatever Electron does.
 *
 * Long-lived streams open through openSubscription(), which registers them
 * with BMOC so shutdown reaps them. One-shot calls do not need that.
 */
function registerIpcHandlers(opts) {
    (0, audio_js_1.registerAudioHandlers)();
    (0, lights_js_1.registerLightHandlers)();
    // ---------- app ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.app.getVersion, async () => opts.version);
    // ---------- vehicle (one-shot) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.list, async () => {
        return { vehicles: registry.list() };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.add, async (_e, req) => {
        try {
            const v = registry.add({
                name: req.name,
                host: req.host,
                port: req.port,
                kind: req.kind,
                cameraOnly: req.cameraOnly,
            });
            return { ok: true, vehicle: v };
        }
        catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.remove, async (_e, req) => {
        const removed = registry.remove(req.vehicleId);
        return removed
            ? { ok: true }
            : { ok: false, error: `no vehicle ${req.vehicleId}` };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.setCamera, async (_e, req) => {
        const updated = registry.setCamera(req.vehicleId, req.camera);
        return updated
            ? { ok: true, vehicle: updated }
            : { ok: false, error: `no vehicle ${req.vehicleId}` };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.setAudio, async (_e, req) => {
        const updated = registry.setAudio(req.vehicleId, req.audio);
        return updated
            ? { ok: true, vehicle: updated }
            : { ok: false, error: `no vehicle ${req.vehicleId}` };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.setSensorBoard, async (_e, req) => {
        try {
            const updated = registry.setSensorBoardRevision(req.vehicleId, req.revision);
            return updated
                ? { ok: true, vehicle: updated }
                : { ok: false, error: `no vehicle ${req.vehicleId}` };
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.setDrive, async (_e, req) => {
        const updated = registry.setDrive(req.vehicleId, req.drive);
        return updated
            ? { ok: true, vehicle: updated }
            : { ok: false, error: `no vehicle ${req.vehicleId}` };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.setWifi, async (_e, req) => {
        const updated = registry.setWifi(req.vehicleId, req.board, req.wifi);
        return updated
            ? { ok: true, vehicle: updated }
            : { ok: false, error: `no vehicle ${req.vehicleId}` };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.setFlashConfig, async (_e, req) => {
        const updated = req.board === "drive"
            ? registry.setFlash(req.vehicleId, "drive", req.flash)
            : registry.setFlash(req.vehicleId, "video", req.flash);
        return updated
            ? { ok: true, vehicle: updated }
            : { ok: false, error: `no vehicle ${req.vehicleId}` };
    });
    // ---------- camera stream cache ----------
    //
    // Renderer holds a long-lived handle for the lifetime of the Drive view.
    // Other in-process consumers (CLI helpers, future planner) acquire
    // additional handles. The first acquire opens one upstream connection
    // to /stream; subsequent acquires share it. The Elegoo / esp32-camera
    // firmware can only serve one HTTP client at a time, so this is the
    // only safe pattern.
    const cameraConsumers = new Map();
    function consumerId() {
        return `cam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.cameraStreamOpen, async (event, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle)
            throw new Error(`no vehicle ${req.vehicleId}`);
        const handle = cameraStream.acquire(vehicle);
        if (!handle)
            throw new Error(`vehicle ${req.vehicleId} has no camera configured`);
        const id = consumerId();
        cameraConsumers.set(id, { vehicleId: vehicle.id, release: () => handle.release() });
        // Auto-release if the renderer window closes without telling us.
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.once("closed", () => {
                const entry = cameraConsumers.get(id);
                if (entry) {
                    cameraConsumers.delete(id);
                    void entry.release().catch(() => undefined);
                }
            });
        }
        return { consumerId: id, vehicleId: req.vehicleId };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.cameraStreamClose, async (_e, consumerIdArg) => {
        const entry = cameraConsumers.get(consumerIdArg);
        if (!entry)
            return { closed: false };
        cameraConsumers.delete(consumerIdArg);
        await entry.release();
        return { closed: true };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.cameraSnapshot, async (_e, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle)
            return { ok: false, error: `no vehicle ${req.vehicleId}` };
        if (!vehicle.camera) {
            return { ok: false, error: "vehicle has no camera sidecar configured" };
        }
        const timeoutMs = Math.max(100, req.timeoutMs ?? 8000);
        // Preferred path: the renderer already has a stream open. Reuse it.
        if (cameraStream.isStalled(vehicle.id)) {
            cameraStream.invalidate(vehicle.id);
            return { ok: false, error: "camera stream stalled; reconnect required" };
        }
        const existing = cameraStream.peek(vehicle.id);
        if (existing) {
            const handle = cameraStream.acquire(vehicle);
            if (!handle) {
                return { ok: false, error: "failed to acquire camera stream handle" };
            }
            try {
                const frame = await handle.waitForFirstFrame(timeoutMs);
                return {
                    ok: true,
                    base64: Buffer.from(frame.bytes).toString("base64"),
                    bytes: frame.bytes.length,
                    contentType: frame.contentType,
                    capturedAt: frame.capturedAt,
                    source: "cache",
                };
            }
            catch {
                // The renderer owns a long-lived stream handle. Let it reconnect
                // rather than opening /capture while the old stream is unwinding.
                cameraStream.invalidate(vehicle.id);
                return { ok: false, error: "camera stream failed; reconnect required" };
            }
            finally {
                await handle.release();
            }
        }
        // An upstream stream can end before the renderer releases its handle.
        // A direct capture here would compete with its pending reconnect.
        if ([...cameraConsumers.values()].some((consumer) => consumer.vehicleId === vehicle.id)) {
            return { ok: false, error: "camera stream ended; reconnect required" };
        }
        // Fallback: nothing's holding the stream right now (no Drive view
        // open). Hit /capture directly. Same code path that the standalone
        // CLI uses when no main process is around.
        const base = vehicle.camera.baseUrl.replace(/\/$/, "");
        const path = vehicle.camera.snapshotPath ?? "/capture";
        const url = `${base}${path}`;
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), timeoutMs);
        try {
            const res = await fetch(url, { method: "GET", signal: ac.signal });
            if (!res.ok) {
                return { ok: false, error: `camera returned HTTP ${res.status} at ${url}` };
            }
            const contentType = res.headers.get("content-type") ?? "image/jpeg";
            const buf = Buffer.from(await res.arrayBuffer());
            return {
                ok: true,
                base64: buf.toString("base64"),
                bytes: buf.length,
                contentType,
                capturedAt: Date.now(),
                source: "direct",
            };
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
        finally {
            clearTimeout(timer);
        }
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.cmd, async (_e, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle)
            return { ok: false, error: `no vehicle ${req.vehicleId}` };
        if (!(0, vehicle_contract_js_1.hasDriveControl)(vehicle))
            return { ok: false, error: "no drive endpoint configured for this vehicle" };
        try {
            const ack = await adapter.sendCommand(vehicle, req.action);
            return { ok: ack.ok, ack };
        }
        catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.stop, async (_e, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle)
            return { ok: false, error: `no vehicle ${req.vehicleId}` };
        if (!(0, vehicle_contract_js_1.hasDriveControl)(vehicle))
            return { ok: true, ack: { ok: true } };
        try {
            const ack = await adapter.emergencyStop(vehicle);
            return { ok: ack.ok, ack };
        }
        catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });
    // Sensor Board v1.3 diagnostics live on port 82 of the camera board.
    // A one-shot IPC call lets the Drive view poll only while it is visible.
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.sensorBoardSnapshot, async (_e, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle || vehicle.sensorBoardRevision !== "1.3" || !vehicle.camera) {
            return { ranges: null, imu: null, wide: null, rssi: null, error: "v1.3 sensor board camera is not configured" };
        }
        const base = new URL(vehicle.camera.baseUrl);
        base.port = "82";
        const read = async (path) => {
            const url = new URL(path, base);
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
                return response.ok ? await response.json() : null;
            }
            catch {
                return null;
            }
        };
        // Keep requests sequential: the board also serves the live camera feed.
        const ranges = await read("/ranges");
        const imu = await read("/imu");
        const wide = req.includeWide === false ? null : await read("/wide-range");
        return {
            ranges,
            imu,
            wide,
            rssi: typeof ranges?.rssi === "number" ? ranges.rssi : null,
            ...(!ranges && !imu && !wide ? { error: "sensor diagnostics unreachable on port 82" } : {}),
        };
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.sensorBoardWideConfigure, async (_e, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle)
            return { ok: false, ready: false, error: "Vehicle not found." };
        try {
            if (!req.profile)
                return { ok: false, ready: false, error: "A profile is required." };
            return await (0, wide_tof_js_1.configureWideTof)(vehicle, req.profile, undefined, req.hz);
        }
        catch (error) {
            return { ok: false, ready: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.sensorBoardWideSnapshot, async (_e, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle)
            return { ok: false, ready: false, error: "Vehicle not found." };
        try {
            return await (0, wide_tof_js_1.readWideTof)(vehicle);
        }
        catch (error) {
            return { ok: false, ready: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.sensorBoardUno, async (_e, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle || vehicle.sensorBoardRevision !== "1.3" || !vehicle.camera) {
            return { ok: false, error: "v1.3 sensor board camera is not configured" };
        }
        const routes = {
            status: "/uno/status", ultrasonic: "/uno/ultrasonic", line: "/uno/line",
            servo: "/uno/servo", motor: "/uno/motor-pulse", drive: "/uno/drive",
            stop: "/uno/stop", "drive-stop": "/uno/drive-stop",
            "rgb-off": "/uno/rgb-off", baud: "/uno/baud",
        };
        const route = routes[req.action];
        if (!route)
            return { ok: false, error: "unknown Uno action" };
        const url = new URL(vehicle.camera.baseUrl);
        url.port = "82";
        url.pathname = route;
        url.search = "";
        if (req.action === "motor" || req.action === "drive") {
            if (!["left", "right", "forward", "reverse"].includes(req.direction ?? "") ||
                !Number.isInteger(req.speed) || req.speed < 0 || req.speed > 160 ||
                !Number.isInteger(req.ms) || req.ms < 100 || req.ms > 800) {
                return { ok: false, error: "motor requires direction, speed 0..160, and duration 100..800 ms" };
            }
            url.searchParams.set("direction", req.direction);
            url.searchParams.set("speed", String(req.speed));
            url.searchParams.set("ms", String(req.ms));
        }
        else if (req.action === "servo") {
            const channel = req.channel ?? 1;
            const minimum = channel === 2 ? 30 : 10;
            const maximum = channel === 2 ? 110 : 170;
            if (![1, 2].includes(channel) || !Number.isInteger(req.angle) || req.angle < minimum || req.angle > maximum) {
                return { ok: false, error: "servo 1 requires 10..170 degrees; servo 2 requires 30..110 degrees" };
            }
            url.searchParams.set("angle", String(req.angle));
            url.searchParams.set("channel", String(channel));
        }
        else if (req.action === "baud") {
            if (![9600, 19200, 38400, 57600, 115200].includes(req.baud ?? 0)) {
                return { ok: false, error: "unsupported baud" };
            }
            url.searchParams.set("baud", String(req.baud));
        }
        try {
            if (req.action === "servo") {
                const status = await fetch(new URL("/uno/status", url), { signal: AbortSignal.timeout(2500) });
                const statusBody = await status.json();
                if (!status.ok || statusBody.servoCommandVersion !== 2) {
                    return { ok: false, error: "servo command requires updated ESP32-S3 firmware" };
                }
            }
            const method = ["status", "ultrasonic", "line"].includes(req.action) ? "GET" : "POST";
            const response = await fetch(url, { method, signal: AbortSignal.timeout((req.ms ?? 0) + 2500) });
            return await response.json();
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
    // ---------- vehicle state stream (long-lived → BMOC session) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.streamStateOpen, async (event, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle) {
            throw new Error(`no vehicle ${req.vehicleId}`);
        }
        if (!(0, vehicle_contract_js_1.hasDriveControl)(vehicle)) {
            throw new Error("no drive telemetry endpoint configured for this vehicle");
        }
        // Default 2000ms. The drive board is a single-threaded ESP32 — at the
        // old 500ms cadence, telemetry polls competed with /cmd hold-drive
        // pulses (180–250ms) for the firmware's HTTP loop and pushed round-trip
        // times into hundreds of ms. The state readout doesn't need >0.5Hz.
        const intervalMs = Math.max(100, req.intervalMs ?? 2000);
        const senderId = `window-${event.sender.id}`;
        let timer = null;
        const handle = (0, subscriptions_js_1.openSubscription)({
            kind: "state-stream",
            consumerId: senderId,
            metadata: { vehicleId: req.vehicleId, intervalMs },
            closer: () => {
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
            },
        });
        const channel = ipc_channels_js_1.IPC.vehicle.streamEventPrefix + handle.info.streamId;
        const tick = async () => {
            try {
                const state = await adapter.getState(vehicle);
                if (event.sender.isDestroyed()) {
                    await handle.close();
                    return;
                }
                const payload = {
                    streamId: handle.info.streamId,
                    t: Date.now(),
                    state: state,
                };
                event.sender.send(channel, payload);
            }
            catch (err) {
                if (!event.sender.isDestroyed()) {
                    const payload = {
                        streamId: handle.info.streamId,
                        t: Date.now(),
                        state: null,
                        error: err instanceof Error ? err.message : String(err),
                    };
                    event.sender.send(channel, payload);
                }
            }
        };
        // Kick the first reading immediately so the UI doesn't sit blank.
        void tick();
        timer = setInterval(() => void tick(), intervalMs);
        // Tear down when the renderer window goes away.
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.once("closed", () => {
                void handle.close();
            });
        }
        return handle.info;
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.streamStateClose, async (_e, streamId) => {
        await (0, subscriptions_js_1.closeByStreamId)(streamId);
        return { closed: true };
    });
    // ---------- vehicle drive (long-lived → BMOC session) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.driveOpen, async (event, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (!vehicle) {
            throw new Error(`no vehicle ${req.vehicleId}`);
        }
        const senderId = `window-${event.sender.id}`;
        let cancelled = false;
        const handle = (0, subscriptions_js_1.openSubscription)({
            kind: "drive",
            consumerId: senderId,
            metadata: { vehicleId: req.vehicleId, intent: req.intent.slice(0, 80) },
            closer: () => {
                cancelled = true;
            },
        });
        const channel = ipc_channels_js_1.IPC.vehicle.driveEventPrefix + handle.info.streamId;
        const send = (payload) => {
            if (event.sender.isDestroyed())
                return;
            event.sender.send(channel, payload);
        };
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.once("closed", () => {
                void handle.close();
            });
        }
        // Run the lifecycle in the background; resolve the open call immediately
        // so the renderer can start listening.
        void (async () => {
            try {
                const planResult = await (0, planner_js_1.plan)({
                    vehicle,
                    intent: req.intent,
                    model: req.model ?? planner_js_1.DEFAULT_PLANNER_MODEL,
                    temperature: req.temperature ?? 0,
                    retryOnInvalid: !req.noRetry,
                });
                if (cancelled)
                    return;
                if (!planResult.ok) {
                    send({
                        streamId: handle.info.streamId,
                        event: "validate",
                        ok: false,
                        reason: planResult.reason,
                        raw: planResult.raw.slice(0, 500),
                    });
                    send({
                        streamId: handle.info.streamId,
                        event: "complete",
                        ok: false,
                        reason: planResult.reason,
                    });
                    await handle.close();
                    return;
                }
                send({
                    streamId: handle.info.streamId,
                    event: "plan",
                    command: planResult.command,
                    modelUsed: planResult.modelUsed,
                    attempts: planResult.attempts,
                });
                send({ streamId: handle.info.streamId, event: "validate", ok: true });
                if (req.dryRun) {
                    send({
                        streamId: handle.info.streamId,
                        event: "complete",
                        ok: true,
                        dryRun: true,
                    });
                    await handle.close();
                    return;
                }
                send({
                    streamId: handle.info.streamId,
                    event: "execute",
                    command: planResult.command,
                });
                const ack = await adapter.sendCommand(vehicle, planResult.command);
                if (cancelled)
                    return;
                send({
                    streamId: handle.info.streamId,
                    event: "complete",
                    ok: ack.ok,
                    ack,
                });
            }
            catch (err) {
                send({
                    streamId: handle.info.streamId,
                    event: "error",
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            finally {
                await handle.close();
            }
        })();
        return handle.info;
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.vehicle.driveClose, async (_e, streamId) => {
        await (0, subscriptions_js_1.closeByStreamId)(streamId);
        return { closed: true };
    });
    // ---------- serial (one-shot) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.serial.list, async () => {
        return { ports: (0, index_js_1.listSerialPorts)() };
    });
    // ---------- wifi (one-shot scan) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.wifi.scan, async () => {
        return (0, scan_js_1.scan)();
    });
    // ---------- hardware (one-shot) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.hardware.detect, async () => {
        const hw = await (0, index_js_2.detectHardware)(process.cwd());
        const classification = (0, index_js_2.classifyForInference)(hw);
        const nvidiaSelection = classification.accelerationType === "nvidia"
            ? await (0, index_js_2.selectNvidiaGpuAsync)(classification)
            : null;
        return { hardware: hw, classification, nvidiaSelection };
    });
    // ---------- ollama (one-shot) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.ollama.status, async () => {
        return ollamaManager.status();
    });
    // ---------- flash (one-shot: list) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.flash.listTemplates, async () => {
        const templates = (0, index_js_3.listTemplates)().map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            target: t.target,
            fqbn: t.fqbn,
            vehicleKind: t.vehicleKind,
            vars: t.vars.map((v) => ({
                key: v.key,
                type: v.type,
                required: v.required,
                default: v.default,
                label: v.label,
            })),
        }));
        return { templates };
    });
    // ---------- flash (long-lived → BMOC session) ----------
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.flash.start, async (event, req) => {
        const senderId = `window-${event.sender.id}`;
        // Filled in by the flash() call below. The subscription's closer pulls
        // .cancel through this slot so closeByStreamId actually kills the
        // arduino-cli child.
        const controller = { cancel: () => undefined };
        const handle = (0, subscriptions_js_1.openSubscription)({
            kind: "flash",
            consumerId: senderId,
            metadata: {
                templateId: req.templateId,
                port: req.port,
                dryRun: req.dryRun === true,
            },
            closer: () => {
                controller.cancel();
            },
        });
        const channel = ipc_channels_js_1.IPC.flash.eventPrefix + handle.info.streamId;
        const send = (payload) => {
            if (event.sender.isDestroyed())
                return;
            event.sender.send(channel, payload);
        };
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.once("closed", () => {
                void handle.close();
            });
        }
        // Run the flash in the background; resolve the open call immediately so
        // the renderer can attach its listener before the first event fires.
        void (async () => {
            try {
                await (0, index_js_3.flash)({
                    templateId: req.templateId,
                    port: req.port,
                    vars: req.vars,
                    dryRun: req.dryRun === true,
                    board: req.board,
                    fqbnOverride: req.fqbnOverride,
                    buildProperties: req.buildProperties,
                    eraseBeforeUpload: req.eraseBeforeUpload,
                    captureRuntimeSerialMs: req.captureRuntimeSerialMs,
                    monitorBaudRate: req.monitorBaudRate,
                }, (ev) => {
                    send({ streamId: handle.info.streamId, ...ev });
                }, controller);
            }
            catch (err) {
                send({
                    streamId: handle.info.streamId,
                    stage: "error",
                    message: "flash threw",
                    reason: err instanceof Error ? err.message : String(err),
                });
            }
            finally {
                await handle.close();
            }
        })();
        return handle.info;
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.flash.cancel, async (_e, streamId) => {
        await (0, subscriptions_js_1.closeByStreamId)(streamId);
        return { closed: true };
    });
}
