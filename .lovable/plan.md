

## Problem

The network request shows `sort=alphabetical` being sent even though "Mais recentes" is selected. Looking at the edge function code, the sorting logic is already correctly implemented (using `sortParam` to conditionally sort by `created_at DESC` or `full_name ASC`). 

The most likely cause is that the **edge function needs to be redeployed** — the code file was updated but the running function may still be an older version without the sort parameter support.

Additionally, there may be a **stale persisted filter** issue: the `usePersistedFilter` hook stores "alphabetical" in localStorage from a previous session, and when the user switches to "Mais recentes", the debounced fetch (800ms delay) means there's a lag before the new data loads.

## Plan

1. **Redeploy the `list-clients` edge function** — this ensures the deployed version matches the code with the sort parameter support.

2. **Verify the edge function sorting logic** — the current code on line 230 already has:
   ```
   .order(sortParam === "alphabetical" ? "full_name" : "created_at", { ascending: sortParam === "alphabetical" })
   ```
   This is correct — when `sort=recent`, it orders by `created_at` descending.

No code changes needed — just a redeployment of the edge function.

