"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WIDE_TOF_PROFILES = void 0;
exports.isWideTofProfile = isWideTofProfile;
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Pseudo Science Fiction
exports.WIDE_TOF_PROFILES = {
    fast: { label: "Extended Reach", observedFeet: 6, resolution: 16, hz: 30, minHz: 30, maxHz: 60 },
    inspect: { label: "Far Detail", observedFeet: 5, resolution: 64, hz: 5, minHz: 5, maxHz: 10 },
    detail: { label: "Balanced Detail", observedFeet: 4, resolution: 64, hz: 10, minHz: 10, maxHz: 10 },
    navigation: { label: "Close Detail", observedFeet: 3, resolution: 64, hz: 15, minHz: 10, maxHz: 15 },
    idle: { label: "Low Power", observedFeet: 3, resolution: 16, hz: 2, minHz: 1, maxHz: 2 },
};
function isWideTofProfile(value) {
    return typeof value === "string" && Object.hasOwn(exports.WIDE_TOF_PROFILES, value);
}
