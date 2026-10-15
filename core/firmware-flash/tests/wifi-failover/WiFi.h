#pragma once
#include <stdint.h>
#include <string>
#include <vector>
inline uint32_t testClock = 0;
inline uint32_t millis() { return testClock; }
constexpr int WL_CONNECTED = 3, WIFI_STA = 1;
struct TestWifi {
  int currentStatus = 0;
  std::vector<std::string> attempts;
  void persistent(bool) {} void mode(int) {} void setAutoReconnect(bool) {}
  void disconnect(bool, bool) { currentStatus = 0; }
  void begin(const char *ssid, const char *) { attempts.emplace_back(ssid); }
  int status() { return currentStatus; }
};
inline TestWifi WiFi;
struct TestSerial { void println(const char *) {} };
inline TestSerial Serial;
