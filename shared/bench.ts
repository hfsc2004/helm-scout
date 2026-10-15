// SPDX-License-Identifier: Apache-2.0
import type { SensorName } from "./ipc-channels.js";
export type BenchAction = "system" | "settings" | "save" | "defaults" | "camera" | "camera-set" |
  "resolution" | "resolution-set" | "recover" | "calibration" | "calibration-set" |
  "events" | "events-set" | "self-test" | "samples" | "imu-zero" | "narrow-mode" | "narrow-mode-set";
export interface BenchRequest { vehicleId: string; action: BenchAction; params?: Record<string, string | number> }
export interface BenchResponse { ok: boolean; data?: unknown; error?: string }
export interface BoardSystem {
  ok: boolean; firmware: string; build: string; bootId: number; uptimeMs: number; resetReason: number;
  freeHeap: number; minimumFreeHeap: number; largestFreeBlock: number; psramTotal: number; psramFree: number;
  i2cHelperErrors: number; cameraFrames: number;
  sensors: Array<{ name: SensorName; enabled: boolean; ready: boolean; frames: number; hz: number; driverErrors: number; ageMs: number | null }>;
  ota: { passwordConfigured: boolean; available: boolean; runningPartition: string; slotBytes: number; manualRollbackAvailable: boolean; automaticRollback: boolean };
}
export interface BoardSettings { ok: boolean; version: number; loaded: boolean; bootApplyOk: boolean; saveExplicit: boolean; restoreRequiresReboot: boolean }
export interface CameraSettings { ok: boolean; controls: Record<string, number> }
export interface CameraResolution { ok: boolean; size: string; supported: string[] }
export interface ImuCalibration { ok: boolean; accelBias: number[]; accelScale: number[]; gyroBias: number[]; axes: number[] }
export interface BoardEvent { sequence: number; atMs: number; type: "proximity" | "tilt" | "impact" | "motion"; sensor: SensorName; active: boolean; value: number }
export interface BoardEvents {
  ok: boolean; bootId: number; latest: number; oldest: number; gap: boolean;
  thresholds: { proximityMm: number; tiltDeg: number; impactG: number; motionDps: number };
  events: BoardEvent[];
}
export interface BoardSelfTest { ok: boolean; pass: boolean; uptimeMs: number; nonDestructive: boolean; tests: Array<{ sensor: SensorName; enabled: boolean; addressOk: boolean; fresh: boolean; pass: boolean }> }
export interface OtaSelection { ok: boolean; token?: string; name?: string; bytes?: number; cancelled?: boolean; error?: string }
export interface BoardUpdateRequest { vehicleId: string; password: string; token?: string; rollback?: boolean }
export interface BoardUpdateResponse { ok: boolean; rebooting?: boolean; error?: string }
export const CAMERA_CONTROLS = [
  { key: "quality", label: "JPEG quality", min: 0, max: 63 },
  { key: "brightness", label: "Brightness", min: -2, max: 2 },
  { key: "contrast", label: "Contrast", min: -2, max: 2 },
  { key: "saturation", label: "Saturation", min: -2, max: 2 },
  { key: "whitebal", label: "Auto white balance", min: 0, max: 1 },
  { key: "exposure", label: "Auto exposure", min: 0, max: 1 },
  { key: "gain", label: "Auto gain", min: 0, max: 1 },
  { key: "agcGain", label: "Manual gain", min: 0, max: 30 },
  { key: "aecValue", label: "Manual exposure", min: 0, max: 1200 },
  { key: "mirror", label: "Sensor mirror", min: 0, max: 1 },
] as const;
