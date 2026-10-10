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
exports.registerAudioHandlers = registerAudioHandlers;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const electron_1 = require("electron");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const paths_js_1 = require("../../core/paths.js");
const registry = __importStar(require("../../core/vehicles/registry.js"));
const speaker_js_1 = require("../../core/vehicles/speaker.js");
const ipc_channels_js_1 = require("../../shared/ipc-channels.js");
const manifest = (0, node_path_1.join)(paths_js_1.paths.data, "audio-library.json");
const supported = /\.(wav|mp3|ogg|flac|m4a|aac)$/i;
function save(entries) {
    (0, node_fs_1.mkdirSync)(paths_js_1.paths.data, { recursive: true });
    (0, node_fs_1.writeFileSync)(manifest + ".tmp", JSON.stringify(entries, null, 2));
    (0, node_fs_1.renameSync)(manifest + ".tmp", manifest);
}
function load() {
    if ((0, node_fs_1.existsSync)(manifest))
        return JSON.parse((0, node_fs_1.readFileSync)(manifest, "utf8"));
    const directory = (0, node_path_1.join)(electron_1.app.getAppPath(), "Sensor_Board_v1.3", "audio");
    const entries = (0, node_fs_1.existsSync)(directory) ? (0, node_fs_1.readdirSync)(directory, { withFileTypes: true })
        .filter(file => file.isFile() && supported.test(file.name))
        .map(file => ({ id: (0, node_crypto_1.randomUUID)(), name: file.name, path: (0, node_path_1.join)(directory, file.name) })) : [];
    save(entries);
    return entries;
}
function publicList(entries) {
    return { entries: entries.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)) };
}
let playing = false;
function registerAudioHandlers() {
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.audio.list, () => publicList(load()));
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.audio.add, async () => {
        const result = await electron_1.dialog.showOpenDialog({ title: "Add audio to library", properties: ["openFile", "multiSelections"],
            filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg", "flac", "m4a", "aac"] }] });
        const entries = load();
        if (!result.canceled) {
            for (const path of result.filePaths) {
                if (supported.test(path) && !entries.some(entry => entry.path === path))
                    entries.push({ id: (0, node_crypto_1.randomUUID)(), name: (0, node_path_1.basename)(path), path });
            }
            save(entries);
        }
        return publicList(entries);
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.audio.remove, (_event, id) => {
        const entries = load().filter(entry => entry.id !== id);
        save(entries); // Library references only: never delete or alter source audio.
        return publicList(entries);
    });
    electron_1.ipcMain.handle(ipc_channels_js_1.IPC.audio.play, async (_event, req) => {
        if (playing)
            throw new Error("Audio is already playing. Wait for it to finish.");
        const vehicle = registry.get(req.vehicleId);
        if (vehicle?.sensorBoardRevision !== "1.3" || !vehicle.camera)
            throw new Error("Select a connected v1.3 sensor-board robot.");
        const entry = load().find(item => item.id === req.audioId);
        if (!entry || !(0, node_fs_1.existsSync)(entry.path))
            throw new Error("Audio file is missing. Remove the entry and add the file again.");
        const endpoint = new URL("/speaker-pcm", vehicle.camera.baseUrl);
        endpoint.port = "82";
        if (endpoint.protocol !== "http:")
            throw new Error("Speaker playback requires HTTP.");
        playing = true;
        try {
            await (0, speaker_js_1.playSpeakerFile)(endpoint, entry.path);
        }
        finally {
            playing = false;
        }
    });
}
