"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * One persistent connection per vehicle to its MJPEG `/stream` endpoint,
 * with a multipart demuxer that pulls each JPEG frame out and caches the
 * most recent one in memory.
 *
 * Why: the Elegoo / esp32-camera firmwares are single-threaded HTTP — if a
 * client holds `/stream`, *every* other endpoint (`/capture`, `/health`) on
 * that board blocks until the stream client disconnects. The fix is for
 * Helm Scout itself to hold the single stream connection, parse it once, and
 * serve every other consumer (renderer `<img>`, CLI snapshot, future LLM
 * planner with vision) out of the cached buffer.
 *
 * One connection upstream, any number of consumers downstream.
 *
 * BMOC-tracked: each open stream registers as a session so app-quit /
 * window-close reaps it.
 */
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
exports.acquire = acquire;
exports.peek = peek;
exports.invalidate = invalidate;
exports.isStalled = isStalled;
const bmoc = __importStar(require("../bmoc/index.js"));
const streams = new Map();
function vehicleStreamUrl(vehicle) {
    if (!vehicle.camera)
        return null;
    const base = vehicle.camera.baseUrl.replace(/\/$/, "");
    const path = vehicle.camera.streamPath ?? "/stream";
    return `${base}${path}`;
}
function extractBoundary(contentType) {
    if (!contentType)
        return null;
    const m = /boundary=([^;]+)/i.exec(contentType);
    if (!m)
        return null;
    return m[1].trim().replace(/^"(.*)"$/, "$1");
}
function concat(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}
function indexOfBytes(haystack, needle, from = 0) {
    if (needle.length === 0)
        return from;
    const lastStart = haystack.length - needle.length;
    outer: for (let i = from; i <= lastStart; i++) {
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j])
                continue outer;
        }
        return i;
    }
    return -1;
}
const DOUBLE_CRLF = new TextEncoder().encode("\r\n\r\n");
function parseHeaderBlock(headerBytes) {
    const text = new TextDecoder("latin1").decode(headerBytes);
    let contentType = "image/jpeg";
    let contentLength = null;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line)
            continue;
        const idx = line.indexOf(":");
        if (idx <= 0)
            continue;
        const name = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        if (name === "content-type")
            contentType = value;
        else if (name === "content-length") {
            const n = Number(value);
            if (Number.isFinite(n) && n >= 0)
                contentLength = n;
        }
    }
    return { contentType, contentLength };
}
/**
 * Pump the multipart stream body, slicing one JPEG out per boundary and
 * stashing it in `record.lastFrame`. Resolves only when the upstream stream
 * actually ends or aborts; throws on parse errors.
 */
async function consumeStream(body, boundary, record, signalFirstFrame) {
    const reader = body.getReader();
    const boundaryBytes = new TextEncoder().encode("--" + boundary);
    // The reader yields Uint8Array<ArrayBufferLike> in current lib.dom; widen
    // explicitly so we can concat freshly-allocated buffers with whatever the
    // stream hands us.
    let buf = new Uint8Array(0);
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            if (!value || value.length === 0)
                continue;
            record.bytesSeen += value.length;
            buf = buf.length === 0 ? value : concat(buf, value);
            // Slice as many complete parts as we have buffered.
            while (true) {
                const bStart = indexOfBytes(buf, boundaryBytes, 0);
                if (bStart < 0) {
                    // Drop everything up to the last possible boundary-start byte so
                    // the buffer doesn't grow unbounded if the upstream never sends
                    // another boundary.
                    if (buf.length > boundaryBytes.length * 4) {
                        buf = buf.slice(buf.length - boundaryBytes.length);
                    }
                    break;
                }
                // The boundary may be followed by a trailing "--" (final marker)
                // or CR/LF; skip to the headers that follow.
                let cursor = bStart + boundaryBytes.length;
                if (buf[cursor] === 0x2d /* '-' */ && buf[cursor + 1] === 0x2d) {
                    // Final boundary — end of stream from upstream's point of view.
                    return;
                }
                // Skip optional CR/LF after the boundary line.
                if (buf[cursor] === 0x0d /* \r */)
                    cursor++;
                if (buf[cursor] === 0x0a /* \n */)
                    cursor++;
                const headerEnd = indexOfBytes(buf, DOUBLE_CRLF, cursor);
                if (headerEnd < 0) {
                    // Need more bytes for headers.
                    break;
                }
                const headerBytes = buf.slice(cursor, headerEnd);
                const { contentType, contentLength } = parseHeaderBlock(headerBytes);
                const bodyStart = headerEnd + DOUBLE_CRLF.length;
                let bodyEnd;
                if (contentLength !== null) {
                    bodyEnd = bodyStart + contentLength;
                    if (buf.length < bodyEnd)
                        break; // need more bytes
                }
                else {
                    // Find the next boundary marker.
                    const nextBoundary = indexOfBytes(buf, boundaryBytes, bodyStart);
                    if (nextBoundary < 0)
                        break; // need more bytes
                    // Trailing CRLF before next boundary, if present.
                    bodyEnd = nextBoundary;
                    if (bodyEnd >= 2 && buf[bodyEnd - 2] === 0x0d && buf[bodyEnd - 1] === 0x0a) {
                        bodyEnd -= 2;
                    }
                }
                const frame = buf.slice(bodyStart, bodyEnd);
                // Cache by copy so the underlying Uint8Array we slice from can be
                // GC'd when we trim the read buffer.
                record.lastFrame = {
                    bytes: new Uint8Array(frame),
                    contentType,
                    capturedAt: Date.now(),
                };
                record.framesSeen += 1;
                record.lastError = null;
                if (!record.firstFrameSettled) {
                    record.firstFrameSettled = true;
                    signalFirstFrame();
                }
                // Advance the buffer past this part.
                buf = buf.slice(bodyEnd);
            }
        }
    }
    finally {
        try {
            reader.releaseLock();
        }
        catch {
            // ignore
        }
    }
}
async function openUpstream(record, signalFirstFrame, signalError) {
    try {
        const res = await fetch(record.url, {
            method: "GET",
            signal: record.controller.signal,
            headers: { Accept: "multipart/x-mixed-replace, image/jpeg, */*" },
        });
        if (!res.ok) {
            throw new Error(`Camera stream returned HTTP ${res.status} at ${record.url}`);
        }
        if (!res.body) {
            throw new Error("Camera stream response had no body");
        }
        const boundary = extractBoundary(res.headers.get("content-type"));
        if (!boundary) {
            // Single-shot JPEG response — cache it and we're done.
            const arrayBuf = await res.arrayBuffer();
            record.lastFrame = {
                bytes: new Uint8Array(arrayBuf),
                contentType: res.headers.get("content-type") ?? "image/jpeg",
                capturedAt: Date.now(),
            };
            record.framesSeen += 1;
            if (!record.firstFrameSettled) {
                record.firstFrameSettled = true;
                signalFirstFrame();
            }
            return;
        }
        await consumeStream(res.body, boundary, record, signalFirstFrame);
    }
    catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        record.lastError = e.message;
        if (!record.firstFrameSettled) {
            record.firstFrameSettled = true;
            signalError(e);
        }
        throw e;
    }
}
/**
 * Acquire a stream-handle for a vehicle. Reuses an existing stream session
 * when one is already open; otherwise opens a single upstream connection,
 * registers a BMOC session, and returns a handle.
 */
function acquire(vehicle) {
    const url = vehicleStreamUrl(vehicle);
    if (!url)
        return null;
    let record = streams.get(vehicle.id);
    if (!record) {
        const controller = new AbortController();
        let resolveFirst;
        let rejectFirst;
        const firstFrame = new Promise((res, rej) => {
            resolveFirst = res;
            rejectFirst = rej;
        });
        record = {
            vehicleId: vehicle.id,
            url,
            controller,
            sessionId: bmoc.registerSession({
                type: "camera-stream",
                vehicleId: vehicle.id,
                url,
            }),
            consumers: 0,
            lastFrame: null,
            startedAt: Date.now(),
            framesSeen: 0,
            bytesSeen: 0,
            lastError: null,
            firstFrame,
            firstFrameSettled: false,
        };
        streams.set(vehicle.id, record);
        const recRef = record;
        // Fire-and-forget; finally-block tears the session down.
        void openUpstream(recRef, resolveFirst, rejectFirst)
            .catch(() => {
            // record.lastError already set; nothing else to do — handle.release()
            // by consumers cleans up.
        })
            .finally(() => {
            // Upstream ended (normal close, server hangup, abort). Drop the
            // entry so the next acquire() retries fresh.
            if (streams.get(recRef.vehicleId) === recRef) {
                streams.delete(recRef.vehicleId);
                void bmoc.closeSession(recRef.sessionId).catch(() => undefined);
            }
        });
    }
    record.consumers += 1;
    const recRef = record;
    return {
        vehicleId: vehicle.id,
        getFrame() {
            return recRef.lastFrame;
        },
        async waitForFirstFrame(timeoutMs = 8000) {
            if (recRef.lastFrame)
                return recRef.lastFrame;
            await Promise.race([
                recRef.firstFrame,
                new Promise((_res, rej) => setTimeout(() => rej(new Error("timed out waiting for first frame")), timeoutMs)),
            ]);
            if (!recRef.lastFrame) {
                throw new Error(recRef.lastError ?? "no frame available");
            }
            return recRef.lastFrame;
        },
        async release() {
            recRef.consumers -= 1;
            if (recRef.consumers > 0)
                return;
            try {
                recRef.controller.abort();
            }
            catch {
                // already aborted
            }
            // The `finally` in openUpstream above takes care of the streams.delete()
            // and bmoc.closeSession() the moment the fetch loop unwinds.
        },
    };
}
/**
 * Read-only inspection — useful for the privacy/diagnostics endpoints and
 * for tests. Returns null when no stream is open for this vehicle.
 */
function peek(vehicleId) {
    const rec = streams.get(vehicleId);
    if (!rec)
        return null;
    return {
        url: rec.url,
        framesSeen: rec.framesSeen,
        bytesSeen: rec.bytesSeen,
        consumers: rec.consumers,
        startedAt: rec.startedAt,
        lastError: rec.lastError,
        hasFrame: rec.lastFrame !== null,
        lastFrameAt: rec.lastFrame?.capturedAt ?? null,
    };
}
/** Drop a stalled upstream connection so the next acquire starts fresh. */
function invalidate(vehicleId) {
    const rec = streams.get(vehicleId);
    if (!rec)
        return;
    streams.delete(vehicleId);
    rec.controller.abort();
    void bmoc.closeSession(rec.sessionId).catch(() => undefined);
}
function isStalled(vehicleId, maxAgeMs = 3000) {
    const rec = peek(vehicleId);
    if (!rec)
        return false;
    return Date.now() - (rec.lastFrameAt ?? rec.startedAt) > maxAgeMs;
}
