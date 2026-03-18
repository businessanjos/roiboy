

## Problem

The `list-clients` edge function always orders clients by `full_name` ascending (alphabetical). The frontend tries to sort locally by `created_at` descending, but this only reorders the current page — it doesn't fix which clients appear on page 1. New clients (recently triaged) end up on later pages because alphabetically they're not in the first batch.

## Solution

1. **Edge function (`supabase/functions/list-clients/index.ts`)**: Accept a `sort` query parameter (`recent` or `alphabetical`). Default to `recent` (i.e., `created_at` descending). Change the `.order()` call accordingly.

2. **Frontend hook (`src/hooks/useOptimizedClients.tsx`)**: Pass the sort parameter to the edge function URL. Add `sortOrder` to the options interface and query key.

3. **Frontend page (`src/pages/Clients.tsx`)**: Pass `sortOrder` to `useOptimizedClients` and remove the local `.sort()` since sorting is now server-side.

## Changes

### `supabase/functions/list-clients/index.ts`
- Parse `sort` query param (default: `"recent"`)
- Change `.order("full_name", { ascending: true })` to conditionally order by `created_at desc` or `full_name asc`

### `src/hooks/useOptimizedClients.tsx`
- Add `sortOrder?: "recent" | "alphabetical"` to options
- Pass `sort` param in the fetch URL
- Add to query key and useEffect reset dependencies

### `src/pages/Clients.tsx`
- Pass `sortOrder` to `useOptimizedClients`
- Remove the local `.sort()` logic since server handles it

