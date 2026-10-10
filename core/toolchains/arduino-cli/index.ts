// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * arduino-cli toolchain — Helm Scout's private installation, isolated from any
 * system Arduino IDE or arduino-cli the user may already have.
 *
 * Architectural rule (mirrors Helm Scout's Ollama isolation):
 *   Helm Scout sets ARDUINO_CONFIG_DIR / ARDUINO_DIRECTORIES_DATA /
 *   ARDUINO_DIRECTORIES_DOWNLOADS / ARDUINO_DIRECTORIES_USER to its private
 *   subdirs under <dataDir>/toolchains/arduino-cli/. Helm Scout's arduino-cli
 *   never touches ~/.arduino15. If the user has a system arduino-cli on
 *   PATH, Helm Scout uses it but still pins these env vars so it operates
 *   against Helm Scout's data, not the user's.
 */

export {
  buildArduinoCliEnv,
  ensureArduinoCliDirs,
  arduinoCliPaths,
} from "./env.js";
export { resolveArduinoCli, type ArduinoCliCommand } from "./resolve.js";
export {
  installArduinoCli,
  uninstallArduinoCli,
  type DownloadStage,
  type DownloadProgress,
  type ProgressCallback,
} from "./install.js";
