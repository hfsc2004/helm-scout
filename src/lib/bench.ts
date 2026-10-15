import { withBoardOperation } from "./bench-activity";
// SPDX-License-Identifier: Apache-2.0
import type { BenchAction } from "@shared/bench";
export async function requestBench<T>(vehicleId: string, action: BenchAction, params?: Record<string, string | number>): Promise<T> {
  if (typeof window.helm?.vehicle?.bench !== "function") throw new Error("Restart Scout to load the new board controls.");
  const run = async () => {
    const result = await window.helm.vehicle.bench({ vehicleId, action, params });
    if (!result.ok || result.data == null) throw new Error(result.error ?? "Board did not confirm the request.");
    return result.data as T;
  };
  return ["save", "defaults", "camera-set", "resolution-set", "recover", "calibration-set", "events-set", "imu-zero", "narrow-mode-set"].includes(action)
    ? withBoardOperation(vehicleId, action === "recover" ? "Reinitializing sensor" : "Applying board settings", run) : run();
}
export const sensorLabel = (name: string) => ({ front: "LR Front", rear: "LR Rear", wide: "SR Front", imu: "IMU" }[name] ?? name);
export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
export const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
