"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Voice subsystem types, shared across processes.
 *
 * Voice in Helm Scout is optional. The user opts in (first-run wizard or
 * settings), Helm Scout downloads engine binaries + a default model set from its
 * own GitHub releases, and stores everything under one local folder.
 *
 * "Not installed" is a fully supported state — UI gates the mic, CLI reports
 * status truthfully, nothing else breaks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
