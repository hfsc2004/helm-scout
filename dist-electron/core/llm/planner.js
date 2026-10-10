"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PLANNER_MODEL = void 0;
exports.plan = plan;
const vehicle_contract_js_1 = require("../../shared/vehicle-contract.js");
const chat_js_1 = require("./ollama/chat.js");
const skidsteer_js_1 = require("./prompts/skidsteer.js");
/**
 * The planner: intent string → validated vehicle command.
 *
 * Architectural rule (mirrors PSF Core's IRG):
 *   The model proposes. The validator gates. Only validated commands reach
 *   the vehicle. There is no fuzzy parsing, no value coercion outside the
 *   validator's explicit clamps. If the model returns nonsense, we say so
 *   honestly and refuse to drive.
 */
exports.DEFAULT_PLANNER_MODEL = "qwen2.5-vl-7b";
/**
 * Validate a parsed candidate against the SkidSteerAction shape.
 * Returns the validated command on success, or an error reason on failure.
 */
function validateSkidSteer(candidate) {
    if (!candidate || typeof candidate !== "object") {
        return { ok: false, reason: "response is not a JSON object" };
    }
    const obj = candidate;
    const kind = obj["kind"];
    if (typeof kind !== "string") {
        return { ok: false, reason: "missing or non-string 'kind' field" };
    }
    const inRange = (v, min, max, name) => {
        if (typeof v !== "number" || !Number.isFinite(v)) {
            return { ok: false, reason: `${name} must be a finite number; got ${typeof v}` };
        }
        if (v < min || v > max) {
            return { ok: false, reason: `${name}=${v} out of range [${min}..${max}]` };
        }
        return { ok: true, value: Math.trunc(v) };
    };
    const durationOpt = (v) => {
        if (v === undefined || v === null)
            return { ok: true };
        const r = inRange(v, vehicle_contract_js_1.COMMAND_LIMITS.durationMinMs, vehicle_contract_js_1.COMMAND_LIMITS.durationMaxMs, "durationMs");
        if (!r.ok)
            return r;
        return { ok: true, value: r.value };
    };
    switch (kind) {
        case "stop":
            return { ok: true, command: { kind: "stop" } };
        case "fwd":
        case "rev": {
            const speed = inRange(obj["speed"], 0, vehicle_contract_js_1.COMMAND_LIMITS.speedMax, "speed");
            if (!speed.ok)
                return speed;
            const dur = durationOpt(obj["durationMs"]);
            if (!dur.ok)
                return dur;
            return {
                ok: true,
                command: dur.value !== undefined
                    ? { kind, speed: speed.value, durationMs: dur.value }
                    : { kind, speed: speed.value },
            };
        }
        case "turn": {
            const signed = inRange(obj["signed"], vehicle_contract_js_1.COMMAND_LIMITS.speedMin, vehicle_contract_js_1.COMMAND_LIMITS.speedMax, "signed");
            if (!signed.ok)
                return signed;
            const dur = durationOpt(obj["durationMs"]);
            if (!dur.ok)
                return dur;
            return {
                ok: true,
                command: dur.value !== undefined
                    ? { kind: "turn", signed: signed.value, durationMs: dur.value }
                    : { kind: "turn", signed: signed.value },
            };
        }
        case "tank": {
            const left = inRange(obj["left"], vehicle_contract_js_1.COMMAND_LIMITS.speedMin, vehicle_contract_js_1.COMMAND_LIMITS.speedMax, "left");
            if (!left.ok)
                return left;
            const right = inRange(obj["right"], vehicle_contract_js_1.COMMAND_LIMITS.speedMin, vehicle_contract_js_1.COMMAND_LIMITS.speedMax, "right");
            if (!right.ok)
                return right;
            const dur = durationOpt(obj["durationMs"]);
            if (!dur.ok)
                return dur;
            return {
                ok: true,
                command: dur.value !== undefined
                    ? { kind: "tank", left: left.value, right: right.value, durationMs: dur.value }
                    : { kind: "tank", left: left.value, right: right.value },
            };
        }
        default:
            return { ok: false, reason: `unknown 'kind' value: ${kind}` };
    }
}
function tryParse(text) {
    try {
        return { ok: true, value: JSON.parse(text) };
    }
    catch (err) {
        return {
            ok: false,
            reason: `response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
async function plan(req) {
    const model = req.model ?? exports.DEFAULT_PLANNER_MODEL;
    const system = (0, skidsteer_js_1.buildSkidSteerSystemPrompt)(req.vehicle);
    const retry = req.retryOnInvalid !== false;
    const messages = [
        { role: "system", content: system },
        { role: "user", content: req.intent },
    ];
    let attempts = 0;
    let lastRaw = "";
    // First attempt.
    attempts++;
    const first = await (0, chat_js_1.chat)({
        model,
        messages,
        json: true,
        temperature: req.temperature ?? 0.0,
    });
    lastRaw = first.content;
    let parsed = tryParse(first.content);
    if (parsed.ok) {
        const validated = validateSkidSteer(parsed.value);
        if (validated.ok) {
            return {
                ok: true,
                command: validated.command,
                modelUsed: first.model,
                attempts,
                raw: first.content,
            };
        }
        parsed = { ok: false, reason: validated.reason };
    }
    if (!retry) {
        return {
            ok: false,
            reason: parsed.reason,
            modelUsed: first.model,
            attempts,
            raw: lastRaw,
        };
    }
    // Retry once with the validator error in the context.
    attempts++;
    const retryMessages = [
        ...messages,
        { role: "assistant", content: first.content },
        {
            role: "user",
            content: `That response was rejected: ${parsed.reason}. ` +
                `Return exactly one JSON object matching the schema. No prose.`,
        },
    ];
    const second = await (0, chat_js_1.chat)({
        model,
        messages: retryMessages,
        json: true,
        temperature: req.temperature ?? 0.0,
    });
    lastRaw = second.content;
    const secondParsed = tryParse(second.content);
    if (!secondParsed.ok) {
        return {
            ok: false,
            reason: `retry also invalid: ${secondParsed.reason}`,
            modelUsed: second.model,
            attempts,
            raw: lastRaw,
        };
    }
    const secondValidated = validateSkidSteer(secondParsed.value);
    if (!secondValidated.ok) {
        return {
            ok: false,
            reason: `retry also invalid: ${secondValidated.reason}`,
            modelUsed: second.model,
            attempts,
            raw: lastRaw,
        };
    }
    return {
        ok: true,
        command: secondValidated.command,
        modelUsed: second.model,
        attempts,
        raw: second.content,
    };
}
