"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
exports.chatStream = chatStream;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const env_js_1 = require("./env.js");
/**
 * Non-streaming chat. Returns the assembled assistant message.
 *
 * Throws on transport failure or non-2xx response, with a message that
 * distinguishes "model not installed" from generic network errors so the
 * caller can give the user a useful next step.
 */
async function chat(opts) {
    const url = `http://127.0.0.1:${env_js_1.HELM_OLLAMA_PORT}/api/chat`;
    const body = {
        model: opts.model,
        messages: opts.messages,
        stream: false,
        options: {
            temperature: opts.temperature ?? 0.0,
            ...(opts.numPredict !== undefined ? { num_predict: opts.numPredict } : {}),
        },
    };
    if (opts.json)
        body["format"] = "json";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60000);
    let res;
    try {
        res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    }
    catch (err) {
        clearTimeout(timeout);
        throw new Error(`chat: cannot reach Helm Scout's private Ollama at ${url}. Is it running? (helm ollama-start). ${err instanceof Error ? err.message : String(err)}`);
    }
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) {
        if (res.status === 404 && /model.*not found|pull/i.test(text)) {
            throw new Error(`chat: model "${opts.model}" is not installed in Helm Scout's private Ollama. ` +
                `Run: helm model-download <url>  (or use --model <existing-name>).`);
        }
        throw new Error(`chat: HTTP ${res.status} from Ollama. ${text.slice(0, 200)}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error(`chat: non-JSON response from Ollama: ${text.slice(0, 200)}`);
    }
    const content = parsed.message?.content ?? "";
    return {
        model: parsed.model ?? opts.model,
        content,
        tokens: {
            promptEval: parsed.prompt_eval_count,
            eval: parsed.eval_count,
            totalMs: typeof parsed.total_duration === "number"
                ? Math.round(parsed.total_duration / 1_000_000)
                : undefined,
        },
    };
}
/**
 * Streaming chat. Yields one chunk per server-sent NDJSON line.
 *
 * Not used by the planner v0.1 (we want the whole JSON before validating),
 * but provided here so future surfaces (live assistant chat in the UI, etc.)
 * have a tested path.
 */
async function* chatStream(opts) {
    const url = `http://127.0.0.1:${env_js_1.HELM_OLLAMA_PORT}/api/chat`;
    const body = {
        model: opts.model,
        messages: opts.messages,
        stream: true,
        options: {
            temperature: opts.temperature ?? 0.0,
            ...(opts.numPredict !== undefined ? { num_predict: opts.numPredict } : {}),
        },
    };
    if (opts.json)
        body["format"] = "json";
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(`chatStream: HTTP ${res.status}. ${t.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            try {
                yield JSON.parse(trimmed);
            }
            catch {
                // Skip non-JSON lines (Ollama mixes them sometimes).
            }
        }
    }
}
