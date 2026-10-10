"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.get = get;
exports.findByName = findByName;
exports.add = add;
exports.remove = remove;
exports.setCamera = setCamera;
exports.setAudio = setAudio;
exports.setSensorBoardRevision = setSensorBoardRevision;
exports.setDrive = setDrive;
exports.setWifi = setWifi;
exports.setFlash = setFlash;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const paths_js_1 = require("../paths.js");
const limits_js_1 = require("../storage/limits.js");
function registryPath() {
    return paths_js_1.paths.registry();
}
function load() {
    const path = registryPath();
    if (!(0, node_fs_1.existsSync)(path)) {
        return { schemaVersion: 1, vehicles: [] };
    }
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(path, "utf8"));
        if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.vehicles)) {
            return { schemaVersion: 1, vehicles: [] };
        }
        // Earlier v1.3 flashes reused a drive-board entry. Keep its old endpoint
        // data for reversibility, but do not advertise unavailable motor APIs.
        for (const vehicle of parsed.vehicles) {
            if (vehicle.sensorBoardRevision === "1.3") {
                vehicle.capabilities = vehicle.capabilities.filter((capability) => capability !== "drive.skidsteer" && capability !== "state.basic");
            }
        }
        return parsed;
    }
    catch {
        // Corrupt file — preserve nothing, return empty registry. The user can
        // reinspect the file on disk if they care to.
        return { schemaVersion: 1, vehicles: [] };
    }
}
function save(file) {
    const path = registryPath();
    const dir = (0, node_path_1.dirname)(path);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    (0, node_fs_1.writeFileSync)(path, JSON.stringify(file, null, 2), "utf8");
}
function mutate(id, fn) {
    const file = load();
    const idx = file.vehicles.findIndex((v) => v.id === id);
    if (idx < 0)
        return null;
    const vehicle = file.vehicles[idx];
    fn(vehicle);
    file.vehicles[idx] = vehicle;
    save(file);
    return vehicle;
}
function list() {
    return load().vehicles;
}
function get(id) {
    return load().vehicles.find((v) => v.id === id) ?? null;
}
function findByName(name) {
    return load().vehicles.find((v) => v.name === name) ?? null;
}
function add(input) {
    if (!input.cameraOnly && !input.host?.trim()) {
        throw new Error("A drive vehicle requires a host.");
    }
    const file = load();
    if (file.vehicles.length >= limits_js_1.STORAGE_LIMITS.registryVehicles) {
        throw new Error(`Registry full: ${limits_js_1.STORAGE_LIMITS.registryVehicles} vehicles maximum. Remove one first.`);
    }
    if (file.vehicles.some((v) => v.name === input.name)) {
        throw new Error(`A vehicle named "${input.name}" already exists.`);
    }
    const vehicle = {
        id: `veh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: input.name,
        kind: input.kind ?? "ground",
        capabilities: input.cameraOnly ? [] : ["drive.skidsteer", "state.basic"],
        ...(input.cameraOnly ? {} : {
            transport: { host: input.host.trim(), port: input.port ?? 8080 },
        }),
        coordinateFrame: "raw",
        lossOfCommsBehavior: "stop",
        addedAt: Date.now(),
    };
    file.vehicles.push(vehicle);
    save(file);
    return vehicle;
}
function remove(id) {
    const file = load();
    const before = file.vehicles.length;
    file.vehicles = file.vehicles.filter((v) => v.id !== id);
    if (file.vehicles.length === before)
        return false;
    save(file);
    return true;
}
function setCamera(id, input) {
    return mutate(id, (vehicle) => {
        if (input === null) {
            delete vehicle.camera;
            vehicle.capabilities = vehicle.capabilities.filter((c) => c !== "camera.mjpeg");
            return;
        }
        vehicle.camera = {
            baseUrl: input.baseUrl,
            streamPath: input.streamPath ?? "/stream",
            snapshotPath: input.snapshotPath ?? "/capture",
            flashStatusPath: input.flashStatusPath ?? "/health",
        };
        if (!vehicle.capabilities.includes("camera.mjpeg")) {
            vehicle.capabilities = [...vehicle.capabilities, "camera.mjpeg"];
        }
    });
}
function setAudio(id, input) {
    return mutate(id, (vehicle) => {
        if (input === null) {
            delete vehicle.audio;
            vehicle.capabilities = vehicle.capabilities.filter((c) => c !== "audio.pcm");
            return;
        }
        vehicle.audio = {
            baseUrl: input.baseUrl,
            streamPath: input.streamPath ?? "/audio",
        };
        if (!vehicle.capabilities.includes("audio.pcm")) {
            vehicle.capabilities = [...vehicle.capabilities, "audio.pcm"];
        }
    });
}
function setSensorBoardRevision(id, revision) {
    if (revision !== null && revision !== "1.1" && revision !== "1.3") {
        throw new Error("Sensor board revision must be 1.1 or 1.3.");
    }
    return mutate(id, (vehicle) => {
        const previous = vehicle.sensorBoardRevision;
        if (revision === null)
            delete vehicle.sensorBoardRevision;
        else
            vehicle.sensorBoardRevision = revision;
        if (revision === "1.3") {
            vehicle.capabilities = vehicle.capabilities.filter((capability) => capability !== "drive.skidsteer" && capability !== "state.basic");
        }
        else if (previous === "1.3" && vehicle.transport) {
            if (!vehicle.capabilities.includes("drive.skidsteer"))
                vehicle.capabilities.push("drive.skidsteer");
            if (!vehicle.capabilities.includes("state.basic"))
                vehicle.capabilities.push("state.basic");
        }
    });
}
// ---------------------------------------------------------------------------
// Dual-board mutators
// ---------------------------------------------------------------------------
function setDrive(id, drive) {
    return mutate(id, (vehicle) => {
        if (drive === null) {
            delete vehicle.drive;
            return;
        }
        const prev = vehicle.drive;
        vehicle.drive = {
            speed: drive.speed ?? prev?.speed ?? 170,
            swapSides: drive.swapSides ?? prev?.swapSides ?? false,
            invertLeft: drive.invertLeft ?? prev?.invertLeft ?? false,
            invertRight: drive.invertRight ?? prev?.invertRight ?? false,
            map: {
                forward: drive.map?.forward ?? prev?.map.forward ?? "fwd",
                reverse: drive.map?.reverse ?? prev?.map.reverse ?? "rev",
                left: drive.map?.left ?? prev?.map.left ?? "turn_left",
                right: drive.map?.right ?? prev?.map.right ?? "turn_right",
            },
            numControlsEnabled: drive.numControlsEnabled ?? prev?.numControlsEnabled ?? true,
            obstacleFrontThreshold: drive.obstacleFrontThreshold ?? prev?.obstacleFrontThreshold ?? 0,
            ...(drive.aiDrive || prev?.aiDrive
                ? {
                    aiDrive: {
                        enabled: drive.aiDrive?.enabled ?? prev?.aiDrive?.enabled ?? false,
                        agentId: drive.aiDrive?.agentId ?? prev?.aiDrive?.agentId ?? "",
                        objective: drive.aiDrive?.objective ??
                            prev?.aiDrive?.objective ??
                            "Explore safely and avoid obstacles.",
                        tickMs: drive.aiDrive?.tickMs ?? prev?.aiDrive?.tickMs ?? 420,
                    },
                }
                : {}),
        };
    });
}
function setWifi(id, board, wifi) {
    return mutate(id, (vehicle) => {
        const current = vehicle.wifi ?? {};
        if (wifi === null) {
            delete current[board];
        }
        else {
            current[board] = wifi;
        }
        if (current.drive || current.video) {
            vehicle.wifi = current;
        }
        else {
            delete vehicle.wifi;
        }
    });
}
function setFlash(id, board, flash) {
    return mutate(id, (vehicle) => {
        const current = vehicle.flash ?? {};
        if (flash === null) {
            delete current[board];
        }
        else if (board === "drive") {
            current.drive = flash;
        }
        else {
            current.video = flash;
        }
        if (current.drive || current.video) {
            vehicle.flash = current;
        }
        else {
            delete vehicle.flash;
        }
    });
}
