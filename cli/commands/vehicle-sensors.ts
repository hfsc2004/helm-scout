// SPDX-License-Identifier: Apache-2.0
import { emit } from "../output.js";
import { register, type RuntimeCommand } from "../registry.js";
import { COMMON_EXIT_CODES } from "../../core/schema.js";
import * as registry from "../../core/vehicles/registry.js";
import { sensorControls, SENSOR_NAMES } from "../../core/vehicles/sensor-controls.js";
import type { SensorName } from "../../shared/ipc-channels.js";
register({
  def: {
    name: "vehicle-sensors", summary: "Read sensor states or individually enable/disable v1.3 ToFs and IMU measurements.",
    args: [
      { name: "id", kind: "string", required: true, description: "Vehicle id or name." },
      { name: "sensor", kind: "string", required: true, description: "status | front | rear | wide | imu" },
      { name: "state", kind: "string", required: false, description: "on | off (required when selecting a sensor)" },
    ],
    flags: [], streams: false, events: [],
    exitCodes: { 0: COMMON_EXIT_CODES[0]!, 1: COMMON_EXIT_CODES[1]!, 2: COMMON_EXIT_CODES[2]!, 64: COMMON_EXIT_CODES[64]! },
  },
  async run({ args }) {
    const name = String(args["sensor"] ?? ""), state = args["state"];
    if ((name === "status" && state !== undefined) || (name !== "status" &&
        (!SENSOR_NAMES.includes(name as SensorName) || (state !== "on" && state !== "off")))) {
      emit({ ok: false, error: "Use <id> status or <id> <front|rear|wide|imu> <on|off>." }); return 64;
    }
    const id = String(args["id"] ?? ""), vehicle = registry.get(id) ?? registry.findByName(id);
    if (!vehicle) { emit({ ok: false, error: "Vehicle not found." }); return 1; }
    try {
      const result = await sensorControls(vehicle, name === "status" ? undefined : name as SensorName, name === "status" ? undefined : state === "on");
      emit(result); return result.ok ? 0 : 1;
    } catch (e) { emit({ ok: false, error: e instanceof Error ? e.message : String(e) }); return 2; }
  },
} satisfies RuntimeCommand);
