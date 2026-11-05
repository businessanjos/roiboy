import { supabase } from "@/integrations/supabase/client";
import {
  fetchInternalClientSplit as splitCore,
  fetchInternalClientIds as idsCore,
} from "./internalClientsCore";

export type { InternalClientSplit } from "./internalClientsCore";
export { applyInternalClientExclusion } from "./internalClientsCore";

export function fetchInternalClientSplit(client: any = supabase, accountId?: string | null) {
  return splitCore(client, accountId);
}

export function fetchInternalClientIds(client: any = supabase, accountId?: string | null) {
  return idsCore(client, accountId);
}
