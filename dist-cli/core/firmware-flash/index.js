"use strict";
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
/**
 * Firmware flashing.
 *
 * Sketch templates live in <repo>/firmware/templates/<id>/. Each one
 * declares its target board, FQBN, core, and the variables a user needs
 * to fill in to flash it (WiFi creds, motor trims, etc.).
 *
 * The flash flow renders the sketch with the user's vars, ensures the
 * right arduino-cli core is installed, compiles, and uploads — every
 * subprocess registered with BMOC so shutdown reaps cleanly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.flash = exports.renderSketch = exports.loadTemplate = exports.listTemplates = void 0;
var templates_js_1 = require("./templates.js");
Object.defineProperty(exports, "listTemplates", { enumerable: true, get: function () { return templates_js_1.listTemplates; } });
Object.defineProperty(exports, "loadTemplate", { enumerable: true, get: function () { return templates_js_1.loadTemplate; } });
var render_js_1 = require("./render.js");
Object.defineProperty(exports, "renderSketch", { enumerable: true, get: function () { return render_js_1.renderSketch; } });
var flash_js_1 = require("./flash.js");
Object.defineProperty(exports, "flash", { enumerable: true, get: function () { return flash_js_1.flash; } });
