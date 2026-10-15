#pragma once
// SPDX-License-Identifier: Apache-2.0
// Firmware-only bench API. All handlers run on the existing diagnostic task.
const char *benchProfiles[] = {"detail", "navigation", "fast", "inspect", "idle"};
const framesize_t benchFrameSizes[] = {FRAMESIZE_QVGA, FRAMESIZE_VGA, FRAMESIZE_SVGA, FRAMESIZE_XGA, FRAMESIZE_HD};
const char *cameraControlNames[] = {"quality", "brightness", "contrast", "saturation", "whitebal", "exposure", "gain", "agcGain", "aecValue", "mirror"};
bool otaAccepted = false, otaComplete = false;
size_t otaWritten = 0;
esp_ota_handle_t benchOtaHandle = 0;
const esp_partition_t *benchOtaTarget = nullptr;
bool benchOtaWriteOk = false;
uint32_t otaFileCount = 0;
int otaHttpStatus = 400;
const char *otaFailure = "no firmware image received";

void benchReply(bool ok, const char *error = nullptr, int status = 200) {
  String body = "{\"ok\":" + String(ok ? "true" : "false");
  if (error) body += ",\"error\":\"" + String(error) + "\"";
  diagnosticServer.send(status, "application/json", body + "}");
}
void resetBenchImu() {
  imuSample = ImuSample{};
  imuCalibrationCount = 0; imuOrientationReady = false; imuIntegrationAt = 0;
  for (int i = 0; i < 3; ++i) imuGyroSum[i] = imuAccelSum[i] = imuGyroBias[i] = 0;
  imuOrientation[0] = 1;
  for (int i = 1; i < 4; ++i) imuOrientation[i] = 0;
}
int cameraControl(sensor_t *sensor, int index, int value) {
  int (*setters[])(sensor_t *, int) = {sensor->set_quality, sensor->set_brightness,
    sensor->set_contrast, sensor->set_saturation, sensor->set_whitebal,
    sensor->set_exposure_ctrl, sensor->set_gain_ctrl, sensor->set_agc_gain,
    sensor->set_aec_value, sensor->set_hmirror};
  return setters[index] ? setters[index](sensor, value) : -1;
}
void captureCameraConfig(BenchConfig &config, sensor_t *sensor) {
  for (int i = 0; i < 5; ++i) if (sensor->status.framesize == benchFrameSizes[i]) config.frameSize = i;
  const int values[] = {sensor->status.quality, sensor->status.brightness, sensor->status.contrast,
    sensor->status.saturation, sensor->status.awb, sensor->status.aec, sensor->status.agc,
    sensor->status.agc_gain, sensor->status.aec_value, sensor->status.hmirror};
  for (int i = 0; i < 10; ++i) config.camera[i] = values[i];
}
void loadBenchSettings() {
  benchBootId = esp_random();
  benchConfig.camera[0] = constrain(JPEG_QUALITY, 0, 63);
  benchConfig.camera[9] = CAMERA_MIRROR_DEFAULT;
  for (int i = 0; i < 5; ++i) if (selectedFrameSize() == benchFrameSizes[i]) benchConfig.frameSize = i;
  Preferences preferences;
  if (!preferences.begin("scout-bench", true)) return;
  BenchConfig loaded;
  const bool valid = preferences.getBytesLength("config") == sizeof(loaded) &&
    preferences.getBytes("config", &loaded, sizeof(loaded)) == sizeof(loaded) &&
    loaded.checksum == benchChecksum(loaded) && benchValid(loaded);
  preferences.end();
  if (valid) { benchConfig = loaded; savedSettingsLoaded = true; }
}
bool applyWideBenchConfig() {
  return wideTof.setResolution(benchConfig.wideProfile == 2 || benchConfig.wideProfile == 4 ? 16 : 64) &&
    wideTof.setRangingFrequency(benchConfig.wideHz) &&
    wideTof.setTargetOrder(VL53L5CX_TARGET_ORDER_STRONGEST) &&
    wideTof.setRangingMode(benchConfig.wideProfile == 4 ? VL53L5CX_RANGING_MODE_AUTONOMOUS : VL53L5CX_RANGING_MODE_CONTINUOUS) &&
    (benchConfig.wideProfile != 4 || wideTof.setIntegrationTime(5));
}
void applyBenchSettings() {
  if (!savedSettingsLoaded) return;
  if (cameraReady && xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(2000)) == pdTRUE) {
    sensor_t *sensor = esp_camera_sensor_get();
    bool ok = sensor && sensor->set_framesize(sensor, benchFrameSizes[benchConfig.frameSize]) == 0;
    if (sensor) for (int i = 0; i < 10; ++i) if (cameraControl(sensor, i, benchConfig.camera[i]) != 0) ok = false;
    if (sensor) cameraMirrored = sensor->status.hmirror;
    savedSettingsApplyOk &= ok;
    xSemaphoreGive(cameraMutex);
  } else savedSettingsApplyOk = false;
  if (wideTofReady) {
    bool ok = stopWideTofHardware(wideTof) && applyWideBenchConfig() && wideTof.startRanging();
    wideTofReady = ok;
    savedSettingsApplyOk &= ok;
    if (ok) {
      wideProfile = benchProfiles[benchConfig.wideProfile]; wideFrequencyHz = benchConfig.wideHz;
      wideResolution = benchConfig.wideProfile == 2 || benchConfig.wideProfile == 4 ? 16 : 64;
      wideAutonomous = benchConfig.wideProfile == 4;
    }
  }
  frontTofMode = static_cast<VL53L1_DistanceModes>(benchConfig.narrowMode[0]);
  rearTofMode = static_cast<VL53L1_DistanceModes>(benchConfig.narrowMode[1]);
  frontTofAuto = benchConfig.narrowAuto[0]; rearTofAuto = benchConfig.narrowAuto[1];
  if (frontTofReady) { frontTofReady = configureNarrowPhase(frontTof, frontTofSample, frontTofMode, false, true) == VL53L1_ERROR_NONE; savedSettingsApplyOk &= frontTofReady; }
  if (rearTofReady) { rearTofReady = configureNarrowPhase(rearTof, rearTofSample, rearTofMode, false, true) == VL53L1_ERROR_NONE; savedSettingsApplyOk &= rearTofReady; }
  const char *names[] = {"front", "rear", "wide", "imu"};
  for (int i = 0; i < 4; ++i) if (!benchConfig.enabled[i]) savedSettingsApplyOk &= setSensorEnabled(names[i], false);
}
void benchSettings() {
  if (diagnosticServer.method() == HTTP_GET) {
    diagnosticServer.send(200, "application/json", "{\"ok\":true,\"version\":1,\"loaded\":" + String(savedSettingsLoaded ? "true" : "false") +
      ",\"bootApplyOk\":" + String(savedSettingsApplyOk ? "true" : "false") + ",\"saveExplicit\":true,\"restoreRequiresReboot\":true}");
    return;
  }
  const String action = diagnosticServer.arg("action");
  if (action != "save" && action != "defaults") { benchReply(false, "action must be save or defaults", 400); return; }
  if (unoDriveActive || speakerPcmStreaming) { benchReply(false, "stop drive and speaker activity first", 409); return; }
  BenchConfig next = benchConfig;
  if (action == "save") {
    if (!cameraReady || xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(2000)) != pdTRUE) { benchReply(false, "camera busy or unavailable", 503); return; }
    sensor_t *sensor = esp_camera_sensor_get();
    if (sensor) captureCameraConfig(next, sensor);
    xSemaphoreGive(cameraMutex);
    if (!sensor) { benchReply(false, "camera unavailable", 503); return; }
    const bool states[] = {frontTofEnabled, rearTofEnabled, wideTofEnabled, imuEnabled};
    for (int i = 0; i < 4; ++i) next.enabled[i] = states[i];
    for (int i = 0; i < 5; ++i) if (String(wideProfile) == benchProfiles[i]) next.wideProfile = i;
    next.wideHz = wideFrequencyHz;
    next.narrowMode[0] = frontTofMode; next.narrowMode[1] = rearTofMode;
    next.narrowAuto[0] = frontTofAuto; next.narrowAuto[1] = rearTofAuto;
    if (!benchValid(next)) { benchReply(false, "current settings cannot be saved", 409); return; }
    next.checksum = benchChecksum(next);
  }
  Preferences preferences;
  if (!preferences.begin("scout-bench", false)) { benchReply(false, "settings storage unavailable", 503); return; }
  const bool ok = action == "save" ? preferences.putBytes("config", &next, sizeof(next)) == sizeof(next) : preferences.clear();
  preferences.end();
  benchReply(ok, ok ? nullptr : "settings storage failed", ok ? 200 : 503);
}
void benchCamera() {
  const bool write = diagnosticServer.method() == HTTP_POST;
  long value = 0; int index = -1;
  if (write) {
    for (int i = 0; i < 10; ++i) if (diagnosticServer.arg("control") == cameraControlNames[i]) index = i;
    const int low[] = {0,-2,-2,-2,0,0,0,0,0,0}, high[] = {63,2,2,2,1,1,1,30,1200,1};
    if (index < 0 || !benchInteger(diagnosticServer.arg("value").c_str(), low[index], high[index], value)) {
      benchReply(false, "unknown camera control or value outside its range", 400); return;
    }
  }
  if (!cameraReady || xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(2000)) != pdTRUE) { benchReply(false, "camera busy or unavailable", 503); return; }
  sensor_t *sensor = esp_camera_sensor_get();
  const bool ok = sensor && (!write || cameraControl(sensor, index, value) == 0);
  BenchConfig actual = benchConfig;
  if (sensor) { captureCameraConfig(actual, sensor); cameraMirrored = sensor->status.hmirror; }
  if (ok && write) for (int i = 0; i < 2; ++i) { camera_fb_t *fb = esp_camera_fb_get(); if (fb) esp_camera_fb_return(fb); }
  xSemaphoreGive(cameraMutex);
  if (!ok) { benchReply(false, "camera sensor does not support or rejected this control", 503); return; }
  String body = "{\"ok\":true,\"controls\":{";
  for (int i = 0; i < 10; ++i) { if (i) body += ','; body += "\"" + String(cameraControlNames[i]) + "\":" + String(actual.camera[i]); }
  diagnosticServer.send(200, "application/json", body + "}}");
}

// Reinitialize at assigned addresses only; never reset other devices or guess pins.
void benchRecover() {
  const String name = diagnosticServer.arg("sensor");
  if (name != "front" && name != "rear" && name != "wide" && name != "imu") { benchReply(false, "sensor must be front, rear, wide, or imu", 400); return; }
  if (unoDriveActive || speakerPcmStreaming) { benchReply(false, "stop drive and speaker activity first", 409); return; }
  bool ok = false;
  if (name == "front" || name == "rear") {
    const bool front = name == "front";
    VL53L1 &sensor = front ? frontTof : rearTof;
    bool &ready = front ? frontTofReady : rearTofReady;
    bool &initialized = front ? frontTofInitialized : rearTofInitialized;
    const bool enabled = front ? frontTofEnabled : rearTofEnabled;
    NarrowTofSample &sample = front ? frontTofSample : rearTofSample;
    ready = false; sample = NarrowTofSample{};
    if (i2cPresent(front ? FRONT_TOF_ADDRESS : REAR_TOF_ADDRESS)) {
      sensor.VL53L1_StopMeasurement();
      ok = sensor.VL53L1_DataInit() == VL53L1_ERROR_NONE && sensor.VL53L1_StaticInit() == VL53L1_ERROR_NONE &&
        configureNarrowPhase(sensor, sample, front ? frontTofMode : rearTofMode, false, false) == VL53L1_ERROR_NONE;
      if (ok && !enabled) ok = sensor.VL53L1_StopMeasurement() == VL53L1_ERROR_NONE;
    }
    initialized = ok; ready = ok && enabled;
    if (front) frontTofInvalidSince = 0; else rearTofInvalidSince = 0;
  } else if (name == "wide") {
    wideTofReady = false; wideHasFrame = false; wideResults = {}; wideFramePeriodMs = 0;
    if (!wideTofInitialized) { benchReply(false, "wide sensor did not initialize; check hardware and reboot", 503); return; }
    if (wideTofEnabled) stopWideTofHardware(wideTof);
    // Re-upload the wide sensor's firmware through its documented driver.
    BenchConfig desired = benchConfig;
    for (int i = 0; i < 5; ++i) if (String(wideProfile) == benchProfiles[i]) desired.wideProfile = i;
    desired.wideHz = wideFrequencyHz;
    BenchConfig saved = benchConfig; benchConfig = desired;
    ok = wideTof.begin(0x29, &Wire, 400000) && applyWideBenchConfig() && (wideTofEnabled ? wideTof.startRanging() : setWideTofPowerVerified(wideTof, VL53L5CX_POWER_MODE_SLEEP));
    benchConfig = saved;
    wideTofInitialized = ok; wideTofReady = ok && wideTofEnabled;
  } else {
    imuReady = false; resetBenchImu();
    initImu(); ok = imuReady;
    if (ok && !imuEnabled) {
      uint8_t power = 255;
      ok = writeRegister8(IMU_ADDRESS, 0x1F, 0) && readRegister8(IMU_ADDRESS, 0x1F, &power) && power == 0;
    }
    imuReady = ok && imuEnabled;
  }
  benchReply(ok, ok ? nullptr : "sensor recovery failed; check hardware or reboot", ok ? 200 : 503);
}

void benchCalibration() {
  if (diagnosticServer.method() == HTTP_POST) {
    BenchConfig next = benchConfig;
    bool any = false;
    for (int axis = 0; axis < 3; ++axis) {
      const char *suffix[] = {"X", "Y", "Z"};
      const char *prefix[] = {"accelBias", "accelScale", "gyroBias"};
      float *fields[] = {next.accelBias, next.accelScale, next.gyroCorrection};
      const float low[] = {-2, 0.5f, -100}, high[] = {2, 2, 100};
      for (int kind = 0; kind < 3; ++kind) {
        const String key = String(prefix[kind]) + suffix[axis];
        if (!diagnosticServer.hasArg(key)) continue;
        any = true;
        if (!benchFloat(diagnosticServer.arg(key).c_str(), low[kind], high[kind], fields[kind][axis])) { benchReply(false, "invalid calibration value", 400); return; }
      }
      const String key = "axis" + String(suffix[axis]);
      if (diagnosticServer.hasArg(key)) {
        long value = 0; any = true;
        if (!benchInteger(diagnosticServer.arg(key).c_str(), -3, 3, value)) { benchReply(false, "invalid axis mapping", 400); return; }
        next.axes[axis] = value;
      }
    }
    if (!any || !benchValid(next)) { benchReply(false, "provide calibration values and a right-handed XYZ axis mapping", 400); return; }
    benchConfig = next; resetBenchImu();
  }
  String body = "{\"ok\":true,\"units\":{\"accelBias\":\"g\",\"gyroBias\":\"dps\"},\"saveRequired\":true";
  const char *names[] = {"accelBias", "accelScale", "gyroBias"};
  const float *fields[] = {benchConfig.accelBias, benchConfig.accelScale, benchConfig.gyroCorrection};
  for (int kind = 0; kind < 3; ++kind) {
    body += ",\"" + String(names[kind]) + "\":[";
    for (int axis = 0; axis < 3; ++axis) { if (axis) body += ','; body += String(fields[kind][axis], 6); }
    body += ']';
  }
  body += ",\"axes\":[" + String(benchConfig.axes[0]) + ',' + String(benchConfig.axes[1]) + ',' + String(benchConfig.axes[2]) + "]}";
  diagnosticServer.send(200, "application/json", body);
}

struct BenchEvent { uint32_t sequence = 0, atMs = 0; uint8_t kind = 0, sensor = 0; bool active = false; float value = 0; };
BenchEvent benchEvents[32];
uint32_t benchEventSequence = 0, benchEventPollAt = 0;
bool benchConditions[6] = {};
const char *benchEventKinds[] = {"proximity", "tilt", "impact", "motion"};
const char *benchSensorNames[] = {"front", "rear", "wide", "imu"};
void benchCondition(int slot, bool active, int kind, int sensor, float value) {
  if (benchConditions[slot] == active) return;
  benchConditions[slot] = active;
  BenchEvent &event = benchEvents[benchEventSequence % 32];
  event.sequence = ++benchEventSequence; event.atMs = millis();
  event.kind = kind; event.sensor = sensor; event.active = active; event.value = value;
}
void pollBenchEvents() {
  const uint32_t now = millis();
  if (now - rateSampledAt >= 1000) {
    const float seconds = (now - rateSampledAt) / 1000.0f;
    for (int i = 0; i < 4; ++i) {
      sensorHz[i] = (sensorFrames[i] - sensorRateBaseline[i]) / seconds;
      sensorRateBaseline[i] = sensorFrames[i];
    }
    rateSampledAt = now;
  }
  if (now - benchEventPollAt < 20) return;
  benchEventPollAt = now;
  const NarrowTofSample *narrow[] = {&frontTofSample, &rearTofSample};
  const bool ready[] = {frontTofReady, rearTofReady};
  for (int i = 0; i < 2; ++i) {
    const NarrowTofZone &zone = narrow[i]->zones[0];
    if (ready[i] && zone.hasFrame && now - zone.sampledAt < 1500 && zone.rangeStatus == VL53L1_RANGESTATUS_RANGE_VALID && zone.distanceMm > 0)
      benchCondition(i, zone.distanceMm < benchConfig.proximityMm + (benchConditions[i] ? 50 : 0), 0, i, zone.distanceMm);
    else benchConditions[i] = false; // Missing data is never a clear-path event.
  }
  uint16_t nearest = UINT16_MAX;
  if (wideTofReady && wideHasFrame && now - wideCapturedAt < 1500) {
    for (int i = 0; i < wideResolution; ++i) if ((wideResults.target_status[i] == 5 || wideResults.target_status[i] == 9) &&
      wideResults.distance_mm[i] > 0) nearest = min(nearest, static_cast<uint16_t>(wideResults.distance_mm[i]));
  }
  if (nearest != UINT16_MAX) benchCondition(2, nearest < benchConfig.proximityMm + (benchConditions[2] ? 50 : 0), 0, 2, nearest);
  else benchConditions[2] = false;
  if (imuEnabled && imuReady && imuSample.valid && now - imuSample.sampledAt < 500) {
    float norm = 0, motion = 0;
    for (int i = 0; i < 3; ++i) { norm += calibratedAccel[i] * calibratedAccel[i]; motion += (calibratedGyro[i] - imuGyroBias[i]) * (calibratedGyro[i] - imuGyroBias[i]); }
    norm = sqrtf(norm); motion = sqrtf(motion);
    if (imuOrientationReady) {
      // Relative orientation angle (including yaw) is not a tilt measurement.
      // Rotate boot gravity into the current frame and compare it with boot gravity.
      const float w = imuOrientation[0], x = -imuOrientation[1], y = -imuOrientation[2], z = -imuOrientation[3];
      const float gx = imuGravityReference[0], gy = imuGravityReference[1], gz = imuGravityReference[2];
      const float tx = 2 * (y * gz - z * gy), ty = 2 * (z * gx - x * gz), tz = 2 * (x * gy - y * gx);
      const float dot = gx * (gx + w * tx + y * tz - z * ty) + gy * (gy + w * ty + z * tx - x * tz) + gz * (gz + w * tz + x * ty - y * tx);
      const float tilt = acosf(constrain(dot, -1.0f, 1.0f)) * 180.0f / PI;
      benchCondition(3, tilt > benchConfig.tiltDeg - (benchConditions[3] ? 3 : 0), 1, 3, tilt);
    } else benchConditions[3] = false;
    benchCondition(4, norm > benchConfig.impactG - (benchConditions[4] ? 0.1f : 0), 2, 3, norm);
    benchCondition(5, motion > benchConfig.motionDps - (benchConditions[5] ? 1 : 0), 3, 3, motion);
  } else for (int i = 3; i < 6; ++i) benchConditions[i] = false;
}
void benchEventApi() {
  if (diagnosticServer.method() == HTTP_POST) {
    BenchConfig next = benchConfig; bool any = false; long mm = 0;
    if (diagnosticServer.hasArg("proximityMm")) {
      any = true;
      if (!benchInteger(diagnosticServer.arg("proximityMm").c_str(), 50, 4000, mm)) { benchReply(false, "invalid proximity threshold", 400); return; }
      next.proximityMm = mm;
    }
    const char *names[] = {"tiltDeg", "impactG", "motionDps"};
    float *fields[] = {&next.tiltDeg, &next.impactG, &next.motionDps};
    const float low[] = {5, 1.2f, 1}, high[] = {85, 3.5f, 200};
    for (int i = 0; i < 3; ++i) if (diagnosticServer.hasArg(names[i])) {
      any = true;
      if (!benchFloat(diagnosticServer.arg(names[i]).c_str(), low[i], high[i], *fields[i])) { benchReply(false, "invalid event threshold", 400); return; }
    }
    if (!any) { benchReply(false, "provide event thresholds", 400); return; }
    benchConfig = next;
  }
  long after = 0;
  if (diagnosticServer.hasArg("after") && !benchInteger(diagnosticServer.arg("after").c_str(), 0, INT32_MAX, after)) { benchReply(false, "invalid event cursor", 400); return; }
  const uint32_t oldest = benchEventSequence > 32 ? benchEventSequence - 31 : 1;
  String body = "{\"ok\":true,\"bootId\":" + String(benchBootId) + ",\"latest\":" + String(benchEventSequence) +
    ",\"oldest\":" + String(oldest) + ",\"gap\":" + String(after && static_cast<uint32_t>(after) + 1 < oldest ? "true" : "false") +
    ",\"thresholds\":{\"proximityMm\":" + String(benchConfig.proximityMm) + ",\"tiltDeg\":" + String(benchConfig.tiltDeg) +
    ",\"impactG\":" + String(benchConfig.impactG) + ",\"motionDps\":" + String(benchConfig.motionDps) + "},\"events\":[";
  bool comma = false;
  for (uint32_t sequence = oldest; sequence <= benchEventSequence; ++sequence) {
    if (sequence <= static_cast<uint32_t>(after)) continue;
    const BenchEvent &event = benchEvents[(sequence - 1) % 32];
    if (comma) body += ','; comma = true;
    body += "{\"sequence\":" + String(event.sequence) + ",\"atMs\":" + String(event.atMs) + ",\"type\":\"" + benchEventKinds[event.kind] +
      "\",\"sensor\":\"" + benchSensorNames[event.sensor] + "\",\"active\":" + String(event.active ? "true" : "false") + ",\"value\":" + String(event.value, 3) + "}";
  }
  diagnosticServer.send(200, "application/json", body + "]}");
}

void benchSystem() {
  const esp_partition_t *running = esp_ota_get_running_partition(), *next = esp_ota_get_next_update_partition(nullptr);
  String body = "{\"ok\":true,\"firmware\":\"bench-13\",\"build\":\"" __DATE__ " " __TIME__ "\",\"bootId\":" + String(benchBootId) +
    ",\"uptimeMs\":" + String(millis()) + ",\"resetReason\":" + String(static_cast<int>(esp_reset_reason())) +
    ",\"freeHeap\":" + String(ESP.getFreeHeap()) + ",\"minimumFreeHeap\":" + String(ESP.getMinFreeHeap()) +
    ",\"largestFreeBlock\":" + String(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)) +
    ",\"psramTotal\":" + String(ESP.getPsramSize()) + ",\"psramFree\":" + String(ESP.getFreePsram()) +
    ",\"i2cHelperErrors\":" + String(i2cErrors) + ",\"cameraFrames\":" + String(cameraFrames) + ",\"sensors\":[";
  const bool enabled[] = {frontTofEnabled, rearTofEnabled, wideTofEnabled, imuEnabled};
  const bool ready[] = {frontTofReady, rearTofReady, wideTofReady, imuReady};
  const uint32_t timestamps[] = {frontTofSample.lastDataAt, rearTofSample.lastDataAt, wideCapturedAt, imuSample.sampledAt};
  for (int i = 0; i < 4; ++i) {
    if (i) body += ',';
    body += "{\"name\":\"" + String(benchSensorNames[i]) + "\",\"enabled\":" + String(enabled[i] ? "true" : "false") +
      ",\"ready\":" + String(ready[i] ? "true" : "false") + ",\"frames\":" + String(sensorFrames[i]) +
      ",\"hz\":" + String(sensorHz[i], 2) + ",\"driverErrors\":" + String(sensorErrors[i]) + ",\"ageMs\":" +
      (timestamps[i] ? String(millis() - timestamps[i]) : String("null")) + "}";
  }
  body += "],\"ota\":{\"passwordConfigured\":" + String(strlen(OTA_PASSWORD) >= 12 ? "true" : "false") +
    ",\"available\":" + String(next && running && next->address != running->address ? "true" : "false") +
    ",\"runningPartition\":\"" + String(running ? running->label : "unknown") + "\",\"slotBytes\":" + String(next ? next->size : 0) +
    ",\"manualRollbackAvailable\":" + String(esp_ota_check_rollback_is_possible() ? "true" : "false") + ",\"automaticRollback\":false}}";
  diagnosticServer.send(200, "application/json", body);
}
void benchSamples() {
  // Cached records share one response timestamp, but retain acquisition times.
  String body = "{\"ok\":true,\"bootId\":" + String(benchBootId) + ",\"atUs\":" + String(static_cast<unsigned long long>(esp_timer_get_time())) + ",\"ranges\":[";
  const NarrowTofZone *zones[] = {&frontTofSample.zones[0], &rearTofSample.zones[0]};
  const bool ready[] = {frontTofReady, rearTofReady};
  for (int i = 0; i < 2; ++i) {
    const NarrowTofZone &zone = *zones[i];
    const bool valid = ready[i] && zone.hasFrame && zone.rangeStatus == VL53L1_RANGESTATUS_RANGE_VALID && zone.distanceMm > 0 && millis() - zone.sampledAt < 1500;
    if (i) body += ',';
    body += "{\"sensor\":\"" + String(benchSensorNames[i]) + "\",\"sampledAtMs\":" + String(zone.sampledAt) +
      ",\"valid\":" + String(valid ? "true" : "false") + ",\"distanceMm\":" + (valid ? String(zone.distanceMm) : String("null")) + "}";
  }
  body += "],\"wide\":{\"sequence\":" + String(wideFrameSequence) + ",\"sampledAtMs\":" + String(wideCapturedAt) +
    ",\"valid\":" + String(wideTofReady && wideHasFrame && millis() - wideCapturedAt < 1500 ? "true" : "false") + "},\"imu\":{\"sampledAtMs\":" + String(imuSample.sampledAt) + ",\"valid\":";
  const bool valid = imuEnabled && imuReady && imuSample.valid && millis() - imuSample.sampledAt < 500;
  body += String(valid ? "true" : "false") + ",\"accelG\":";
  if (valid) body += '[' + String(calibratedAccel[0], 5) + ',' + String(calibratedAccel[1], 5) + ',' + String(calibratedAccel[2], 5) + ']';
  else body += "null";
  body += ",\"gyroDps\":";
  if (valid) body += '[' + String(calibratedGyro[0], 5) + ',' + String(calibratedGyro[1], 5) + ',' + String(calibratedGyro[2], 5) + ']';
  else body += "null";
  diagnosticServer.send(200, "application/json", body + "}}");
}
void benchSelfTest() {
  // Non-destructive checks; disabled devices are reported as disabled, not failed.
  uint8_t identity = 0, power = 255;
  const bool imuId = readRegister8(IMU_ADDRESS, 0x75, &identity) && identity == IMU_WHO_AM_I;
  const bool imuPower = readRegister8(IMU_ADDRESS, 0x1F, &power) && power == (imuEnabled ? 0x0f : 0);
  const bool address[] = {i2cPresent(FRONT_TOF_ADDRESS), i2cPresent(REAR_TOF_ADDRESS), i2cPresent(0x29), imuId && imuPower};
  const bool enabled[] = {frontTofEnabled, rearTofEnabled, wideTofEnabled, imuEnabled};
  const bool ready[] = {frontTofReady, rearTofReady, wideTofReady, imuReady};
  const uint32_t timestamps[] = {frontTofSample.lastDataAt, rearTofSample.lastDataAt, wideCapturedAt, imuSample.sampledAt};
  bool pass = true; String tests = "[";
  for (int i = 0; i < 4; ++i) {
    bool fresh = ready[i] && timestamps[i] && millis() - timestamps[i] < (i == 3 ? 500 : 2000);
    const bool ok = address[i] && (!enabled[i] || fresh); pass &= ok;
    if (i) tests += ',';
    tests += "{\"sensor\":\"" + String(benchSensorNames[i]) + "\",\"enabled\":" + String(enabled[i] ? "true" : "false") +
      ",\"addressOk\":" + String(address[i] ? "true" : "false") + ",\"fresh\":" + String(fresh ? "true" : "false") + ",\"pass\":" + String(ok ? "true" : "false") + "}";
  }
  diagnosticServer.send(200, "application/json", "{\"ok\":true,\"pass\":" + String(pass ? "true" : "false") +
    ",\"uptimeMs\":" + String(millis()) + ",\"nonDestructive\":true,\"tests\":" + tests + "]}");
}

bool benchOtaAuth() {
  const String origin = diagnosticServer.header("Origin");
  return (!origin.length() || origin == "http://" + diagnosticServer.header("Host")) &&
    strlen(OTA_PASSWORD) >= 12 && diagnosticServer.authenticate("scout", OTA_PASSWORD);
}
void benchOtaUpload() {
  HTTPUpload &upload = diagnosticServer.upload();
  if (upload.status == UPLOAD_FILE_START) {
    if (++otaFileCount != 1) {
      otaComplete = false; otaHttpStatus = 400; otaFailure = "only one firmware file is allowed";
      benchOtaTarget = nullptr;
      return;
    }
    otaAccepted = otaComplete = false; otaWritten = 0;
    otaHttpStatus = 400; otaFailure = "no firmware image received";
    if (!benchOtaAuth()) { otaHttpStatus = 403; otaFailure = "OTA requires configured password and authentication"; return; }
    if (upload.name != "firmware") { otaFailure = "multipart field must be firmware"; return; }
    if (unoDriveActive || speakerPcmStreaming || micTraceRunning || micActivityActive) { otaHttpStatus = 409; otaFailure = "stop drive, speaker, and microphone investigations before OTA"; return; }
    const esp_partition_t *running = esp_ota_get_running_partition(), *next = esp_ota_get_next_update_partition(nullptr);
    if (!next || !running || next->address == running->address) { otaHttpStatus = 409; otaFailure = "wired flash with OTA partitions required"; return; }
    if (xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(2000)) != pdTRUE) { otaHttpStatus = 503; otaFailure = "camera busy"; return; }
    // Keep camera capture and speaker flash/cache traffic out of the update window.
    if (speakerControlMutex && xSemaphoreTake(speakerControlMutex, 0) != pdTRUE) { xSemaphoreGive(cameraMutex); otaHttpStatus = 409; otaFailure = "speaker busy"; return; }
    if (unoUartReady) unoSendWithoutReply(110);
    benchOtaTarget = next;
    benchOtaWriteOk = true;
    otaAccepted = esp_ota_begin(next, OTA_SIZE_UNKNOWN, &benchOtaHandle) == ESP_OK;
    if (!otaAccepted) {
      if (speakerControlMutex) xSemaphoreGive(speakerControlMutex);
      xSemaphoreGive(cameraMutex); otaHttpStatus = 503; otaFailure = "OTA initialization failed";
    }
  } else if (otaAccepted && upload.status == UPLOAD_FILE_WRITE) {
    if (benchOtaWriteOk && esp_ota_write(benchOtaHandle, upload.buf, upload.currentSize) == ESP_OK) otaWritten += upload.currentSize;
    else { benchOtaWriteOk = false; otaFailure = "image write failed"; otaHttpStatus = 400; }
  } else if (otaAccepted && (upload.status == UPLOAD_FILE_END || upload.status == UPLOAD_FILE_ABORTED)) {
    const bool ended = upload.status == UPLOAD_FILE_END && otaWritten > 0 && benchOtaWriteOk;
    otaComplete = ended && esp_ota_end(benchOtaHandle) == ESP_OK;
    if (!ended) esp_ota_abort(benchOtaHandle);
    if (!otaComplete) { benchOtaTarget = nullptr; otaHttpStatus = 400; otaFailure = "image incomplete or verification failed"; }
    if (speakerControlMutex) xSemaphoreGive(speakerControlMutex);
    xSemaphoreGive(cameraMutex); otaAccepted = false;
    if (upload.status == UPLOAD_FILE_ABORTED) otaFileCount = 0;
  }
}
void benchOtaFinish() {
  const bool oneFile = otaFileCount == 1;
  otaFileCount = 0;
  if (!benchOtaAuth()) { benchReply(false, "OTA disabled or authentication failed", 403); return; }
  if (!otaComplete || !oneFile || !benchOtaTarget) { otaComplete = false; benchReply(false, otaFailure, otaHttpStatus); return; }
  otaComplete = false;
  if (esp_ota_set_boot_partition(benchOtaTarget) != ESP_OK) { benchReply(false, "could not select verified firmware", 503); return; }
  diagnosticServer.sendHeader("Connection", "close");
  diagnosticServer.send(200, "application/json", "{\"ok\":true,\"rebooting\":true}");
  delay(200); ESP.restart();
}
void benchOtaRollback() {
  if (!benchOtaAuth()) { benchReply(false, "OTA disabled or authentication failed", 403); return; }
  if (unoDriveActive || speakerPcmStreaming || micTraceRunning || micActivityActive) { benchReply(false, "stop board activity before rollback", 409); return; }
  if (!esp_ota_check_rollback_is_possible()) { benchReply(false, "no previous bootable image", 409); return; }
  const esp_err_t error = esp_ota_mark_app_invalid_rollback();
  if (error != ESP_OK) { benchReply(false, "rollback selection failed", 503); return; }
  if (unoUartReady) unoSendWithoutReply(110);
  diagnosticServer.send(200, "application/json", "{\"ok\":true,\"rebooting\":true}");
  delay(200); ESP.restart();
}
void registerBenchApi() {
  diagnosticServer.on("/system", HTTP_GET, benchSystem);
  diagnosticServer.on("/samples", HTTP_GET, benchSamples);
  diagnosticServer.on("/settings", HTTP_GET, benchSettings);
  diagnosticServer.on("/settings", HTTP_POST, benchSettings);
  diagnosticServer.on("/camera/controls", HTTP_GET, benchCamera);
  diagnosticServer.on("/camera/controls", HTTP_POST, benchCamera);
  diagnosticServer.on("/sensors/recover", HTTP_POST, benchRecover);
  diagnosticServer.on("/imu/calibration", HTTP_GET, benchCalibration);
  diagnosticServer.on("/imu/calibration", HTTP_POST, benchCalibration);
  diagnosticServer.on("/events", HTTP_GET, benchEventApi);
  diagnosticServer.on("/events", HTTP_POST, benchEventApi);
  diagnosticServer.on("/self-test", HTTP_GET, benchSelfTest);
  const char *headers[] = {"Origin", "Host"};
  diagnosticServer.collectHeaders(headers, 2);
  diagnosticServer.on("/ota", HTTP_POST, benchOtaFinish, benchOtaUpload);
  diagnosticServer.on("/ota/rollback", HTTP_POST, benchOtaRollback);
}
