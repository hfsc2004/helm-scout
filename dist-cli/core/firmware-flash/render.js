"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSketch = renderSketch;
function coerceBool(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        const s = value.toLowerCase().trim();
        if (s === "true" || s === "1" || s === "yes")
            return true;
        if (s === "false" || s === "0" || s === "no")
            return false;
    }
    return null;
}
function coerceNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
function validateAndResolve(vars, provided) {
    const resolved = {};
    const errors = [];
    const known = new Set(vars.map((v) => v.key));
    for (const v of vars) {
        const raw = provided[v.key];
        if (raw === undefined || raw === null || raw === "") {
            if (v.required && v.default === undefined) {
                errors.push(`missing required var: ${v.key}`);
                continue;
            }
            if (v.default !== undefined) {
                resolved[v.key] = v.default;
                continue;
            }
            // Optional with no default; leave unset. Substitution will fail later if
            // the placeholder is actually used.
            continue;
        }
        switch (v.type) {
            case "string":
            case "secret":
                resolved[v.key] = String(raw);
                break;
            case "number": {
                const n = coerceNumber(raw);
                if (n === null) {
                    errors.push(`var ${v.key} must be a number; got ${typeof raw}`);
                }
                else {
                    resolved[v.key] = n;
                }
                break;
            }
            case "boolean": {
                const b = coerceBool(raw);
                if (b === null) {
                    errors.push(`var ${v.key} must be a boolean; got ${typeof raw}`);
                }
                else {
                    resolved[v.key] = b;
                }
                break;
            }
        }
    }
    // Unknown keys are a strict error — typos shouldn't silently drop config.
    for (const key of Object.keys(provided)) {
        if (!known.has(key) && !key.endsWith(".octets")) {
            errors.push(`unknown var: ${key}`);
        }
    }
    if (errors.length)
        return { errors };
    return { resolved };
}
/**
 * Substitute {{key}} placeholders in source. Includes a derived
 * `{{key.octets}}` for any IP-address-shaped string var, expanding
 * "192.168.1.50" → "192, 168, 1, 50" (suitable for Arduino's IPAddress ctor).
 */
function substitute(source, resolved) {
    const missing = [];
    // Derive .octets variants from string values that look like IPv4 addresses.
    const derived = {};
    for (const [k, v] of Object.entries(resolved)) {
        if (typeof v === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
            derived[`${k}.octets`] = v.split(".").join(", ");
        }
    }
    const rendered = source.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_match, key) => {
        if (derived[key] !== undefined)
            return derived[key];
        if (key in resolved) {
            const v = resolved[key];
            if (typeof v === "boolean")
                return v ? "true" : "false";
            return String(v);
        }
        missing.push(key);
        return `/* MISSING: ${key} */`;
    });
    return { rendered, missing };
}
function renderSketch(template, provided) {
    const validated = validateAndResolve(template.manifest.vars, provided);
    if ("errors" in validated) {
        return { ok: false, errors: validated.errors };
    }
    const { rendered, missing } = substitute(template.sketchSource, validated.resolved);
    if (missing.length) {
        return {
            ok: false,
            errors: missing.map((k) => `template referenced unknown var: {{${k}}}`),
        };
    }
    return { ok: true, sketch: rendered, resolved: validated.resolved };
}
