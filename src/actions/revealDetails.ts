// SPDX-License-Identifier: Apache-2.0
/** Compute the smallest scroll that reveals a section, keeping tall headings visible. */
export function revealScrollTop(panelTop: number, panelBottom: number, viewportTop: number, viewportBottom: number,
  scrollTop: number, maxScroll: number): number | null {
  let target = scrollTop;
  if (panelBottom - panelTop > viewportBottom - viewportTop || panelTop < viewportTop) target += panelTop - viewportTop;
  else if (panelBottom > viewportBottom) target += panelBottom - viewportBottom;
  target = Math.max(0, Math.min(maxScroll, target));
  return Math.abs(target - scrollTop) > 0.5 ? target : null;
}

/** Reveal only deliberate summary clicks/keyboard toggles; restoring preferences never scrolls. */
export function revealDetails(node: HTMLDetailsElement) {
  let container: HTMLElement | null = null;
  let frame = 0, pending = false, interaction = 0;
  let previousScroll: number | null = null, autoRevealed = false, manuallyMoved = false;
  function manuallyScroll() { manuallyMoved = true; }
  function otherSection(event: Event) {
    if (event.target instanceof Element && event.target.closest("summary")?.parentElement !== node) manuallyMoved = true;
  }
  function scrollKey(event: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(event.key)) manuallyMoved = true;
  }
  function detachContainer() {
    container?.removeEventListener("wheel", manuallyScroll);
    container?.removeEventListener("touchmove", manuallyScroll);
    container?.removeEventListener("keydown", scrollKey);
    container?.removeEventListener("click", otherSection);
  }
  function findContainer() {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.clientHeight > 0) return parent;
    }
    return null;
  }
  function prepare(event: Event) {
    if (!(event.target instanceof Element) || event.target.closest("summary")?.parentElement !== node || event.defaultPrevented) return;
    if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
    if (event instanceof MouseEvent && event.button !== 0) return;
    const nextContainer = findContainer();
    if (!nextContainer) return;
    if (container !== nextContainer) {
      detachContainer(); container = nextContainer;
      container.addEventListener("wheel", manuallyScroll, { passive: true });
      container.addEventListener("touchmove", manuallyScroll, { passive: true });
      container.addEventListener("keydown", scrollKey);
      container.addEventListener("click", otherSection);
    }
    if (!node.open) { previousScroll = container.scrollTop; autoRevealed = false; manuallyMoved = false; }
    pending = true;
    const currentInteraction = ++interaction;
    queueMicrotask(() => { if (event.defaultPrevented && interaction === currentInteraction) pending = false; });
  }
  function reveal() {
    if (!pending || !container) return;
    pending = false;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!container || !node.isConnected) return;
      const bounds = container.getBoundingClientRect(), section = node.getBoundingClientRect();
      const top = bounds.top + container.clientTop + 8;
      const bottom = Math.min(bounds.top + container.clientTop + container.clientHeight, window.innerHeight) - 8;
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      let target = revealScrollTop(section.top, section.bottom, top, bottom, container.scrollTop, maxScroll);
      if (!node.open && autoRevealed && !manuallyMoved && previousScroll !== null) {
        // Restore the pre-expansion view, but keep the collapsed heading visible
        // if content elsewhere changed height while this section was open.
        const minimum = Math.max(0, container.scrollTop + section.bottom - bottom);
        const maximum = Math.min(maxScroll, container.scrollTop + section.top - top);
        if (minimum <= maximum) target = Math.max(minimum, Math.min(maximum, previousScroll));
      }
      if (target !== null) {
        container.scrollTo({ top: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        if (node.open) autoRevealed = true;
      }
      if (!node.open) { previousScroll = null; autoRevealed = false; }
    });
  }
  node.addEventListener("click", prepare);
  node.addEventListener("keydown", prepare);
  node.addEventListener("toggle", reveal);
  return { reset() {
    ++interaction; pending = false; previousScroll = null; autoRevealed = false; manuallyMoved = false;
    cancelAnimationFrame(frame); detachContainer(); container = null;
  }, destroy() {
    cancelAnimationFrame(frame); detachContainer();
    node.removeEventListener("click", prepare); node.removeEventListener("keydown", prepare); node.removeEventListener("toggle", reveal);
  } };
}
