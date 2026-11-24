import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { fetchAllInChunks } from "@/lib/fetchInChunks";
import { indexPipelineFieldValues, type PipelineFieldValueRow } from "@/lib/sales/pipelineFilterValues";

export async function fetchPipelineFilterValues(accountId: string, dealIds: string[], fieldIds: string[]) {
  if (!accountId || !dealIds.length || !fieldIds.length) return {};
  const rows = await fetchAllInChunks<PipelineFieldValueRow>(dealIds, 100, (batch, from, to) => supabase
    .from("deal_field_values")
    .select("deal_id, field_id, value_text, value_number, value_date, value_json, value_boolean")
    .eq("account_id", accountId).in("deal_id", batch).in("field_id", fieldIds)
    .order("id").range(from, to));
  return indexPipelineFieldValues(rows);
}

export function usePipelineFilterValues(deals: ReadonlyArray<{ id: string; updated_at?: string }>, fieldIds: string[], refreshKey: number = 0) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const userId = currentUser?.id;
  const idsKey = [...new Set(deals.map(deal => deal.id))].sort().join(",");
  const fieldsKey = [...new Set(fieldIds)].sort().join(",");
  const revision = deals.map(deal => `${deal.id}:${deal.updated_at ?? ""}`).sort().join(",");
  const enabled = Boolean(accountId && userId && idsKey && fieldsKey);
  const query = useQuery({
    queryKey: ["pipeline-filter-values", accountId, userId, idsKey, fieldsKey, revision, refreshKey],
    enabled,
    queryFn: () => accountId ? fetchPipelineFilterValues(accountId, idsKey.split(","), fieldsKey.split(",")) : Promise.resolve({}),
    staleTime: 0,
  });
  const values = useMemo(() => query.data ?? {}, [query.data]);
  return { values, loading: enabled && query.isPending, error: enabled && query.isError };
}