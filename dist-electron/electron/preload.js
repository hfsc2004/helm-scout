"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const electron_1 = require("electron");
/**
 * Preload runs in a sandboxed context where only `electron` and `node:*`
 * built-ins are importable. Channel names are inlined here rather than
 * imported from shared/ipc-channels.ts (which is the source of truth on
 * both the main and renderer sides). Keep these constants in sync with
 * the IPC export in shared/ipc-channels.ts.
 */
const CH = {
    appGetVersion: "app:get-version",
    vehicleList: "vehicle:list",
    vehicleAdd: "vehicle:add",
    vehicleRemove: "vehicle:remove",
    vehicleSetCamera: "vehicle:set-camera",
    vehicleSetAudio: "vehicle:set-audio",
    vehicleSetSensorBoard: "vehicle:set-sensor-board",
    vehicleSetDrive: "vehicle:set-drive",
    vehicleSetWifi: "vehicle:set-wifi",
    vehicleSetFlashConfig: "vehicle:set-flash-config",
    vehicleCameraStreamOpen: "vehicle:camera-stream-open",
    vehicleCameraStreamClose: "vehicle:camera-stream-close",
    vehicleCameraSnapshot: "vehicle:camera-snapshot",
    vehicleCmd: "vehicle:cmd",
    vehicleStop: "vehicle:stop",
    vehicleSensorBoardSnapshot: "vehicle:sensor-board-snapshot",
    vehicleSensorBoardWideConfigure: "vehicle:sensor-board-wide-configure",
    vehicleSensorBoardWideSnapshot: "vehicle:sensor-board-wide-snapshot",
    vehicleSensorBoardUno: "vehicle:sensor-board-uno",
    vehicleStreamStateOpen: "vehicle:stream-state-open",
    vehicleStreamStateClose: "vehicle:stream-state-close",
    vehicleStreamEventPrefix: "vehicle:stream-event:",
    vehicleDriveOpen: "vehicle:drive-open",
    vehicleDriveClose: "vehicle:drive-close",
    vehicleDriveEventPrefix: "vehicle:drive-event:",
    serialList: "serial:list",
    wifiScan: "wifi:scan",
    hardwareDetect: "hardware:detect",
    ollamaStatus: "ollama:status",
    flashListTemplates: "flash:list-templates",
    flashStart: "flash:start",
    flashCancel: "flash:cancel",
    flashEventPrefix: "flash:event:",
};
const api = {
    lights: {
        list: () => electron_1.ipcRenderer.invoke("lights:list"),
        get: (id) => electron_1.ipcRenderer.invoke("lights:get", id),
        save: (script) => electron_1.ipcRenderer.invoke("lights:save", script),
        remove: (id) => electron_1.ipcRenderer.invoke("lights:remove", id),
        editor: (id) => electron_1.ipcRenderer.invoke("lights:editor", id),
        play: (req) => electron_1.ipcRenderer.invoke("lights:play", req),
        stop: () => electron_1.ipcRenderer.invoke("lights:stop"),
        status: () => electron_1.ipcRenderer.invoke("lights:status"),
    },
    audio: {
        list: () => electron_1.ipcRenderer.invoke("audio:list"),
        add: () => electron_1.ipcRenderer.invoke("audio:add"),
        remove: (id) => electron_1.ipcRenderer.invoke("audio:remove", id),
        play: (req) => electron_1.ipcRenderer.invoke("audio:play", req),
    },
    app: {
        getVersion: () => electron_1.ipcRenderer.invoke(CH.appGetVersion),
    },
    vehicle: {
        list: () => electron_1.ipcRenderer.invoke(CH.vehicleList),
        add: (req) => electron_1.ipcRenderer.invoke(CH.vehicleAdd, req),
        remove: (req) => electron_1.ipcRenderer.invoke(CH.vehicleRemove, req),
        setCamera: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSetCamera, req),
        setAudio: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSetAudio, req),
        setSensorBoard: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSetSensorBoard, req),
        setDrive: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSetDrive, req),
        setWifi: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSetWifi, req),
        setFlashConfig: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSetFlashConfig, req),
        cameraStreamOpen: (req) => electron_1.ipcRenderer.invoke(CH.vehicleCameraStreamOpen, req),
        cameraStreamClose: (consumerId) => electron_1.ipcRenderer.invoke(CH.vehicleCameraStreamClose, consumerId),
        cameraSnapshot: (req) => electron_1.ipcRenderer.invoke(CH.vehicleCameraSnapshot, req),
        cmd: (req) => electron_1.ipcRenderer.invoke(CH.vehicleCmd, req),
        stop: (req) => electron_1.ipcRenderer.invoke(CH.vehicleStop, req),
        sensorBoardSnapshot: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSensorBoardSnapshot, req),
        sensorBoardWideConfigure: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSensorBoardWideConfigure, req),
        sensorBoardWideSnapshot: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSensorBoardWideSnapshot, req),
        sensorBoardUno: (req) => electron_1.ipcRenderer.invoke(CH.vehicleSensorBoardUno, req),
        streamState: async (req, onEvent) => {
            const handle = (await electron_1.ipcRenderer.invoke(CH.vehicleStreamStateOpen, req));
            const channel = CH.vehicleStreamEventPrefix + handle.streamId;
            const listener = (_event, payload) => onEvent(payload);
            electron_1.ipcRenderer.on(channel, listener);
            return {
                handle,
                stop: async () => {
                    electron_1.ipcRenderer.removeListener(channel, listener);
                    await electron_1.ipcRenderer.invoke(CH.vehicleStreamStateClose, handle.streamId);
                },
            };
        },
        drive: async (req, onEvent) => {
            const handle = (await electron_1.ipcRenderer.invoke(CH.vehicleDriveOpen, req));
            const channel = CH.vehicleDriveEventPrefix + handle.streamId;
            const listener = (_event, payload) => onEvent(payload);
            electron_1.ipcRenderer.on(channel, listener);
            return {
                handle,
                stop: async () => {
                    electron_1.ipcRenderer.removeListener(channel, listener);
                    await electron_1.ipcRenderer.invoke(CH.vehicleDriveClose, handle.streamId);
                },
            };
        },
    },
    serial: {
        list: () => electron_1.ipcRenderer.invoke(CH.serialList),
    },
    wifi: {
        scan: () => electron_1.ipcRenderer.invoke(CH.wifiScan),
    },
    hardware: {
        detect: () => electron_1.ipcRenderer.invoke(CH.hardwareDetect),
    },
    ollama: {
        status: () => electron_1.ipcRenderer.invoke(CH.ollamaStatus),
    },
    flash: {
        listTemplates: () => electron_1.ipcRenderer.invoke(CH.flashListTemplates),
        start: async (req, onEvent) => {
            const handle = (await electron_1.ipcRenderer.invoke(CH.flashStart, req));
            const channel = CH.flashEventPrefix + handle.streamId;
            const listener = (_event, payload) => onEvent(payload);
            electron_1.ipcRenderer.on(channel, listener);
            return {
                handle,
                stop: async () => {
                    electron_1.ipcRenderer.removeListener(channel, listener);
                    await electron_1.ipcRenderer.invoke(CH.flashCancel, handle.streamId);
                },
            };
        },
    },
};
electron_1.contextBridge.exposeInMainWorld("helm", api);
