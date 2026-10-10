"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LightPlayer = void 0;
const light_scripts_js_1 = require("../../shared/light-scripts.js");
class LightPlayer {
    state = { running: false, looping: false, scriptId: null, line: 0, error: "" };
    cancel = null;
    completion = null;
    status() { return { ...this.state }; }
    async stop() { this.cancel?.abort(); await this.completion; }
    async start(script, endpoint, loop = false) {
        if (this.state.running)
            throw new Error("A light show is already running. Stop it first.");
        script = (0, light_scripts_js_1.validateLightScript)(script);
        const actions = script.lines.flatMap(line => line.actions);
        const unsupported = actions.find(action => action.target.startsWith("ESP32-"));
        if (unsupported)
            throw new Error(`${unsupported.target}: its control GPIO has not been identified. Choose LED1–LED3 or IR.`);
        if (actions.some(action => action.target === "IR")) {
            const response = await fetch(new URL("/ir", endpoint), { signal: AbortSignal.timeout(5000) });
            if (!response.ok)
                throw new Error("IR control requires the updated light-control firmware and the switch in expander mode (1–2).");
        }
        // Recheck after asynchronous preflight to prevent concurrent starts.
        if (this.state.running)
            throw new Error("A light show is already running.");
        const controller = new AbortController();
        this.cancel = controller;
        this.state = { running: true, looping: loop, scriptId: script.id, line: 0, error: "" };
        this.completion = this.run(script, endpoint, controller.signal, loop);
    }
    async set(endpoint, line, on) {
        const url = new URL(line.target === "IR" ? "/ir" : "/led", endpoint);
        if (line.target === "IR")
            url.searchParams.set("enabled", on ? "1" : "0");
        else {
            url.searchParams.set("index", String(Number(line.target.slice(3)) - 1));
            for (const channel of ["r", "g", "b", "w"])
                url.searchParams.set(channel, String(on ? line[channel] : 0));
        }
        const response = await fetch(url, { method: line.target === "IR" ? "POST" : "GET", signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            throw new Error(`${line.target}: HTTP ${response.status}`);
        const result = await response.json();
        if (!result.ok)
            throw new Error(result.error || `${line.target}: light command failed`);
    }
    wait(ms, signal) {
        return new Promise(resolve => {
            if (signal.aborted) {
                resolve();
                return;
            }
            const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
            const timer = setTimeout(finish, ms);
            signal.addEventListener("abort", finish, { once: true });
        });
    }
    async run(script, endpoint, signal, loop) {
        const touched = new Map();
        try {
            do {
                for (let index = 0; index < script.lines.length && !signal.aborted; index++) {
                    const line = script.lines[index];
                    this.state.line = index + 1;
                    if (!line.actions.length) {
                        await this.wait(line.durationMs, signal);
                        continue;
                    }
                    // Each selected light has its own timeline. Await all outstanding work
                    // before cleanup, including when another light fails or Stop is pressed.
                    const results = await Promise.allSettled(line.actions.map(async (action) => {
                        touched.set(action.target, action);
                        try {
                            if (action.mode === "steady") {
                                await this.set(endpoint, action, true);
                                if (!signal.aborted)
                                    await this.wait(action.durationMs, signal);
                                return; // No off command between lines or loop iterations.
                            }
                            for (let flash = 0; flash < action.flashes && !signal.aborted; flash++) {
                                await this.set(endpoint, action, true);
                                if (!signal.aborted)
                                    await this.wait(action.durationMs, signal);
                                await this.set(endpoint, action, false);
                                if (!signal.aborted)
                                    await this.wait(action.durationMs, signal);
                            }
                        }
                        catch (error) {
                            this.cancel?.abort();
                            throw error;
                        }
                    }));
                    const failure = results.find(result => result.status === "rejected");
                    if (failure?.status === "rejected")
                        throw failure.reason;
                }
            } while (loop && !signal.aborted);
        }
        catch (error) {
            this.state.error = error instanceof Error ? error.message : String(error);
        }
        finally {
            for (const line of touched.values()) {
                try {
                    await this.set(endpoint, line, false);
                }
                catch (error) {
                    this.state.error += `${this.state.error ? "; " : ""}Could not turn off ${line.target}: ${String(error)}`;
                }
            }
            this.state.running = false;
            this.state.looping = false;
            this.cancel = null;
        }
    }
}
exports.LightPlayer = LightPlayer;
