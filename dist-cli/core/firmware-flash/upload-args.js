"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUploadArgs = buildUploadArgs;
// SPDX-License-Identifier: Apache-2.0
/** ESP32's upload recipe consumes upload.erase_cmd; arduino-cli has no --erase flag. */
function buildUploadArgs(baseArgs, fqbn, port, sketchDir, eraseBeforeUpload = false) {
    if (eraseBeforeUpload && !fqbn.startsWith("esp32:esp32:")) {
        throw new Error("Erase before Flash is supported only for Espressif ESP32 boards.");
    }
    const args = [...baseArgs, "upload", "--fqbn", fqbn, "--port", port];
    if (eraseBeforeUpload)
        args.push("--upload-property", "upload.erase_cmd=-e");
    return [...args, sketchDir];
}
