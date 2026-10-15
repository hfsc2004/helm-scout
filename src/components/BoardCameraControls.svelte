<script lang="ts">
  import { enterToApply } from "../actions/enterToApply";
  import { onMount } from "svelte";
  import { CAMERA_CONTROLS, type CameraSettings, type CameraResolution } from "@shared/bench";
  import { boardOperations } from "../lib/bench-activity";
  import { requestBench, errorText } from "../lib/bench";
  export let vehicleId: string;
  let controls: Record<string, number> | null = null;
  let resolution: CameraResolution | null = null;
  let busy = false, error = "", message = "";
  let choice: string = "quality", value = 12, size = "VGA";
  const resolutions: Record<string, string> = { QVGA: "320×240", VGA: "640×480", SVGA: "800×600", XGA: "1024×768", HD: "1280×720" };
  function chooseControl(event: Event) {
    choice = (event.currentTarget as HTMLSelectElement).value;
    value = controls?.[choice] ?? CAMERA_CONTROLS.find(control => control.key === choice)!.min;
  }
  $: selected = CAMERA_CONTROLS.find(item => item.key === choice)!;
  async function refresh() {
    busy = true; error = "";
    try {
      const current = await requestBench<CameraSettings>(vehicleId, "camera");
      if (!current.controls) throw new Error("Camera controls unavailable in this firmware.");
      controls = current.controls; value = controls[choice] ?? selected.min;
      resolution = await requestBench<CameraResolution>(vehicleId, "resolution");
      size = resolution.size;
    } catch (e) { controls = null; resolution = null; error = errorText(e); }
    finally { busy = false; }
  }
  async function applyResolution() {
    busy = true; error = ""; message = "";
    try { resolution = await requestBench<CameraResolution>(vehicleId, "resolution-set", { size }); size = resolution.size; message = `Resolution is ${size}.`; }
    catch (e) { error = errorText(e); }
    finally { busy = false; }
  }
  async function applyControl() {
    busy = true; error = ""; message = "";
    try {
      const actual = await requestBench<CameraSettings>(vehicleId, "camera-set", { control: choice, value: Number(value) });
      controls = actual.controls; value = controls[choice]; message = `${selected.label} applied.`;
    } catch (e) { error = errorText(e); }
    finally { busy = false; }
  }
  onMount(() => { void refresh(); });
</script>
<div class="bench-controls">
  <h4>Camera sensor</h4>
  <form use:enterToApply on:submit|preventDefault={applyResolution}>
    <label>Resolution<select bind:value={size} disabled={busy || !!$boardOperations[vehicleId] || !resolution}>
      {#each ["QVGA", "VGA", "SVGA", "XGA", "HD"] as option}<option value={option}>{option} · {resolutions[option]}</option>{/each}
    </select></label>
    <button type="submit" disabled={busy || !!$boardOperations[vehicleId] || !resolution}>Apply resolution</button>
  </form>
  <form use:enterToApply on:submit|preventDefault={applyControl}>
    <label>Adjustment<select bind:value={choice} disabled={busy || !!$boardOperations[vehicleId] || !controls} on:change={chooseControl}>
      {#each CAMERA_CONTROLS as control}<option value={control.key}>{control.label}</option>{/each}
    </select></label>
    <label>{selected.label}
      {#if selected.max === 1 && selected.min === 0}
        <select bind:value={value} disabled={busy || !!$boardOperations[vehicleId] || !controls}><option value={1}>On</option><option value={0}>Off</option></select>
      {:else}<input type="number" bind:value min={selected.min} max={selected.max} step="1" required disabled={busy || !!$boardOperations[vehicleId] || !controls} />{/if}
    </label>
    <button type="submit" disabled={busy || !!$boardOperations[vehicleId] || !controls}>Apply adjustment</button>
  </form>
  <p class="hint">Lower JPEG quality numbers give better images. Turn auto gain or exposure off before adjusting its manual value. Save boot defaults under Board status.</p>
  <button type="button" on:click={refresh} disabled={busy || !!$boardOperations[vehicleId]}>Refresh camera settings</button>
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>
