"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * LLM subsystem types, shared across processes.
 *
 * Helm Scout runs its own private Ollama instance. It does not touch the
 * system Ollama daemon. The isolation contract is non-negotiable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
