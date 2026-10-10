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
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const electron_1 = require("electron");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const bmoc = __importStar(require("../core/bmoc/index.js"));
const controlPlane = __importStar(require("../core/control-plane/server.js"));
const lights_js_1 = require("./ipc/lights.js");
const index_js_1 = require("./ipc/index.js");
// Keep the existing Electron data directory when setting the display name.
const userDataPath = electron_1.app.getPath("userData");
electron_1.app.setName("Helm Scout");
electron_1.app.setPath("userData", userDataPath);
const isDev = !electron_1.app.isPackaged;
const DEV_URL = "http://localhost:5173";
function readVersion() {
    try {
        const pkg = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, "..", "..", "package.json"), "utf8"));
        return pkg.version ?? "0.0.0";
    }
    catch {
        return "0.0.0";
    }
}
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 960,
        minHeight: 600,
        backgroundColor: "#0f1419",
        title: "Helm Scout",
        webPreferences: {
            preload: (0, node_path_1.join)(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            // Sandbox stays on in packaged builds (defense-in-depth against a
            // compromised renderer), but in dev we want native clipboard paste
            // in DevTools — sandbox blocks the synchronous clipboard path the
            // dev-tools context menu uses. The threat model doesn't apply when
            // the developer is the one typing into their own console.
            sandbox: !isDev,
        },
    });
    if (isDev) {
        void mainWindow.loadURL(DEV_URL);
        if (process.env["HELM_DEVTOOLS"] === "1") {
            mainWindow.webContents.openDevTools({ mode: "detach" });
        }
    }
    else {
        void mainWindow.loadFile((0, node_path_1.join)(__dirname, "../dist/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
void electron_1.app.whenReady().then(async () => {
    // Initialize BMOC first so anything spawned/registered later goes through it.
    bmoc.initialize(__dirname);
    (0, index_js_1.registerIpcHandlers)({ version: readVersion() });
    // Local control plane: bound to 127.0.0.1 only. Lets the standalone
    // `helm` CLI talk to this Helm Scout instance so cross-process consumers
    // (CLI snapshot, future planner calls) share the same camera cache.
    // Failure to start is non-fatal — the UI still works without it.
    try {
        const desc = await controlPlane.start();
        // eslint-disable-next-line no-console
        console.log(`[helm] control plane listening on 127.0.0.1:${desc.port}`);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[helm] control plane failed to start:", err instanceof Error ? err.message : err);
    }
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on("before-quit", async (event) => {
    // Reap every BMOC-tracked session (subscriptions, child processes) before
    // the process exits.
    event.preventDefault();
    await (0, lights_js_1.stopLightShows)();
    try {
        await controlPlane.stop();
    }
    catch {
        // best-effort
    }
    try {
        await bmoc.closeAllSessions();
    }
    catch {
        // Best effort; never block shutdown indefinitely.
    }
    electron_1.app.exit(0);
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
