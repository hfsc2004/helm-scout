"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Serial subsystem — TypeScript surface over the verbatim Core-CE adapter.
 *
 * Verbatim source: gateway-adapters.js (from PSF Core's moe-gateway-adapters).
 * Cross-platform USB/serial enumeration with friendly board hints
 * (raspberry-pi-pico, esp32, etc.) by scanning /dev on Linux/macOS and
 * (currently no-op) on Windows.
 *
 * Helm Scout uses this for serial discovery only in v0.1. The actual *driving*
 * of serial-attached vehicles (mpremote, raw REPL, etc.) lands in a later
 * branch when we add a serial vehicle adapter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSerialPorts = listSerialPorts;
exports.resolveSerialPort = resolveSerialPort;
const adapters = require("./gateway-adapters.js");
function listSerialPorts() {
    return adapters.listSerialPorts();
}
function resolveSerialPort(serialSource, availablePorts) {
    return adapters.resolveSerialPort(serialSource, availablePorts ?? null);
}
