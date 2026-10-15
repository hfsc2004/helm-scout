// SPDX-License-Identifier: Apache-2.0
import type { Vehicle } from "../../shared/vehicle-contract.js";
import type { SensorControlResponse, SensorName } from "../../shared/ipc-channels.js";

export const SENSOR_NAMES = ["front", "rear", "wide", "imu"] as const;
export async function sensorControls(vehicle: Vehicle, sensor?: SensorName, enabled?: boolean): Promise<SensorControlResponse> {
  if (vehicle.sensorBoardRevision !== "1.3" || !vehicle.camera) return { ok: false, error: "A configured v1.3 sensor board is required." };
  if ((sensor !== undefined && !SENSOR_NAMES.includes(sensor)) ||
      (sensor === undefined) !== (enabled === undefined) ||
      (enabled !== undefined && typeof enabled !== "boolean")) {
    return { ok: false, error: "Choose front, rear, wide, or imu and an on/off state." };
  }
  const url = new URL("/sensors", vehicle.camera.baseUrl);
  if (url.protocol !== "http:") return { ok: false, error: "Sensor control requires HTTP." };
  url.port = "82";
  if (sensor !== undefined) { url.searchParams.set("sensor", sensor); url.searchParams.set("enabled", enabled ? "1" : "0"); }
  const response = await fetch(url, { method: sensor === undefined ? "GET" : "POST", signal: AbortSignal.timeout(sensor === "wide" ? 15000 : 5000) });
  if (response.status === 404) return { ok: false, error: "Update sensor-board firmware to enable individual sensor controls." };
  const body = await response.json() as SensorControlResponse;
  if (!response.ok || body.ok !== true) return { ok: false, error: body.error ?? "Sensor control failed." };
  if (!body.sensors || SENSOR_NAMES.some(name => typeof body.sensors?.[name]?.enabled !== "boolean" || typeof body.sensors?.[name]?.ready !== "boolean") ||
      (sensor !== undefined && body.sensors[sensor].enabled !== enabled)) return { ok: false, error: "Board did not confirm sensor state." };
  return body;
}
