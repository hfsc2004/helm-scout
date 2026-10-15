// SPDX-License-Identifier: Apache-2.0
import { hasDriveControl, type Vehicle } from "../../shared/vehicle-contract.js";
import type { VehicleRebootResponse } from "../../shared/ipc-channels.js";

/** Reboot exactly one registered board; never infer success from a disconnect. */
export async function rebootBoard(vehicle: Vehicle, board: "drive" | "video"): Promise<VehicleRebootResponse> {
  if (board !== "drive" && board !== "video") return { ok: false, error: "Choose drive or video." };
  if (board === "drive" && !hasDriveControl(vehicle)) {
    return { ok: false, error: "No drive board is configured." };
  }
  if (board === "video" && !vehicle.camera) return { ok: false, error: "No camera/sensor board is configured." };
  const base = board === "drive"
    ? new URL(`http://${vehicle.transport!.host}:${vehicle.transport!.port}`)
    : new URL(vehicle.camera!.baseUrl);
  if (base.protocol !== "http:") return { ok: false, error: "Board reboot requires HTTP." };
  // Camera/sensor diagnostics remain available while MJPEG occupies the video port.
  if (board === "video") base.port = "82";
  const response = await fetch(new URL("/reboot", base), {
    method: "POST", signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return { ok: false, error: "Update this board's firmware to enable remote reboot." };
  if (!response.ok) return { ok: false, error: `Board rejected reboot (HTTP ${response.status}).` };
  const body = await response.json() as VehicleRebootResponse;
  if (body.ok !== true || body.rebooting !== true) {
    return { ok: false, error: "Board did not acknowledge reboot." };
  }
  return { ok: true, rebooting: true };
}
