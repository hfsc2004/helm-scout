// SPDX-License-Identifier: Apache-2.0
import type { Vehicle } from "../../shared/vehicle-contract.js";
import { CAMERA_CONTROLS, type BenchRequest, type BenchResponse } from "../../shared/bench.js";

export function benchUrl(vehicle: Vehicle, path: string): URL {
  if (vehicle.sensorBoardRevision !== "1.3" || !vehicle.camera) throw new Error("Select a configured v1.3 sensor board.");
  const url = new URL(path, vehicle.camera.baseUrl);
  if (url.protocol !== "http:") throw new Error("Sensor-board controls require HTTP.");
  url.port = "82";
  return url;
}
export async function benchRequest(vehicle: Vehicle, req: Omit<BenchRequest, "vehicleId">): Promise<BenchResponse> {
  const routes: Record<BenchRequest["action"], [string, string]> = {
    system: ["/system", "GET"], settings: ["/settings", "GET"], save: ["/settings", "POST"], defaults: ["/settings", "POST"],
    camera: ["/camera/controls", "GET"], "camera-set": ["/camera/controls", "POST"],
    resolution: ["/camera/resolution", "GET"], "resolution-set": ["/camera/resolution", "POST"],
    recover: ["/sensors/recover", "POST"], calibration: ["/imu/calibration", "GET"], "calibration-set": ["/imu/calibration", "POST"],
    events: ["/events", "GET"], "events-set": ["/events", "POST"], "self-test": ["/self-test", "GET"],
    samples: ["/samples", "GET"], "imu-zero": ["/imu/zero", "POST"],
    "narrow-mode": ["/tof-mode", "GET"], "narrow-mode-set": ["/tof-mode", "POST"],
  };
  if (!Object.hasOwn(routes, req.action)) return { ok: false, error: "Unknown board action." };
  const [path, method] = routes[req.action];
  const url = benchUrl(vehicle, path), params = req.params ?? {};
  const keys = Object.keys(params);
  const number = (key: string, min: number, max: number, integer = false) =>
    typeof params[key] === "number" && Number.isFinite(params[key]) && Number(params[key]) >= min && Number(params[key]) <= max && (!integer || Number.isInteger(params[key]));
  let valid = keys.length === 0;
  if (req.action === "camera-set") {
    const control = CAMERA_CONTROLS.find(item => item.key === params.control);
    valid = keys.length === 2 && !!control && number("value", control.min, control.max, true);
  } else if (req.action === "resolution-set") valid = keys.length === 1 && ["QVGA", "VGA", "SVGA", "XGA", "HD"].includes(String(params.size));
  else if (req.action === "recover") valid = keys.length === 1 && ["front", "rear", "wide", "imu"].includes(String(params.sensor));
  else if (req.action === "narrow-mode-set") valid = keys.length === 2 && ["front", "rear"].includes(String(params.sensor)) && ["auto", "short", "medium", "long"].includes(String(params.mode));
  else if (req.action === "events") valid = keys.length === 0 || (keys.length === 1 && number("after", 0, 2147483647, true));
  else if (req.action === "events-set") {
    const bounds: Record<string, [number, number]> = { proximityMm: [50, 4000], tiltDeg: [5, 85], impactG: [1.2, 3.5], motionDps: [1, 200] };
    valid = keys.length > 0 && keys.every(key => Object.hasOwn(bounds, key) && number(key, ...bounds[key], key === "proximityMm"));
  } else if (req.action === "calibration-set") {
    valid = keys.length > 0 && keys.every(key => /^accelBias[XYZ]$/.test(key) ? number(key, -2, 2) :
      /^accelScale[XYZ]$/.test(key) ? number(key, 0.5, 2) : /^gyroBias[XYZ]$/.test(key) ? number(key, -100, 100) :
      /^axis[XYZ]$/.test(key) && number(key, -3, 3, true) && params[key] !== 0);
  }
  if (!valid) return { ok: false, error: "Invalid board control values." };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  if (req.action === "save" || req.action === "defaults") url.searchParams.set("action", req.action);
  const response = await fetch(url, { method, signal: AbortSignal.timeout(req.action === "recover" ? 45000 : 6000) });
  if (response.status === 404) return { ok: false, error: "This control needs the updated sensor-board firmware." };
  if (!response.headers.get("content-type")?.includes("application/json")) return { ok: false, error: `Board returned an invalid response (HTTP ${response.status}).` };
  const data = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || data?.ok !== true) return { ok: false, error: data?.error ?? `Board request failed (HTTP ${response.status}).` };
  return { ok: true, data };
}
