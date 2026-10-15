// SPDX-License-Identifier: Apache-2.0
#include "../../../firmware/templates/sensor-board-v1-3-esp32s3/wifi_failover.h"
#include <assert.h>
std::vector<bool> configurations;
void configure(bool secondary) { configurations.push_back(secondary); }
int main() {
  ScoutWifiFailover wifi;
  wifi.begin("primary", "secret-one", "secondary", "secret-two", configure);
  assert(WiFi.attempts.size() == 1 && WiFi.attempts[0] == "primary" && !configurations.back());
  testClock = 29999; wifi.poll(); assert(WiFi.attempts.size() == 1);
  testClock = 30000; wifi.poll(); assert(WiFi.attempts.back() == "secondary" && configurations.back());
  WiFi.currentStatus = WL_CONNECTED; wifi.poll(); testClock += 100000; wifi.poll();
  assert(WiFi.attempts.size() == 2); // Never interrupt a working secondary link.
  WiFi.currentStatus = 0; wifi.poll(); assert(WiFi.attempts.back() == "primary" && !wifi.secondary());
  testClock += 30000; wifi.poll(); assert(wifi.secondary());
  WiFi = TestWifi{}; configurations.clear(); testClock = UINT32_MAX - 10000;
  ScoutWifiFailover single;
  single.begin("primary", "secret", "", "unused", configure);
  testClock += 30000; single.poll(); // millis wrap remains safe.
  assert(WiFi.attempts.size() == 2 && WiFi.attempts.back() == "primary");
  assert(!single.secondary() && !configurations.back());
}
