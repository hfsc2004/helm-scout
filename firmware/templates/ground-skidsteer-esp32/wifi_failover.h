#pragma once
// SPDX-License-Identifier: Apache-2.0
// Keep this header identical in the three ESP32 firmware templates.
#include <WiFi.h>

class ScoutWifiFailover {
 public:
  void begin(const char *primarySsid, const char *primaryPassword,
             const char *secondarySsid, const char *secondaryPassword,
             void (*configureAddress)(bool)) {
    ssids[0] = primarySsid; passwords[0] = primaryPassword;
    ssids[1] = secondarySsid; passwords[1] = secondaryPassword;
    configure = configureAddress;
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(false); // This state machine owns reconnect attempts.
    start(false);
  }
  void poll() {
    if (WiFi.status() == WL_CONNECTED) { connected = true; return; }
    if (connected) { connected = false; start(hasSecondary() && !usingSecondary); }
    else if (static_cast<uint32_t>(millis() - attemptAt) >= 30000)
      start(hasSecondary() && !usingSecondary);
  }
  bool secondary() const { return usingSecondary; }
 private:
  const char *ssids[2] = {"", ""}, *passwords[2] = {"", ""};
  void (*configure)(bool) = nullptr;
  bool usingSecondary = false, connected = false;
  uint32_t attemptAt = 0;
  bool hasSecondary() const { return ssids[1] && ssids[1][0]; }
  void start(bool secondary) {
    usingSecondary = secondary;
    WiFi.disconnect(false, false);
    configure(usingSecondary);
    WiFi.begin(ssids[usingSecondary ? 1 : 0], passwords[usingSecondary ? 1 : 0]);
    attemptAt = millis();
    Serial.println(usingSecondary ? "Connecting secondary Wi-Fi" : "Connecting primary Wi-Fi");
  }
};
