// SPDX-License-Identifier: Apache-2.0
/** Submit numeric settings with Enter, including keyboards' numpad Enter. */
export function enterToApply(form: HTMLFormElement) {
  function keydown(event: KeyboardEvent) {
    if (event.key !== "Enter" || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof HTMLInputElement) || event.target.type !== "number") return;
    event.preventDefault();
    if (event.repeat) return;
    const apply = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (apply && !apply.disabled) form.requestSubmit(apply);
  }
  form.addEventListener("keydown", keydown);
  return { destroy() { form.removeEventListener("keydown", keydown); } };
}
