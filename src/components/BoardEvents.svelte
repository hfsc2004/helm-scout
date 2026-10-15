<script lang="ts">
  import { enterToApply } from "../actions/enterToApply";
  import { onDestroy } from "svelte";
  import type { BoardEvents, BoardEvent } from "@shared/bench";
  import { persistentDetails } from "../actions/persistentDetails";
  import { requestBench, sensorLabel, errorText } from "../lib/bench";
  import { boardOperations, boardEpoch } from "../lib/bench-activity";
  export let vehicleId: string;
  let opened = false, active = true, busy = false, loading = false, error = "", message = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let bootId: number | null = null, cursor = 0;
  let events: BoardEvent[] = [], configured = false;
  let proximityMm = 300, tiltDeg = 30, impactG = 2, motionDps = 10;
  function schedule() {
    if (timer) clearTimeout(timer);
    if (active && opened) timer = setTimeout(poll, 2000);
  }
  async function poll() {
    if (!active || !opened || loading) return;
    if (!$boardOperations[vehicleId]) {
      loading = true; const epoch = boardEpoch(vehicleId);
      try {
        let next = await requestBench<BoardEvents>(vehicleId, "events", { after: cursor });
        if (!active || epoch !== boardEpoch(vehicleId)) return;
        if (!Array.isArray(next.events) || !next.thresholds) throw new Error("Event controls unavailable in this firmware.");
        if (bootId !== null && bootId !== next.bootId) {
          cursor = 0; events = []; next = await requestBench<BoardEvents>(vehicleId, "events", { after: 0 });
        }
        if (!active || epoch !== boardEpoch(vehicleId)) return;
        if (!configured) { ({ proximityMm, tiltDeg, impactG, motionDps } = next.thresholds); configured = true; }
        if (next.gap) message = "Some older events have expired from the board's history.";
        bootId = next.bootId; cursor = next.latest;
        const combined = new Map([...events, ...next.events].map(event => [event.sequence, event]));
        events = [...combined.values()].sort((a,b) => b.sequence-a.sequence).slice(0,100); error = "";
      } catch (e) { if (active) error = errorText(e); }
      finally { loading = false; schedule(); }
    }
    schedule();
  }
  function toggle(event: Event) {
    opened = (event.currentTarget as HTMLDetailsElement).open;
    if (timer) clearTimeout(timer);
    if (opened) void poll();
  }
  async function apply() {
    busy = true; error = "";
    try {
      const next = await requestBench<BoardEvents>(vehicleId, "events-set", { proximityMm: Number(proximityMm), tiltDeg: Number(tiltDeg), impactG: Number(impactG), motionDps: Number(motionDps) });
      ({ proximityMm, tiltDeg, impactG, motionDps } = next.thresholds);
      message = "Thresholds applied. Save boot defaults under Board status to retain them.";
    } catch (e) { error = errorText(e); }
    finally { busy = false; }
  }
  const valueText = (event: BoardEvent) => `${event.value.toFixed(event.type === "proximity" ? 0 : 1)} ${event.type === "proximity" ? "mm" : event.type === "tilt" ? "°" : event.type === "impact" ? "g" : "°/s"}`;
  onDestroy(() => { active = false; if (timer) clearTimeout(timer); });
</script>
<details use:persistentDetails={{ vehicleId, section: "events" }} on:toggle={toggle}>
  <summary>Sensor events</summary>
  <div class="bench-controls">
    <form use:enterToApply on:submit|preventDefault={apply}>
      <label>Proximity (mm)<input type="number" min="50" max="4000" step="1" bind:value={proximityMm} required /></label>
      <label>Tilt (°)<input type="number" min="5" max="85" step="0.1" bind:value={tiltDeg} required /></label>
      <label>Impact (g)<input type="number" min="1.2" max="3.5" step="0.1" bind:value={impactG} required /></label>
      <label>Motion (°/s)<input type="number" min="1" max="200" step="0.1" bind:value={motionDps} required /></label>
      <button type="submit" disabled={busy || !configured || !!$boardOperations[vehicleId]}>Apply thresholds</button>
    </form>
    <p class="hint">Events are diagnostic indicators. Missing readings never mean a clear path. History resets when the board reboots.</p>
    {#if message}<p role="status">{message}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <ol class="event-list" aria-label="Recent sensor events">
      {#each events as event (`${bootId}-${event.sequence}`)}<li><strong>{sensorLabel(event.sensor)} · {event.type}</strong><span>{event.active ? "Detected" : "Cleared"} · {valueText(event)}</span><small>{(event.atMs/1000).toFixed(1)}s after boot</small></li>{/each}
    </ol>
    {#if !events.length}<p class="hint">{configured ? "No recent events." : "Open this section to read events."}</p>{/if}
  </div>
</details>
