"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installVoice = installVoice;
/**
 * Install whisper.cpp + piper binaries and the default model set.
 *
 * Stubbed for v0.1: the real implementation will fetch from Helm Scout's GitHub
 * releases, verify checksums, extract under voicePaths.binaries() and
 * voicePaths.models(), and write a state.json declaring what's installed.
 */
async function installVoice() {
    throw new Error("voice install not implemented yet — v0.1 scaffolds the surface; the fetcher lands in v0.2");
}
