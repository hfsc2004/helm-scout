"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.get = get;
exports.all = all;
const registry = new Map();
function register(cmd) {
    if (registry.has(cmd.def.name)) {
        throw new Error(`Duplicate command registered: ${cmd.def.name}`);
    }
    registry.set(cmd.def.name, cmd);
}
function get(name) {
    return registry.get(name);
}
function all() {
    return [...registry.values()];
}
