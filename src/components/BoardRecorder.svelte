<script lang="ts">
  import { revealDetails } from "../actions/revealDetails";
  import { onDestroy } from "svelte";
  import { requestBench, errorText } from "../lib/bench";
  import { boardOperations, boardEpoch } from "../lib/bench-activity";
  import type { BoardSystem } from "@shared/bench";
  export let vehicleId: string;
  type RecordEntry = { receivedAt: string; samples: unknown; wide: unknown; image?: string; cameraCapturedAt?: number; cameraSource?: string };
  let recording = false, starting = false, active = true, includeImages = false, error = "", message = "";
  let records: RecordEntry[] = [], bytes = 0, preview = 0, system: BoardSystem | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined, exportUrl: string | null = null;
  let session = 0, recordedVehicleId = vehicleId;
  const limit = 24 * 1024 * 1024;
  function stop() { ++session; recording = false; if (timer) clearTimeout(timer); }
  async function capture(captureSession = session) {
    if (!recording || !active || captureSession !== session) return;
    if (!$boardOperations[vehicleId]) {
      const epoch = boardEpoch(vehicleId);
      try {
        const samples = await requestBench(vehicleId, "samples");
        const wide = await window.helm.vehicle.sensorBoardWideSnapshot({ vehicleId });
        const image = includeImages ? await window.helm.vehicle.cameraSnapshot({ vehicleId, timeoutMs: 2000 }) : null;
        if (!recording || !active || captureSession !== session) return;
        if (epoch === boardEpoch(vehicleId)) {
          const entry = { receivedAt: new Date().toISOString(), samples, wide, ...(image?.ok && image.base64 ? { image: image.base64, cameraCapturedAt: image.capturedAt, cameraSource: image.source } : {}) };
          const size = JSON.stringify(entry).length * 2;
          if (bytes + size > limit || records.length >= 1200) { stop(); message = "Recording limit reached. Export this session to continue."; return; }
          records = [...records, entry]; bytes += size; preview = records.length-1;
        }
      } catch (e) { if (captureSession === session) { error = errorText(e); stop(); } }
    }
    if (recording && active && captureSession === session) timer = setTimeout(() => capture(captureSession), 1000);
  }
  async function start() {
    if (starting || recording) return;
    starting = true;
    error = ""; message = "";
    try {
      system = await requestBench<BoardSystem>(vehicleId, "system");
      if (!active) return;
      ++session; recordedVehicleId = vehicleId; records = []; bytes = 0; preview = 0; recording = true; await capture(session);
    } catch (e) { error = errorText(e); }
    finally { starting = false; }
  }
  function exportRecording() {
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, vehicleId: recordedVehicleId, system, records })], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = exportUrl; anchor.download = `scout-sensors-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
    anchor.click();
  }
  async function load(event: Event) {
    const input = event.currentTarget as HTMLInputElement, file = input.files?.[0];
    if (!file) return;
    error = "";
    try {
      if (file.size > limit) throw new Error("Recording is larger than 24 MiB.");
      const next = JSON.parse(await file.text()) as { version?: number; vehicleId?: string; records?: RecordEntry[]; system?: BoardSystem };
      if (next.version !== 1 || !Array.isArray(next.records) || next.records.length > 1200 || !next.records.every(entry => entry && typeof entry.receivedAt === "string" && "samples" in entry && "wide" in entry && (entry.image === undefined || typeof entry.image === "string" && /^[A-Za-z0-9+/=]+$/.test(entry.image)))) throw new Error("This is not a Scout sensor recording.");
      stop(); recordedVehicleId = next.vehicleId ?? "unknown"; records = next.records; system = next.system ?? null; preview = 0; bytes = file.size; message = "Recording loaded for review.";
    } catch (e) { error = errorText(e); }
    finally { input.value = ""; }
  }
  onDestroy(() => { active = false; stop(); if (exportUrl) URL.revokeObjectURL(exportUrl); });
</script>
<details use:revealDetails><summary>Sensor recording</summary>
  <p class="hint">Capture cached sensor samples and wide frames about once a second. Optional camera frames come from Scout's shared stream. Export before leaving Drive.</p>
  <label class="inline"><input type="checkbox" bind:checked={includeImages} disabled={recording || starting} /> Include camera frames</label>
  <div class="button-row">
    {#if recording}<button on:click={stop}>Stop recording</button>{:else}<button disabled={starting || !!$boardOperations[vehicleId]} on:click={start}>Start {records.length ? "new " : ""}recording</button>{/if}
    <button on:click={exportRecording} disabled={!records.length || recording || starting}>Export JSON</button>
  </div>
  <label>Open saved recording<input type="file" accept=".json,application/json" on:change={load} disabled={recording || starting} /></label>
  <p class="hint" role="status">{records.length} samples · {(bytes/1024/1024).toFixed(1)} MiB{recording ? $boardOperations[vehicleId] ? " · paused during board operation" : " · recording" : ""}</p>
  {#if records.length}
    <label>Review sample<input type="range" min="0" max={records.length-1} step="1" bind:value={preview} disabled={recording || starting} /></label>
    <p class="hint">{records[preview]?.receivedAt}</p>
    {#if records[preview]?.image}<img class="recorded-frame" src={`data:image/jpeg;base64,${records[preview].image}`} alt="Camera frame from the selected recording sample" />{/if}
    <details use:revealDetails><summary>Selected sample data</summary><pre>{JSON.stringify(records[preview]?.samples, null, 2)}</pre></details>
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</details>
