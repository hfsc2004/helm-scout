"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
// ---------------------------------------------------------------------------
// Channel name constants — single source of truth for both sides.
// ---------------------------------------------------------------------------
exports.IPC = {
    app: {
        getVersion: "app:get-version",
    },
    lights: { list: "lights:list", get: "lights:get", save: "lights:save", remove: "lights:remove", editor: "lights:editor", play: "lights:play", stop: "lights:stop", status: "lights:status" },
    audio: { list: "audio:list", add: "audio:add", remove: "audio:remove", play: "audio:play" },
    vehicle: {
        list: "vehicle:list",
        add: "vehicle:add",
        remove: "vehicle:remove",
        setCamera: "vehicle:set-camera",
        setAudio: "vehicle:set-audio",
        setSensorBoard: "vehicle:set-sensor-board",
        setDrive: "vehicle:set-drive",
        setWifi: "vehicle:set-wifi",
        setFlashConfig: "vehicle:set-flash-config",
        cameraStreamOpen: "vehicle:camera-stream-open",
        cameraStreamClose: "vehicle:camera-stream-close",
        cameraSnapshot: "vehicle:camera-snapshot",
        cmd: "vehicle:cmd",
        stop: "vehicle:stop",
        sensorBoardSnapshot: "vehicle:sensor-board-snapshot",
        sensorBoardWideConfigure: "vehicle:sensor-board-wide-configure",
        sensorBoardWideSnapshot: "vehicle:sensor-board-wide-snapshot",
        sensorBoardUno: "vehicle:sensor-board-uno",
        streamStateOpen: "vehicle:stream-state-open",
        streamStateClose: "vehicle:stream-state-close",
        /** Per-stream event channel template; actual channel = streamEventPrefix + streamId */
        streamEventPrefix: "vehicle:stream-event:",
        driveOpen: "vehicle:drive-open",
        driveClose: "vehicle:drive-close",
        driveEventPrefix: "vehicle:drive-event:",
    },
    serial: {
        list: "serial:list",
    },
    wifi: {
        scan: "wifi:scan",
    },
    hardware: {
        detect: "hardware:detect",
    },
    ollama: {
        status: "ollama:status",
    },
    flash: {
        listTemplates: "flash:list-templates",
        start: "flash:start",
        cancel: "flash:cancel",
        eventPrefix: "flash:event:",
    },
};
