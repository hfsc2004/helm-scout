"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.openSubscription = openSubscription;
exports.closeByStreamId = closeByStreamId;
exports.closeByConsumer = closeByConsumer;
exports.listActive = listActive;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
const bmoc = __importStar(require("../../core/bmoc/index.js"));
const active = new Map();
let counter = 0;
function nextStreamId(kind) {
    counter++;
    return `stream_${kind}_${Date.now()}_${counter}`;
}
/**
 * Open a tracked subscription. The caller provides the closer (e.g., a
 * setInterval handle wrapped in clearInterval). The closer is invoked on:
 *   - explicit close() on the returned handle
 *   - bmoc.closeAllSessions() at shutdown
 */
function openSubscription(opts) {
    const streamId = nextStreamId(opts.kind);
    const bmocSessionId = bmoc.registerSession({
        type: `ipc-${opts.kind}`,
        streamId,
        consumerId: opts.consumerId,
        ...(opts.metadata ?? {}),
    });
    const sub = {
        streamId,
        bmocSessionId,
        closer: opts.closer,
        closed: false,
    };
    active.set(streamId, sub);
    return {
        info: { streamId, bmocSessionId },
        close: async () => {
            if (sub.closed)
                return;
            sub.closed = true;
            try {
                await sub.closer();
            }
            finally {
                active.delete(streamId);
                try {
                    await bmoc.closeSession(bmocSessionId);
                }
                catch {
                    // Already torn down by BMOC; that's fine.
                }
            }
        },
    };
}
function closeByStreamId(streamId) {
    const sub = active.get(streamId);
    if (!sub || sub.closed)
        return Promise.resolve();
    sub.closed = true;
    active.delete(streamId);
    return Promise.resolve()
        .then(() => sub.closer())
        .then(() => bmoc.closeSession(sub.bmocSessionId).catch(() => undefined))
        .then(() => undefined);
}
/**
 * Close all subscriptions tied to a given consumer (e.g., on window close).
 */
async function closeByConsumer(consumerId) {
    let count = 0;
    for (const [streamId, sub] of active) {
        // Consumer is stored on the BMOC session; query it.
        const session = bmoc.getSession(sub.bmocSessionId);
        if (session && session["consumerId"] === consumerId) {
            await closeByStreamId(streamId);
            count++;
        }
    }
    return count;
}
/** Snapshot, for diagnostics. */
function listActive() {
    return [...active.values()].map((s) => ({
        streamId: s.streamId,
        bmocSessionId: s.bmocSessionId,
    }));
}
