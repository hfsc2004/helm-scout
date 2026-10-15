// SPDX-License-Identifier: Apache-2.0
import { get, writable } from "svelte/store";
export const boardOperations = writable<Record<string, string>>({});
const epochs: Record<string, number> = {};
export const boardEpoch = (id: string) => epochs[id] ?? 0;
export async function withBoardOperation<T>(id: string, label: string, operation: () => Promise<T>): Promise<T> {
  if (get(boardOperations)[id]) throw new Error("Wait for the current board operation to finish.");
  epochs[id] = boardEpoch(id) + 1;
  boardOperations.update(current => ({ ...current, [id]: label }));
  try { return await operation(); }
  finally {
    epochs[id] = boardEpoch(id) + 1;
    boardOperations.update(current => { const next = { ...current }; delete next[id]; return next; });
  }
}
