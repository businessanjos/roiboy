/**
 * Mobile RoyZapp selection is driven by history state, applied once per history entry.
 * Later assignment refreshes (realtime/async) must never re-apply an old entry's state
 * over a conversation opened programmatically (notification, deep link).
 */
export interface ZappHistoryState {
  zappSelection?: string;
  zappList?: boolean;
}

export type ZappHistoryAction =
  | { type: "none" }
  | { type: "wait" }
  | { type: "select"; id: string }
  | { type: "list" };

export function resolveZappHistorySelection(
  locationKey: string,
  state: ZappHistoryState | null | undefined,
  appliedKey: string | null,
  assignmentIds: readonly string[],
): ZappHistoryAction {
  if (appliedKey === locationKey) return { type: "none" };
  const selectionId = state?.zappSelection;
  if (typeof selectionId === "string") {
    return assignmentIds.includes(selectionId) ? { type: "select", id: selectionId } : { type: "wait" };
  }
  if (state?.zappList) return { type: "list" };
  return { type: "none" };
}

/** Two navigations: mark the current entry as the list, then push the selection. */
export function zappSelectionHistoryStates(
  current: Record<string, unknown> | null | undefined,
  selectionId: string,
) {
  return {
    listEntry: { ...(current ?? {}), zappList: true, zappSelection: undefined },
    selectionEntry: { ...(current ?? {}), zappList: false, zappSelection: selectionId },
  };
}
