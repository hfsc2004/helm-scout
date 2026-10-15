// SPDX-License-Identifier: Apache-2.0
import { emit } from "../output.js";
import { register, type RuntimeCommand } from "../registry.js";
import { COMMON_EXIT_CODES } from "../../core/schema.js";
import * as registry from "../../core/vehicles/registry.js";
import { rebootBoard } from "../../core/vehicles/reboot.js";

register({
  def: {
    name: "vehicle-reboot",
    summary: "Reboot one drive or camera/sensor board (requires updated firmware).",
    args: [
      { name: "id", kind: "string", required: true, description: "Vehicle id or name." },
      { name: "board", kind: "string", required: true, description: "drive | video (camera/sensor board)" },
    ],
    flags: [], streams: false, events: [],
    exitCodes: { 0: COMMON_EXIT_CODES[0]!, 1: COMMON_EXIT_CODES[1]!, 2: COMMON_EXIT_CODES[2]!, 64: COMMON_EXIT_CODES[64]! },
  },
  async run({ args }) {
    const board = String(args["board"] ?? "");
    if (board !== "drive" && board !== "video") { emit({ ok: false, error: "Choose drive or video." }); return 64; }
    const id = String(args["id"] ?? "");
    const vehicle = registry.get(id) ?? registry.findByName(id);
    if (!vehicle) { emit({ ok: false, error: "Vehicle not found." }); return 1; }
    try {
      const result = await rebootBoard(vehicle, board);
      emit(result);
      return result.ok ? 0 : 1;
    } catch (error) {
      emit({ ok: false, error: error instanceof Error ? error.message : String(error) });
      return 2;
    }
  },
} satisfies RuntimeCommand);
