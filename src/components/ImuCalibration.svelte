<script lang="ts">
  import { enterToApply } from "../actions/enterToApply";
  import { revealDetails } from "../actions/revealDetails";
  import { onMount, createEventDispatcher } from "svelte";
  import type { ImuCalibration } from "@shared/bench";
  import { requestBench, errorText } from "../lib/bench";
  import { boardOperations } from "../lib/bench-activity";
  export let vehicleId: string;
  export let disabled = false;
  const dispatch = createEventDispatcher<{ changed: void }>();
  let calibration: ImuCalibration | null = null;
  let accelBias = [0,0,0], accelScale = [1,1,1], gyroBias = [0,0,0], axes = [1,2,3];
  let busy = false, error = "", message = "";
  async function refresh() {
    busy = true; error = "";
    try {
      const next = await requestBench<ImuCalibration>(vehicleId, "calibration");
      if (![next.accelBias, next.accelScale, next.gyroBias, next.axes].every(values => Array.isArray(values) && values.length === 3 && values.every(Number.isFinite))) throw new Error("Calibration controls unavailable in this firmware.");
      calibration = next; accelBias = [...next.accelBias]; accelScale = [...next.accelScale]; gyroBias = [...next.gyroBias]; axes = [...next.axes];
    } catch (e) { calibration = null; error = errorText(e); }
    finally { busy = false; }
  }
  async function apply() {
    busy = true; error = ""; message = "";
    try {
      const params: Record<string, number> = {};
      ["X", "Y", "Z"].forEach((axis, i) => {
        params[`accelBias${axis}`] = Number(accelBias[i]); params[`accelScale${axis}`] = Number(accelScale[i]);
        params[`gyroBias${axis}`] = Number(gyroBias[i]); params[`axis${axis}`] = Number(axes[i]);
      });
      calibration = await requestBench<ImuCalibration>(vehicleId, "calibration-set", params);
      message = "Calibration applied. Keep the board still while orientation recalibrates. Save boot defaults under Board status to retain it.";
      dispatch("changed");
    } catch (e) { error = errorText(e); }
    finally { busy = false; }
  }
  async function zero() {
    busy = true; error = ""; message = "";
    try { await requestBench(vehicleId, "imu-zero"); message = "Current stationary pose is now zero."; dispatch("changed"); }
    catch (e) { error = errorText(e); }
    finally { busy = false; }
  }
  onMount(() => { void refresh(); });
</script>
<div class="bench-controls">
  <button disabled={busy || disabled || !!$boardOperations[vehicleId]} on:click={zero}>Zero stationary pose</button>
  <details use:revealDetails>
    <summary>Calibration and mounting</summary>
    <p class="hint">Enter measured corrections in chip axes, then choose the mounting axes. Applying resets orientation; keep the board still. Raw counts stay in chip axes.</p>
    <form use:enterToApply on:submit|preventDefault={apply}>
      {#each ["X", "Y", "Z"] as axis, i}
        <fieldset disabled={busy || !!$boardOperations[vehicleId] || !calibration}>
          <legend>Chip {axis}</legend>
          <label>Accel bias (g)<input type="number" step="0.0001" min="-2" max="2" bind:value={accelBias[i]} required /></label>
          <label>Accel scale<input type="number" step="0.0001" min="0.5" max="2" bind:value={accelScale[i]} required /></label>
          <label>Gyro bias (°/s)<input type="number" step="0.001" min="-100" max="100" bind:value={gyroBias[i]} required /></label>
        </fieldset>
      {/each}
      <fieldset disabled={busy || !!$boardOperations[vehicleId] || !calibration}>
        <legend>Mounting axes</legend>
        {#each ["X", "Y", "Z"] as axis, i}
          <label>Output {axis}<select bind:value={axes[i]}>
            {#each [1,2,3,-1,-2,-3] as value}<option {value}>{value < 0 ? "−" : "+"}{["X", "Y", "Z"][Math.abs(value)-1]}</option>{/each}
          </select></label>
        {/each}
      </fieldset>
      <p class="hint">Each chip axis must be used once in a right-handed rotation. Reflections are rejected by the board.</p>
      <button type="submit" disabled={busy || !!$boardOperations[vehicleId] || !calibration}>Apply calibration</button>
    </form>
    <button disabled={busy || !!$boardOperations[vehicleId]} on:click={refresh}>Reload calibration</button>
  </details>
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>
