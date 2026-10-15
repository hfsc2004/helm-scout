// SPDX-License-Identifier: Apache-2.0
#include <stdint.h>
#include <string.h>
#include <assert.h>
constexpr uint8_t VL53L5CX_POWER_MODE_WAKEUP = 1, VL53L5CX_POWER_MODE_SLEEP = 0;
struct Platform {
  bool running = true, sleep = false, failWrite = false, neverStops = false, wrongReadback = false;
  uint8_t page = 2, stopKey = 0, reason = 0x84;
  uint32_t autoStop = 0, waits = 0;
  int stopRequests = 0;
};
struct Config { Platform platform; };
uint8_t RdMulti(Platform *p, uint16_t address, uint8_t *out, uint16_t size) {
  assert(address == 0x2ffc && size == 4 && p->page == 2);
  memcpy(out, &p->autoStop, 4); return 0;
}
uint8_t WrByte(Platform *p, uint16_t address, uint8_t value) {
  if (p->failWrite) return 1;
  if (address == 0x7fff) p->page = value;
  else {
    assert(p->page == 0);
    if (address == 0x15) p->stopKey = value;
    if (address == 0x14 && value == 1 && p->stopKey == 0x16) {
      ++p->stopRequests;
      if (!p->neverStops) p->running = false;
    }
  }
  return 0;
}
uint8_t RdByte(Platform *p, uint16_t address, uint8_t *out) {
  assert(p->page == 0);
  if (address == 6) *out = p->running ? 0 : 0x80;
  else { assert(address == 7); *out = p->reason; }
  return 0;
}
uint8_t WaitMs(Platform *p, uint32_t milliseconds) { p->waits += milliseconds; return 0; }
uint8_t vl53l5cx_set_power_mode(Config *c, uint8_t mode) {
  if (mode == VL53L5CX_POWER_MODE_SLEEP && c->platform.running) return 1;
  c->platform.sleep = mode == VL53L5CX_POWER_MODE_SLEEP; return 0;
}
uint8_t vl53l5cx_get_power_mode(Config *c, uint8_t *mode) {
  *mode = c->platform.wrongReadback && c->platform.sleep ? 99 : c->platform.sleep ? VL53L5CX_POWER_MODE_SLEEP : VL53L5CX_POWER_MODE_WAKEUP; return 0;
}
struct Driver {
  Config config; int starts = 0;
  Config *getConfig() { return &config; }
  bool startRanging() { assert(!config.platform.sleep); ++starts; config.platform.running = true; return true; }
};
#include "../../../firmware/templates/sensor-board-v1-3-esp32s3/wide_tof_control.h"
int main() {
  Driver driver;
  assert(setWideTofMeasurement(driver, false));
  assert(driver.config.platform.stopRequests == 1); // Default ULD flag must not skip the actual stop.
  assert(!driver.config.platform.running && driver.config.platform.sleep && driver.config.platform.page == 2);
  assert(setWideTofMeasurement(driver, false)); // Idempotent Off still verifies sleep.
  assert(driver.config.platform.stopRequests == 1);
  assert(setWideTofMeasurement(driver, true));
  assert(driver.starts == 1 && driver.config.platform.running && !driver.config.platform.sleep);
  Driver timeout; timeout.config.platform.neverStops = true;
  assert(!setWideTofMeasurement(timeout, false)); assert(timeout.config.platform.waits == 5000);
  assert(timeout.config.platform.running && !timeout.config.platform.sleep && timeout.config.platform.page == 2);
  Driver busError; busError.config.platform.failWrite = true; assert(!setWideTofMeasurement(busError, false));
  Driver readback; readback.config.platform.wrongReadback = true; assert(!setWideTofMeasurement(readback, false));
  Driver go2Error; go2Error.config.platform.reason = 0x99; assert(!setWideTofMeasurement(go2Error, false));
  Driver stopped; stopped.config.platform.running = false; stopped.config.platform.autoStop = 0x4ff;
  assert(stopWideTofHardware(stopped)); assert(stopped.config.platform.stopRequests == 0);
}
