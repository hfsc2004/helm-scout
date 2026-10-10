"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTemplates = listTemplates;
exports.loadTemplate = loadTemplate;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function templatesRoot() {
    // CommonJS context: walk up from __dirname looking for firmware/templates.
    // Works in both tsx (source path) and compiled (dist-electron path).
    let cur = __dirname;
    for (let i = 0; i < 8; i++) {
        const candidate = (0, node_path_1.join)(cur, "firmware", "templates");
        if ((0, node_fs_1.existsSync)(candidate))
            return candidate;
        const up = (0, node_path_1.dirname)(cur);
        if (up === cur)
            break;
        cur = up;
    }
    // Last resort: assume cwd is the repo.
    return (0, node_path_1.join)(process.cwd(), "firmware", "templates");
}
function listTemplates() {
    const root = templatesRoot();
    if (!(0, node_fs_1.existsSync)(root))
        return [];
    const out = [];
    for (const entry of (0, node_fs_1.readdirSync)(root, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const manifestPath = (0, node_path_1.join)(root, entry.name, "template.json");
        if (!(0, node_fs_1.existsSync)(manifestPath))
            continue;
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(manifestPath, "utf8"));
            if (parsed.id && parsed.fqbn && parsed.target)
                out.push(parsed);
        }
        catch {
            // skip malformed
        }
    }
    return out;
}
function loadTemplate(id) {
    const root = templatesRoot();
    const dir = (0, node_path_1.join)(root, id);
    if (!(0, node_fs_1.existsSync)(dir) || !(0, node_fs_1.statSync)(dir).isDirectory())
        return null;
    const manifestPath = (0, node_path_1.join)(dir, "template.json");
    const sketchPath = (0, node_path_1.join)(dir, "sketch.ino");
    if (!(0, node_fs_1.existsSync)(manifestPath) || !(0, node_fs_1.existsSync)(sketchPath))
        return null;
    const manifest = JSON.parse((0, node_fs_1.readFileSync)(manifestPath, "utf8"));
    const sketchSource = (0, node_fs_1.readFileSync)(sketchPath, "utf8");
    return { manifest, dir, sketchSource };
}
