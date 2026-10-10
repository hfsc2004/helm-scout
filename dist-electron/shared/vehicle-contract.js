"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Vehicle contract — the shape of "a thing Helm Scout can control."
 *
 * Design notes:
 * - The data model is fleet-shaped from day one. The simple driver view
 *   renders fleets of size 1 without exposing fleet concepts in the UI.
 * - Vehicles declare their `kind` and `capabilities` so the UI and the
 *   LLM planner can adapt without hardcoding per-vehicle logic.
 * - `lossOfCommsBehavior` is informational at the app layer; firmware
 *   is responsible for actually enforcing it (deadman timer, RTH, etc.).
 * - The command shape is a tagged union per `Action`. Each vehicle's
 *   capabilities determine which actions it accepts.
 *
 * Legacy dual-board layout (drive + video):
 * - `transport` is the *drive* board (typically an ESP32) — its own IP/port
 *   on the LAN, its own Wi-Fi creds in `wifi.drive`, its own flash params
 *   in `flash.drive`.
 * - `camera` is the *video* board (typically an ESP32-S3) — its own IP/port,
 *   its own creds in `wifi.video`, its own flash params in `flash.video`.
 * - PSF Sensor Board v1.3 currently runs alone as a camera/sensor board.
 *   Its bring-up firmware has no motor or drive telemetry endpoint.
 * - The runtime endpoints (`transport`, `camera`) are what Helm Scout
 *   talks to at drive time; `wifi.*` and `flash.*` are install-time config
 *   the user supplied so we can re-flash or document the vehicle later.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRIVE_TUNING_DEFAULTS = exports.COMMAND_LIMITS = void 0;
exports.hasDriveControl = hasDriveControl;
/** The v1.3 bring-up firmware has camera endpoints but no drive endpoint. */
function hasDriveControl(vehicle) {
    return vehicle.sensorBoardRevision !== "1.3" &&
        !!vehicle.transport && vehicle.capabilities.includes("drive.skidsteer");
}
/**
 * Speed/turn values are clamped to [-255, 255] on the wire (matches the
 * firmware's MAX_SPEED guard). Durations clamp to [100, 5000] ms in line
 * with the deadman budget — bigger windows would let the firmware time out
 * mid-action.
 */
exports.COMMAND_LIMITS = {
    speedMax: 255,
    speedMin: -255,
    durationMinMs: 100,
    durationMaxMs: 5000,
};
exports.DRIVE_TUNING_DEFAULTS = {
    speed: 170,
    swapSides: false,
    invertLeft: false,
    invertRight: false,
    map: {
        forward: "fwd",
        reverse: "rev",
        left: "turn_left",
        right: "turn_right",
    },
    numControlsEnabled: true,
    obstacleFrontThreshold: 0,
};
