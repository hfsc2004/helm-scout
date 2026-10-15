import { isS3ApplicationImage } from "../../core/vehicles/board-image.js";
// SPDX-License-Identifier: Apache-2.0
import { dialog, ipcMain } from "electron";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { IPC } from "../../shared/ipc-channels.js";
import type { BenchRequest, BoardUpdateRequest, BoardSystem, OtaSelection } from "../../shared/bench.js";
import * as registry from "../../core/vehicles/registry.js";
import { benchRequest, benchUrl } from "../../core/vehicles/bench.js";

export function registerBenchHandlers(): void {
  const selections = new Map<string, { owner: number; image: Buffer; name: string; expires: number }>();
  const updating = new Set<string>();
  ipcMain.handle(IPC.vehicle.bench, async (_event, req: BenchRequest) => {
    try {
      const vehicle = registry.get(req.vehicleId);
      if (!vehicle) return { ok: false, error: "Vehicle not found." };
      if (updating.has(vehicle.id)) return { ok: false, error: "Firmware update in progress." };
      return await benchRequest(vehicle, req);
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle(IPC.vehicle.chooseBoardFirmware, async (event): Promise<OtaSelection> => {
    const selection = await dialog.showOpenDialog({ title: "Choose Sensor Board v1.3 application firmware", filters: [{ name: "Application firmware", extensions: ["bin"] }], properties: ["openFile"] });
    if (selection.canceled || !selection.filePaths[0]) return { ok: true, cancelled: true };
    try {
      const info = await stat(selection.filePaths[0]);
      if (!info.isFile() || info.size < 256 || info.size > 2097152) return { ok: false, error: "Choose an application image no larger than 2 MiB." };
      const image = await readFile(selection.filePaths[0]);
      // ESP app descriptor follows the image header and first segment header.
      if (!isS3ApplicationImage(image)) {
        return { ok: false, error: "Choose an ESP32-S3 application .bin, rather than a bootloader, partition table, or merged image." };
      }
      for (const [token, stored] of selections) if (stored.owner === event.sender.id || stored.expires < Date.now()) selections.delete(token);
      const token = randomUUID(), name = basename(selection.filePaths[0]);
      selections.set(token, { owner: event.sender.id, image, name, expires: Date.now() + 600000 });
      return { ok: true, token, name, bytes: image.length };
    } catch { return { ok: false, error: "Could not read the firmware file." }; }
  });
  ipcMain.handle(IPC.vehicle.updateBoard, async (event, req: BoardUpdateRequest) => {
    if (!req || typeof req.password !== "string" || req.password.length < 12 || req.password.length > 256 ||
        (req.rollback !== undefined && typeof req.rollback !== "boolean") || (req.token !== undefined && typeof req.token !== "string")) return { ok: false, error: "Enter the OTA password configured when this board was flashed (at least 12 characters)." };
    if (updating.has(req.vehicleId)) return { ok: false, error: "Firmware update already in progress." };
    updating.add(req.vehicleId);
    try {
      const vehicle = registry.get(req.vehicleId);
      if (!vehicle) return { ok: false, error: "Vehicle not found." };
      const preflight = await benchRequest(vehicle, { action: "system" });
      const system = preflight.data as BoardSystem | undefined;
      if (!preflight.ok || !system?.ota?.available || !system.ota.passwordConfigured) return { ok: false, error: preflight.error ?? "This board needs OTA partitions and a configured update password." };
      if (req.rollback && !system.ota.manualRollbackAvailable) return { ok: false, error: "No previous bootable firmware is available." };
      const endpoint = benchUrl(vehicle, req.rollback ? "/ota/rollback" : "/ota");
      let body: FormData | undefined;
      if (!req.rollback) {
        const selected = req.token ? selections.get(req.token) : undefined;
        if (!selected || selected.owner !== event.sender.id || selected.expires < Date.now()) return { ok: false, error: "Choose the firmware application again." };
        if (selected.image.length > system.ota.slotBytes) return { ok: false, error: "Firmware is larger than this board's OTA slot." };
        body = new FormData();
        body.append("firmware", new Blob([Uint8Array.from(selected.image).buffer], { type: "application/octet-stream" }), selected.name);
      }
      const response = await fetch(endpoint, { method: "POST", headers: { Authorization: "Basic " + Buffer.from("scout:" + req.password).toString("base64") }, body, signal: AbortSignal.timeout(120000) });
      const result = await response.json() as { ok?: boolean; rebooting?: boolean; error?: string };
      if (!response.ok || result.ok !== true || result.rebooting !== true) return { ok: false, error: result.error ?? `Update rejected (HTTP ${response.status}).` };
      if (req.token) selections.delete(req.token);
      return { ok: true, rebooting: true };
    } catch {
      // Never assume that a lost connection proves an update or reboot succeeded.
      return { ok: false, error: "The board did not acknowledge completion. Check its connection and firmware version before retrying." };
    } finally { updating.delete(req.vehicleId); }
  });
}
