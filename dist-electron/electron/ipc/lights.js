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
exports.stopLightShows = stopLightShows;
exports.registerLightHandlers = registerLightHandlers;
// SPDX-License-Identifier: Apache-2.0
const electron_1 = require("electron");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const paths_js_1 = require("../../core/paths.js");
const registry = __importStar(require("../../core/vehicles/registry.js"));
const player_js_1 = require("../../core/lights/player.js");
const light_scripts_js_1 = require("../../shared/light-scripts.js");
const ipc_channels_js_1 = require("../../shared/ipc-channels.js");
const manifest = (0, node_path_1.join)(paths_js_1.paths.data, "light-scripts.json");
function load() { return (0, node_fs_1.existsSync)(manifest) ? JSON.parse((0, node_fs_1.readFileSync)(manifest, "utf8")).map(light_scripts_js_1.validateLightScript) : []; }
function save(scripts) {
    (0, node_fs_1.mkdirSync)(paths_js_1.paths.data, { recursive: true });
    (0, node_fs_1.writeFileSync)(manifest + ".tmp", JSON.stringify(scripts, null, 2));
    (0, node_fs_1.renameSync)(manifest + ".tmp", manifest);
}
const player = new player_js_1.LightPlayer();
const editors = new Map();
async function stopLightShows() { await player.stop(); }
function registerLightHandlers() {
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.lights.list, () => load().sort((a, b) => a.name.localeCompare(b.name)));
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.lights.get, (_event, id) => {
        const script = load().find(item => item.id === id);
        if (!script)
            throw new Error("Script no longer exists.");
        return script;
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.lights.save, (_event, value) => {
        const script = (0, light_scripts_js_1.validateLightScript)(value);
        const scripts = load();
        if (scripts.some(item => item.id !== script.id && item.name.toLowerCase() === script.name.toLowerCase()))
            throw new Error("A script with that filename already exists.");
        if (script.id && !scripts.some(item => item.id === script.id))
            throw new Error("Script was deleted. Create a new script to save these lines.");
        script.id ||= (0, node_crypto_1.randomUUID)();
        save([...scripts.filter(item => item.id !== script.id), script]);
        return script;
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.lights.remove, (_event, id) => {
        if (player.status().running && player.status().scriptId === id)
            throw new Error("Stop the show before deleting its script.");
        save(load().filter(item => item.id !== id));
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.lights.editor, (event, id) => {
        const key = id || "new";
        const existing = editors.get(key);
        if (existing && !existing.isDestroyed()) {
            existing.focus();
            return;
        }
        const parent = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        const window = new electron_1.BrowserWindow({ width: 1000, height: 750, minWidth: 760, minHeight: 500, parent,
            title: "LED script editor", backgroundColor: "#0f1419",
            webPreferences: { preload: (0, node_path_1.join)(__dirname, "..", "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
        editors.set(key, window);
        window.on("closed", () => editors.delete(key));
        const hash = "led-editor" + (id ? `?id=${encodeURIComponent(id)}` : "");
        if (!electron_1.app.isPackaged)
            void window.loadURL(`http://localhost:5173/#${hash}`);
        else
            void window.loadFile((0, node_path_1.join)(electron_1.app.getAppPath(), "dist", "index.html"), { hash });
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.lights.play, async (_event, req) => {
        const vehicle = registry.get(req.vehicleId);
        if (vehicle?.sensorBoardRevision !== "1.3" || !vehicle.camera)
            throw new Error("Select a v1.3 sensor-board robot.");
        const script = load().find(item => item.id === req.scriptId);
        if (!script)
            throw new Error("Script no longer exists.");
        const endpoint = new URL(vehicle.camera.baseUrl);
        endpoint.port = "82";
        if (endpoint.protocol !== "http:")
            throw new Error("Light shows require HTTP.");
        await player.start(script, endpoint, req.loop === true);
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.lights.stop, () => player.stop());
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.lights.status, () => player.status());
}
