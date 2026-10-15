import { revealDetails } from "./revealDetails";
// SPDX-License-Identifier: Apache-2.0
/** Remember each Drive section independently for each vehicle. */
export function persistentDetails(node: HTMLDetailsElement, options: { vehicleId: string | null; section: string; defaultOpen?: boolean }) {
  let storageKey = "";
  function restore(next: typeof options): void {
    reveal.reset();
    storageKey = `psf-helm:drive-section:${next.vehicleId ?? "none"}:${next.section}`;
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); }
    catch { /* Storage may be disabled. Keep the section usable. */ }
    node.open = saved === "true" || (saved !== "false" && next.defaultOpen === true);
  }
  function save(): void {
    try { localStorage.setItem(storageKey, String(node.open)); }
    catch { /* Keep native expand/collapse working without persistence. */ }
  }
  const reveal = revealDetails(node);
  restore(options);
  node.addEventListener("toggle", save);
  return {
    update(next: typeof options) {
      const nextKey = `psf-helm:drive-section:${next.vehicleId ?? "none"}:${next.section}`;
      if (nextKey !== storageKey) restore(next);
    },
    destroy() { reveal.destroy(); node.removeEventListener("toggle", save); },
  };
}
