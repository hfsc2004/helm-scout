#pragma once
// SPDX-License-Identifier: Apache-2.0
#include <stdint.h>
#include <stddef.h>
#include <math.h>
#include <stdlib.h>
#include <errno.h>

struct ImuSample {
  int16_t temperature = 0;
  int16_t accel[3] = {};
  int16_t gyro[3] = {};
  uint32_t sampledAt = 0;
  bool valid = false;
};

// Fixed, versioned NVS record. No pointers, Wi-Fi credentials, or OTA passwords.
struct BenchConfig {
  uint32_t version = 1;
  uint8_t enabled[4] = {1, 1, 1, 1};
  uint8_t frameSize = 1; // QVGA, VGA, SVGA, XGA, HD
  int16_t camera[10] = {12, 0, 0, 0, 1, 1, 1, 0, 300, 0};
  // quality, brightness, contrast, saturation, auto-WB, auto-exposure,
  // auto-gain, manual gain, manual exposure, mirror
  uint8_t wideProfile = 4; // detail, navigation, fast, inspect, idle
  uint8_t wideHz = 2;
  uint8_t narrowMode[2] = {2, 2}; // ST Short=1, Medium=2, Long=3
  uint8_t narrowAuto[2] = {1, 1};
  float accelBias[3] = {};
  float accelScale[3] = {1, 1, 1};
  float gyroCorrection[3] = {};
  int8_t axes[3] = {1, 2, 3}; // right-handed signed permutation of chip XYZ
  uint16_t proximityMm = 300;
  float tiltDeg = 30;
  float impactG = 2;
  float motionDps = 10;
  uint32_t checksum = 0;
};
inline uint32_t benchChecksum(const BenchConfig &c) {
  const uint8_t *p = reinterpret_cast<const uint8_t *>(&c);
  uint32_t hash = 2166136261u;
  for (size_t i = 0; i < offsetof(BenchConfig, checksum); ++i) hash = (hash ^ p[i]) * 16777619u;
  return hash;
}
inline bool benchInteger(const char *text, long low, long high, long &value) {
  if (!text || !*text) return false;
  errno = 0; char *end = nullptr;
  long parsed = strtol(text, &end, 10);
  if (errno || end == text || *end || parsed < low || parsed > high) return false;
  value = parsed; return true;
}
inline bool benchFloat(const char *text, float low, float high, float &value) {
  if (!text || !*text) return false;
  errno = 0; char *end = nullptr;
  float parsed = strtof(text, &end);
  if (errno || end == text || *end || !isfinite(parsed) || parsed < low || parsed > high) return false;
  value = parsed; return true;
}
inline bool benchValidAxes(const int8_t axes[3]) {
  int a = abs(axes[0]), b = abs(axes[1]), c = abs(axes[2]);
  if (a < 1 || a > 3 || b < 1 || b > 3 || c < 1 || c > 3 || a == b || b == c || a == c) return false;
  int inversions = (a > b) + (a > c) + (b > c);
  int sign = (axes[0] < 0 ? -1 : 1) * (axes[1] < 0 ? -1 : 1) * (axes[2] < 0 ? -1 : 1);
  return (inversions % 2 ? -sign : sign) == 1;
}
inline bool benchValid(const BenchConfig &c) {
  if (c.version != 1 || c.frameSize > 4 || c.wideProfile > 4 || !benchValidAxes(c.axes)) return false;
  const int minHz[] = {10, 10, 30, 5, 1}, maxHz[] = {10, 15, 60, 10, 2};
  if (c.wideHz < minHz[c.wideProfile] || c.wideHz > maxHz[c.wideProfile]) return false;
  const int low[] = {0,-2,-2,-2,0,0,0,0,0,0}, high[] = {63,2,2,2,1,1,1,30,1200,1};
  for (int i = 0; i < 10; ++i) if (c.camera[i] < low[i] || c.camera[i] > high[i]) return false;
  for (int i = 0; i < 4; ++i) if (c.enabled[i] > 1) return false;
  for (int i = 0; i < 2; ++i) if (c.narrowMode[i] < 1 || c.narrowMode[i] > 3 || c.narrowAuto[i] > 1) return false;
  for (int i = 0; i < 3; ++i) if (!isfinite(c.accelBias[i]) || fabsf(c.accelBias[i]) > 2 ||
    !isfinite(c.accelScale[i]) || c.accelScale[i] < 0.5f || c.accelScale[i] > 2 ||
    !isfinite(c.gyroCorrection[i]) || fabsf(c.gyroCorrection[i]) > 100) return false;
  return c.proximityMm >= 50 && c.proximityMm <= 4000 && isfinite(c.tiltDeg) && c.tiltDeg >= 5 && c.tiltDeg <= 85 &&
    isfinite(c.impactG) && c.impactG >= 1.2f && c.impactG <= 3.5f &&
    isfinite(c.motionDps) && c.motionDps >= 1 && c.motionDps <= 200;
}
inline void benchMap(const int8_t axes[3], const float chip[3], float output[3]) {
  for (int i = 0; i < 3; ++i) output[i] = chip[abs(axes[i]) - 1] * (axes[i] < 0 ? -1.0f : 1.0f);
}
