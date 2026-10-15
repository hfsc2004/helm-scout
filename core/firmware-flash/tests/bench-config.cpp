// SPDX-License-Identifier: Apache-2.0
#include "../../../firmware/templates/sensor-board-v1-3-esp32s3/bench_config.h"
#include <assert.h>
#include <string.h>
#include <initializer_list>
int main() {
  BenchConfig config;
  assert(benchValid(config));
  config.checksum = benchChecksum(config);
  BenchConfig stored; memcpy(&stored, &config, sizeof(config));
  assert(stored.checksum == benchChecksum(stored) && benchValid(stored));
  stored.camera[0] = 64; assert(!benchValid(stored)); assert(stored.checksum != benchChecksum(stored));
  stored = config; stored.version = 2; assert(!benchValid(stored));
  stored = config; stored.wideHz = 60; assert(!benchValid(stored));
  stored.wideProfile = 2; assert(benchValid(stored));
  stored = config; stored.accelScale[1] = NAN; assert(!benchValid(stored));
  stored = config; stored.proximityMm = 0; assert(!benchValid(stored));
  long integer = 17;
  assert(benchInteger("-2", -2, 2, integer) && integer == -2);
  assert(!benchInteger("2x", -2, 2, integer)); assert(!benchInteger("", -2, 2, integer));
  assert(!benchInteger("999999999999999999999999", -2, 2, integer));
  float value = 0;
  assert(benchFloat("0.125", -2, 2, value) && value == 0.125f);
  for (const char *invalid : {"nan", "inf", "1foo", "", "1e999", "-3"}) assert(!benchFloat(invalid, -2, 2, value));
  int8_t rotation[] = {2, -1, 3}, reflection[] = {-1, 2, 3}, duplicate[] = {1, 1, 3}, zero[] = {0, 2, 3};
  assert(benchValidAxes(rotation)); assert(!benchValidAxes(reflection)); assert(!benchValidAxes(duplicate)); assert(!benchValidAxes(zero));
  float input[] = {1, 2, 3}, output[3]; benchMap(rotation, input, output);
  assert(output[0] == 2 && output[1] == -1 && output[2] == 3);
}
