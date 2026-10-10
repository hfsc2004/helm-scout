"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.health = health;
exports.getState = getState;
exports.sendCommand = sendCommand;
exports.emergencyStop = emergencyStop;
const vehicle_contract_js_1 = require("../../shared/vehicle-contract.js");
const vehicle_contract_js_2 = require("../../shared/vehicle-contract.js");
function baseUrl(vehicle) {
    if (!vehicle.transport || vehicle.sensorBoardRevision === "1.3") {
        throw new Error("no drive endpoint configured for this vehicle");
    }
    return `http://${vehicle.transport.host}:${vehicle.transport.port}`;
}
function clampSpeed(v) {
    return Math.max(vehicle_contract_js_1.COMMAND_LIMITS.speedMin, Math.min(vehicle_contract_js_1.COMMAND_LIMITS.speedMax, Math.trunc(v)));
}
function clampDuration(ms) {
    if (ms === undefined)
        return undefined;
    return Math.max(vehicle_contract_js_1.COMMAND_LIMITS.durationMinMs, Math.min(vehicle_contract_js_1.COMMAND_LIMITS.durationMaxMs, Math.trunc(ms)));
}
/**
 * Apply the vehicle's drive tuning (action map, swap/invert) to a command
 * the planner produced. Maps the *intent* (fwd/rev/turn-left/turn-right) to
 * the *wire-level action* the firmware expects when the chassis is wired
 * with rotated motors or a frame oriented 90/180°.
 *
 * Identity-map when no tuning is set, so existing vehicles keep working.
 */
function applyDriveTuning(action, tuning) {
    if (!tuning)
        return action;
    let next = remapAction(action, tuning);
    if (tuning.swapSides && next.kind === "tank") {
        next = { ...next, left: next.right, right: next.left };
    }
    if (next.kind === "tank") {
        if (tuning.invertLeft)
            next = { ...next, left: -next.left };
        if (tuning.invertRight)
            next = { ...next, right: -next.right };
    }
    return next;
}
function remapAction(action, tuning) {
    // Pick the user-configured target for this intent.
    let target;
    switch (action.kind) {
        case "stop":
            return action;
        case "fwd":
            target = tuning.map.forward;
            break;
        case "rev":
            target = tuning.map.reverse;
            break;
        case "turn":
            // Negative = left intent, positive = right intent (matches firmware).
            target = action.signed < 0 ? tuning.map.left : tuning.map.right;
            break;
        case "tank":
            // Tank commands are explicit per-wheel; don't reinterpret them.
            return action;
    }
    // Re-shape the action to match the chosen target.
    const dur = "durationMs" in action ? action.durationMs : undefined;
    const mag = action.kind === "fwd" || action.kind === "rev"
        ? Math.abs(action.speed)
        : action.kind === "turn"
            ? Math.abs(action.signed)
            : 0;
    switch (target) {
        case "stop":
            return { kind: "stop" };
        case "fwd":
            return { kind: "fwd", speed: mag, durationMs: dur };
        case "rev":
            return { kind: "rev", speed: mag, durationMs: dur };
        case "turn_left":
            return { kind: "turn", signed: -mag, durationMs: dur };
        case "turn_right":
            return { kind: "turn", signed: mag, durationMs: dur };
    }
}
function buildPath(action) {
    const dur = clampDuration("durationMs" in action ? action.durationMs : undefined);
    const durSuffix = dur === undefined ? "" : `&ms=${dur}`;
    switch (action.kind) {
        case "stop":
            return "/cmd?stop=1";
        case "fwd":
            return `/cmd?fwd=${Math.abs(clampSpeed(action.speed))}${durSuffix}`;
        case "rev":
            return `/cmd?rev=${Math.abs(clampSpeed(action.speed))}${durSuffix}`;
        case "turn":
            return `/cmd?turn=${clampSpeed(action.signed)}${durSuffix}`;
        case "tank":
            return `/cmd?left=${clampSpeed(action.left)}&right=${clampSpeed(action.right)}${durSuffix}`;
    }
}
async function httpGet(url, opts = {}) {
    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 5000;
    let timedOut = false;
    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    try {
        // Force a fresh TCP connection per request and tell the firmware to
        // close it immediately. ESP32's WebServer library only has room for a
        // few concurrent sockets and gets wedged when keep-alive idle ones
        // pile up. We pay a 3-way-handshake per request as a result, but the
        // firmware stays responsive.
        const res = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            headers: { Connection: "close" },
            // Node-only: disable keep-alive via undici. The renderer Fetch API
            // ignores `keepalive: false` (it's a different field there), so the
            // header above is what actually matters in both environments.
            keepalive: false,
        });
        const body = await res.text();
        return { status: res.status, body };
    }
    catch (err) {
        const host = (() => {
            try {
                const u = new URL(url);
                return { name: u.hostname, port: u.port || "80" };
            }
            catch {
                return { name: url, port: "?" };
            }
        })();
        // Translate Node's raw "This operation was aborted" into something a
        // user can actually act on. Show host:port and the timeout.
        if (timedOut) {
            throw new Error(`drive board did not respond within ${timeoutMs}ms (${host.name}:${host.port})`);
        }
        // ENOTFOUND on a .local hostname almost always means the host has no
        // mDNS resolver running (no Avahi on Linux, no Bonjour on Windows).
        // Surface a fix the user can apply instead of a raw DNS error.
        const message = err instanceof Error ? err.message : String(err);
        if (host.name.endsWith(".local") && /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
            throw new Error(`couldn't resolve ${host.name} — this host doesn't have an mDNS resolver. ` +
                `Install Avahi (Linux) or Bonjour (Windows), or set a static IP for the vehicle.`);
        }
        throw err;
    }
    finally {
        clearTimeout(timeout);
    }
}
function parseJson(body) {
    try {
        return JSON.parse(body);
    }
    catch {
        return null;
    }
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function health(vehicle, opts = {}) {
    const url = `${baseUrl(vehicle)}/health`;
    const { status, body } = await httpGet(url, opts);
    if (status < 200 || status >= 300)
        return null;
    return parseJson(body);
}
async function getState(vehicle, opts = {}) {
    const url = `${baseUrl(vehicle)}/telemetry`;
    const { status, body } = await httpGet(url, opts);
    if (status < 200 || status >= 300)
        return null;
    return parseJson(body);
}
/**
 * Hard rotation override for chassis whose firmware is wired 90° clockwise
 * from the driver's intent (i.e. pressing "forward" makes it go right).
 * Rotates every intent 90° counter-clockwise before sending.
 * TODO: remove once the firmware's motor pins are re-labeled.
 */
function rotate90CCW(action) {
    const dur = "durationMs" in action ? action.durationMs : undefined;
    switch (action.kind) {
        case "stop":
            return action;
        case "fwd":
            // forward intent -> turn left
            return { kind: "turn", signed: -Math.abs(action.speed), durationMs: dur };
        case "rev":
            // reverse intent -> turn right
            return { kind: "turn", signed: Math.abs(action.speed), durationMs: dur };
        case "turn":
            // left intent (signed<0) -> reverse; right intent (signed>=0) -> forward
            return action.signed < 0
                ? { kind: "rev", speed: Math.abs(action.signed), durationMs: dur }
                : { kind: "fwd", speed: Math.abs(action.signed), durationMs: dur };
        case "tank":
            return action;
    }
}
async function sendCommand(vehicle, action, opts = {}) {
    if (!(0, vehicle_contract_js_2.hasDriveControl)(vehicle)) {
        if (action.kind === "stop")
            return { ok: true };
        throw new Error("no drive endpoint configured for this vehicle");
    }
    const rotated = rotate90CCW(action);
    const effective = applyDriveTuning(rotated, vehicle.drive);
    const url = `${baseUrl(vehicle)}${buildPath(effective)}`;
    const { status, body } = await httpGet(url, opts);
    if (status < 200 || status >= 300) {
        return { ok: false, error: `HTTP ${status}` };
    }
    const parsed = parseJson(body);
    return parsed ?? { ok: true };
}
async function emergencyStop(vehicle, opts = {}) {
    return sendCommand(vehicle, { kind: "stop" }, opts);
}
