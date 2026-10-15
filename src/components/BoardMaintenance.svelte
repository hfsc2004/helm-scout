<script lang="ts">
  import { revealDetails } from "../actions/revealDetails";
  import { onMount, onDestroy } from "svelte";
  import type { BoardSystem, BoardSettings, BoardSelfTest, OtaSelection } from "@shared/bench";
  import { requestBench, sensorLabel, errorText, kib } from "../lib/bench";
  import { boardOperations, withBoardOperation } from "../lib/bench-activity";
  import BoardRecorder from "./BoardRecorder.svelte";
  export let vehicleId: string;
  let system: BoardSystem | null = null, settings: BoardSettings | null = null, tests: BoardSelfTest | null = null;
  let busy = false, error = "", message = "", confirmDefaults = false, confirmRollback = false;
  let firmware: OtaSelection | null = null, password = "", active = true;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  const resetReasons: Record<number, string> = { 0: "Unknown", 1: "Power on", 2: "External reset", 3: "Software restart", 4: "Panic", 5: "Interrupt watchdog", 6: "Task watchdog", 7: "Watchdog", 8: "Deep sleep", 9: "Brownout", 10: "SDIO reset", 11: "USB reset", 12: "JTAG reset", 13: "eFuse error", 14: "Power glitch", 15: "CPU lockup" };
  async function refresh() {
    busy = true; error = "";
    try {
      const next = await requestBench<BoardSystem>(vehicleId, "system");
      if (!next.ota || !Array.isArray(next.sensors)) throw new Error("Board health controls unavailable in this firmware.");
      if (!active) return;
      system = next; settings = await requestBench<BoardSettings>(vehicleId, "settings");
    } catch (e) { if (active) { system = null; settings = null; error = errorText(e); } }
    finally { if (active) busy = false; }
  }
  async function action(kind: "save" | "defaults" | "self-test") {
    busy = true; error = ""; message = "";
    try {
      const result = await requestBench<BoardSelfTest>(vehicleId, kind);
      if (kind === "self-test") { tests = result; message = result.pass ? "All sensor checks passed." : "Self-test finished; some sensor checks failed."; }
      else message = kind === "save" ? "Current settings saved as boot defaults." : "Saved defaults cleared. Reboot to use the firmware defaults.";
      confirmDefaults = false;
    } catch (e) { error = errorText(e); }
    finally { busy = false; }
  }
  function scheduleReconnect() {
    system = null; settings = null; tests = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => { if (active) void refresh(); }, 7000);
  }
  async function reboot() {
    busy = true; error = "";
    try {
      await withBoardOperation(vehicleId, "Rebooting sensor board", async () => {
        const result = await window.helm.vehicle.reboot({ vehicleId, board: "video" });
        if (!result.ok) throw new Error(result.error ?? "Board did not acknowledge reboot.");
      });
      message = "Reboot accepted. Waiting for the board to reconnect."; scheduleReconnect();
    } catch (e) { error = errorText(e); }
    finally { busy = false; }
  }
  async function chooseFirmware() {
    error = "";
    firmware = null;
    try {
      const next = await window.helm.vehicle.chooseBoardFirmware();
      if (!next.ok) throw new Error(next.error ?? "Could not select firmware.");
      if (!next.cancelled) firmware = next;
    } catch (e) { error = errorText(e); }
  }
  async function update(rollback = false) {
    busy = true; error = ""; message = "";
    try {
      await withBoardOperation(vehicleId, rollback ? "Rolling back firmware" : "Uploading firmware", async () => {
        const result = await window.helm.vehicle.updateBoard({ vehicleId, password, token: rollback ? undefined : firmware?.token, rollback });
        if (!result.ok) throw new Error(result.error ?? "Board did not acknowledge the update.");
      });
      firmware = null; confirmRollback = false; message = "Firmware change accepted. Waiting for the board to reconnect."; scheduleReconnect();
    } catch (e) { error = errorText(e); }
    finally { password = ""; busy = false; }
  }
  onMount(() => { void refresh(); });
  onDestroy(() => { active = false; password = ""; if (reconnectTimer) clearTimeout(reconnectTimer); });
</script>
<div class="bench-controls">
  <div class="button-row"><button disabled={busy || !!$boardOperations[vehicleId]} on:click={refresh}>Refresh board health</button><button disabled={busy || !!$boardOperations[vehicleId]} on:click={reboot}>Reboot sensor board</button></div>
  {#if system}
    <dl class="health-list">
      <dt>Firmware</dt><dd>{system.firmware}</dd><dt>Build</dt><dd>{system.build}</dd>
      <dt>Uptime</dt><dd>{Math.floor(system.uptimeMs/60000)}m {Math.floor(system.uptimeMs/1000)%60}s</dd>
      <dt>Last reset</dt><dd>{resetReasons[system.resetReason] ?? `Reason ${system.resetReason}`}</dd>
      <dt>Free RAM</dt><dd>{kib(system.freeHeap)}</dd><dt>Lowest free RAM</dt><dd>{kib(system.minimumFreeHeap)}</dd>
      <dt>Free PSRAM</dt><dd>{kib(system.psramFree)} / {kib(system.psramTotal)}</dd>
      <dt>Largest free block</dt><dd>{kib(system.largestFreeBlock)}</dd>
      <dt>I²C probe/helper errors</dt><dd>{system.i2cHelperErrors}</dd><dt>Camera frames</dt><dd>{system.cameraFrames}</dd>
    </dl>
    <h4>Sensor health</h4>
    {#each system.sensors as sensor}<div class="sensor-health"><strong>{sensorLabel(sensor.name)}</strong><span>{!sensor.enabled ? "Off" : sensor.ready ? "Ready" : "Not ready"} · {sensor.hz.toFixed(1)} Hz</span><small>{sensor.frames} frames · {sensor.driverErrors} driver errors · {sensor.ageMs == null ? "no sample" : `${(sensor.ageMs/1000).toFixed(1)}s old`}</small></div>{/each}
  {/if}
  <details use:revealDetails><summary>Sensor self-test</summary>
    <p class="hint">Checks sensor addresses and reading freshness without changing their on/off states.</p>
    <button disabled={busy || !!$boardOperations[vehicleId] || !system} on:click={() => action("self-test")}>Run self-test</button>
    {#if tests}<ul class="test-list">{#each tests.tests as test}<li><strong>{sensorLabel(test.sensor)}: {test.pass ? "Pass" : "Fail"}</strong><span>{test.enabled ? "On" : "Off"} · address {test.addressOk ? "responding" : "missing"} · {test.fresh ? "fresh readings" : test.enabled ? "no fresh readings" : "fresh reading not required"}</span></li>{/each}</ul>{/if}
  </details>
  <details use:revealDetails><summary>Saved boot settings</summary>
    {#if settings}<p class="hint">{settings.loaded ? "Saved settings were loaded at boot." : "This boot used firmware defaults."} {settings.bootApplyOk ? "" : "Some saved settings could not be applied."}</p>{/if}
    <p class="hint">Save the current sensor states, camera settings, ToF profiles, IMU calibration, and event thresholds for future boots.</p>
    <button disabled={busy || !!$boardOperations[vehicleId] || !settings} on:click={() => action("save")}>Save current boot defaults</button>
    {#if !confirmDefaults}<button disabled={busy || !!$boardOperations[vehicleId] || !settings} on:click={() => confirmDefaults = true}>Clear saved defaults…</button>
    {:else}<p>Clear the saved settings? Current settings stay active until reboot.</p><div class="button-row"><button disabled={busy || !!$boardOperations[vehicleId]} on:click={() => action("defaults")}>Clear saved defaults</button><button on:click={() => confirmDefaults = false} disabled={busy}>Cancel</button></div>{/if}
  </details>
  <BoardRecorder {vehicleId} />
  <details use:revealDetails><summary>Wireless firmware update</summary>
    {#if system}<p class="hint">{system.ota.available ? `OTA slot: ${kib(system.ota.slotBytes)} · ${system.ota.runningPartition} running` : "This board needs an initial wired flash with OTA partitions."}</p>
      {#if !system.ota.passwordConfigured}<p class="hint">OTA is disabled on this board. Configure ota.password (at least 12 characters) during a wired flash to enable it.</p>{/if}
    {/if}
    <p class="hint">Use the matching Sensor Board v1.3 application .bin. Stop driving, audio playback, and microphone tests first. The board restarts after a successful upload.</p>
    <button disabled={busy || !!$boardOperations[vehicleId] || !system?.ota.available || !system?.ota.passwordConfigured} on:click={chooseFirmware}>Choose application firmware…</button>
    {#if firmware?.token}<p>{firmware.name} · {kib(firmware.bytes ?? 0)}</p>{/if}
    <label>OTA password<input type="password" bind:value={password} autocomplete="off" disabled={busy || !system?.ota.passwordConfigured} /></label>
    <button disabled={busy || !!$boardOperations[vehicleId] || !firmware?.token || password.length < 12 || !system?.ota.available || !system?.ota.passwordConfigured} on:click={() => update()}>{busy && $boardOperations[vehicleId] === "Uploading firmware" ? "Uploading…" : "Upload and reboot"}</button>
    {#if system?.ota.manualRollbackAvailable}
      {#if !confirmRollback}<button disabled={busy || !system.ota.passwordConfigured} on:click={() => confirmRollback = true}>Restore previous firmware…</button>
      {:else}<p>Restore the previous bootable firmware and reboot?</p><button disabled={busy || !!$boardOperations[vehicleId] || password.length < 12} on:click={() => update(true)}>Restore and reboot</button><button disabled={busy} on:click={() => confirmRollback = false}>Cancel</button>{/if}
    {/if}
    <p class="hint">{system?.ota.automaticRollback ? "Automatic failed-boot rollback is enabled." : "Automatic failed-boot rollback is not enabled."} The password is used for this request and is not saved by Scout.</p>
  </details>
  {#if busy}<p class="hint" role="status">{$boardOperations[vehicleId] ?? "Reading board…"}</p>{/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>
