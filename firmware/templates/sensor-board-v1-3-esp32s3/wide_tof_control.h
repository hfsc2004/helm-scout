#pragma once
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2021-2022 STMicroelectronics. All rights reserved.
// Copyright (c) 2026 Pseudo Science Fiction.
// See VL53L5CX-LICENSE.md for redistribution terms.
#include <stdint.h>

// Explicit manual stop using the ST ULD's documented stop transaction sequence.
// Adafruit VL53L5CX 1.0.1 initializes is_auto_stop_enabled to 0, but its
// stop routine only issues the MCU stop when that field is 1. Do not change
// that private driver field or patch a machine-local library to work around it.
// Call with the existing board I2C mutex held and the device on ULD page 2.
template <class Driver>
bool stopWideTofHardware(Driver &driver) {
  auto *config = driver.getConfig();
  auto *platform = &config->platform;
  uint32_t autoStop = 0;
  uint8_t status = RdMulti(platform, 0x2ffc, reinterpret_cast<uint8_t *>(&autoStop), 4);
  if (status != 0) return false;
  status |= WrByte(platform, 0x7fff, 0);
  bool stopped = autoStop == 0x4ff;
  uint8_t state = 0;
  if (!stopped && status == 0) {
    status |= WrByte(platform, 0x15, 0x16);
    status |= WrByte(platform, 0x14, 1);
    for (unsigned attempt = 0; attempt < 500 && status == 0; ++attempt) {
      status |= RdByte(platform, 0x06, &state);
      if (status == 0 && (state & 0x80)) { stopped = true; break; }
      status |= WaitMs(platform, 10);
    }
  }
  if (status == 0 && stopped) {
    status |= RdByte(platform, 0x06, &state);
    if (status == 0 && (state & 0x80)) {
      uint8_t reason = 0;
      status |= RdByte(platform, 0x07, &reason);
      if (reason != 0x84 && reason != 0x85) stopped = false;
    }
  }
  // Restore the ULD's command registers and page even after a failed attempt.
  status |= WrByte(platform, 0x14, 0);
  status |= WrByte(platform, 0x15, 0);
  status |= WrByte(platform, 0x09, 4);
  status |= WrByte(platform, 0x7fff, 2);
  return status == 0 && stopped;
}

template <class Driver>
bool setWideTofPowerVerified(Driver &driver, uint8_t target) {
  auto *config = driver.getConfig();
  if (vl53l5cx_set_power_mode(config, target) != 0) return false;
  uint8_t actual = 255;
  return vl53l5cx_get_power_mode(config, &actual) == 0 && actual == target;
}

template <class Driver>
bool setWideTofMeasurement(Driver &driver, bool on) {
  if (!on) {
    uint8_t current = 255;
    if (vl53l5cx_get_power_mode(driver.getConfig(), &current) != 0) return false;
    if (current == VL53L5CX_POWER_MODE_SLEEP) return true;
    if (current != VL53L5CX_POWER_MODE_WAKEUP || !stopWideTofHardware(driver)) return false;
  }
  return setWideTofPowerVerified(driver, on ? VL53L5CX_POWER_MODE_WAKEUP : VL53L5CX_POWER_MODE_SLEEP) &&
    (!on || driver.startRanging());
}
