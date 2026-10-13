<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 Pseudo Science Fiction -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { persistentDetails } from "../actions/persistentDetails";
  import { fleet, vehicleState } from "../stores/vehicles";
  import { inputMode } from "../stores/inputMode";
  import Numpad from "../components/Numpad.svelte";
  import Gamepad from "../components/Gamepad.svelte";
  import SpeedSlider from "../components/SpeedSlider.svelte";
  import StateReadouts from "../components/StateReadouts.svelte";
  import IntentBar from "../components/IntentBar.svelte";
  import CameraFeed from "../components/CameraFeed.svelte";
  import AudioFeed from "../components/AudioFeed.svelte";
  import ActivityLog from "../components/ActivityLog.svelte";
  import SensorBoardReadouts from "../components/SensorBoardReadouts.svelte";
  import LightLibrary from "../components/LightLibrary.svelte";
  import AudioLibrary from "../components/AudioLibrary.svelte";
  import UnoKeyboard from "../components/UnoKeyboard.svelte";
  import { hasDriveControl } from "@shared/vehicle-contract";

  let cameraFlipped = false;
  let numpad: Numpad | null = null;
  function loadCameraFlip(vehicleId: string | null): boolean {
    try { return vehicleId !== null && localStorage.getItem(`psf-helm:camera-flip:${vehicleId}`) === "true"; }
    catch { return false; }
  }
  function saveCameraFlip(): void {
    if (!$fleet.selectedId) return;
    try { localStorage.setItem(`psf-helm:camera-flip:${$fleet.selectedId}`, String(cameraFlipped)); }
    catch { /* Keep the toggle usable when storage is unavailable. */ }
  }
  $: cameraFlipped = loadCameraFlip($fleet.selectedId);

  $: selectedVehicle = $fleet.vehicles.find((v) => v.id === $fleet.selectedId) ?? null;
  $: canDrive = selectedVehicle ? hasDriveControl(selectedVehicle) : false;

  // Start the telemetry stream only while the Driver view is mounted, and
  // only against the currently-selected vehicle. Closing this tab tears it
  // down so an idle Helm Scout never polls /telemetry on the LAN.
  $: if (canDrive && $fleet.selectedId && $vehicleState.vehicleId !== $fleet.selectedId) {
    void vehicleState.start($fleet.selectedId);
  } else if (!canDrive && $vehicleState.vehicleId !== null) {
    void vehicleState.stop();
  }
  onDestroy(() => {
    void vehicleState.stop();
  });
</script>

<div class="layout">
  <div class="stage">
    <div class="camera">
      <CameraFeed flipped={cameraFlipped} />
    </div>
    <AudioFeed />
    {#if canDrive}<IntentBar />{/if}
  </div>

  <aside class="rail">
    {#if !$fleet.selectedId}
      <section>
        <p class="muted">
          Register a vehicle from the CLI to get started:<br />
          <code>npm run helm -- vehicle-add &lt;host&gt; --name &lt;name&gt;</code>
        </p>
      </section>
    {:else if !canDrive}
      {#if selectedVehicle?.sensorBoardRevision === "1.3"}
        {#key selectedVehicle.id}
          <SensorBoardReadouts vehicleId={selectedVehicle.id} />
          <details use:persistentDetails={{ vehicleId: $fleet.selectedId, section: "uno-driving" }}><summary>Driving</summary><UnoKeyboard vehicleId={selectedVehicle.id} mode={$inputMode} /></details>
        {/key}
      {:else}
        <section><p class="muted">Motor controls and drive telemetry are not available for this vehicle.</p></section>
      {/if}
    {:else}
      {#if $inputMode !== "gamepad"}<button class="stop" on:click={() => numpad?.pressStop()}>STOP</button>{/if}
      <details use:persistentDetails={{ vehicleId: $fleet.selectedId, section: "driving" }}><summary>Driving controls</summary>
      {#if $inputMode === "gamepad"}
        <Gamepad />
      {:else}
        <Numpad bind:this={numpad} mode={$inputMode} />
      {/if}
      </details>
      <details use:persistentDetails={{ vehicleId: $fleet.selectedId, section: "speed" }}><summary>Speed</summary><SpeedSlider /></details>
      <details use:persistentDetails={{ vehicleId: $fleet.selectedId, section: "vehicle-state" }}><summary>Vehicle state</summary><StateReadouts /></details>
      <details use:persistentDetails={{ vehicleId: $fleet.selectedId, section: "activity" }}><summary>Activity</summary><ActivityLog /></details>
    {/if}
    {#if selectedVehicle?.camera}
      <details use:persistentDetails={{ vehicleId: $fleet.selectedId, section: "camera" }}><summary>Camera</summary>
        <section><label class="camera-toggle"><input type="checkbox" bind:checked={cameraFlipped} on:change={saveCameraFlip} /> Flip horizontally</label></section>
      </details>
    {/if}
    {#if selectedVehicle?.sensorBoardRevision === "1.3"}
      <details use:persistentDetails={{ vehicleId: $fleet.selectedId, section: "audio" }}><summary>Audio</summary><AudioLibrary vehicleId={selectedVehicle.id} /></details>
      <details use:persistentDetails={{ vehicleId: $fleet.selectedId, section: "leds" }}><summary>LEDs</summary><LightLibrary vehicleId={selectedVehicle.id} /></details>
    {/if}
  </aside>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    overflow: hidden;
    min-height: 0;
  }
  .stage {
    position: relative;
    display: flex;
    flex-direction: column;
    background: #000;
    min-height: 0;
  }
  .camera {
    position: relative;
    flex: 1 1 auto;
    background:
      radial-gradient(ellipse at 30% 20%, #2a3038 0%, #0a0c10 60%),
      repeating-linear-gradient(45deg, #14181f 0 4px, #0e1218 4px 8px);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .stop { margin: 0.75rem 1rem; padding: 0.65rem; background: var(--danger, #f85149); color: white; border: 0; border-radius: 4px; font-weight: 700; cursor: pointer; }
  details { border-bottom: 1px solid var(--border); }
  summary { padding: 0.85rem 1rem; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
  summary:hover { background: var(--surface-2, #1c232c); }
  summary:focus-visible { outline: 2px solid var(--accent, #58a6ff); outline-offset: -2px; }
  .camera-toggle { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
  .rail {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-left: 1px solid var(--border);
    overflow-y: auto;
  }
  section {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
  }
  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0;
    line-height: 1.5;
  }
  code {
    background: var(--surface-2, #1c232c);
    padding: 0.15rem 0.35rem;
    border-radius: 3px;
    font-size: 0.75rem;
    display: inline-block;
    margin-top: 0.4rem;
  }
</style>
