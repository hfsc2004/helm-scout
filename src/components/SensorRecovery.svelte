<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SensorName } from "@shared/ipc-channels";
  import { requestBench, errorText } from "../lib/bench";
  export let vehicleId: string;
  export let sensor: SensorName;
  export let disabled = false;
  const dispatch = createEventDispatcher<{ recovered: void; busy: boolean }>();
  let busy = false, error = "", message = "";
  async function recover() {
    busy = true; dispatch("busy", true); error = ""; message = "";
    try { await requestBench(vehicleId, "recover", { sensor }); message = "Sensor reinitialized; waiting for fresh readings."; dispatch("recovered"); }
    catch (e) { error = errorText(e); }
    finally { busy = false; dispatch("busy", false); }
  }
</script>
<button type="button" disabled={disabled || busy} on:click={recover}>{busy ? "Reinitializing…" : "Reinitialize sensor"}</button>
{#if message}<p class="hint" role="status">{message}</p>{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}
