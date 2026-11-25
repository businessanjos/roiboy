import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { PIPELINE_ITEM_VENDA_FIELD_ID } from "@/lib/sales/pipelineFilterValues";
import { summarizeAccelerometerMeetings, type AccelerometerMeeting } from "@/lib/sales/accelerometer";
import { useCurrentUser } from "./useCurrentUser";

export function useAccelerometerMeetings(start: string, end: string, userId?: string, enabled = true) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  return useQuery({
    queryKey: ["accelerometer-program-meetings", accountId, currentUser?.id, userId, start, end],
    enabled: Boolean(enabled && accountId && userId),
    queryFn: async () => {
      if (!accountId || !userId) throw new Error("Sessão indisponível");
      const tasks = await fetchAllRows<AccelerometerMeeting>((from, to) => supabase.from("internal_tasks")
        .select("id, title, created_at, completed_at, client_id, lead_id, deal_id, activity_types!internal_tasks_activity_type_id_fkey(name)")
        .eq("account_id", accountId).eq("assigned_to", userId)
        .or(`and(created_at.gte.${start},created_at.lte.${end}),and(completed_at.gte.${start},completed_at.lte.${end})`)
        .order("id").range(from, to));
      if (tasks.error) throw tasks.error;
      const dealIds = [...new Set(tasks.data.flatMap(task => task.deal_id ? [task.deal_id] : []))];
      const items = new Map<string, string | null>();
      for (let offset = 0; offset < dealIds.length; offset += 150) {
        const deals = await supabase.from("deals").select("id").eq("account_id", accountId)
          .is("deleted_at", null).in("id", dealIds.slice(offset, offset + 150));
        if (deals.error) throw deals.error;
        const visibleIds = (deals.data ?? []).map(deal => deal.id);
        if (!visibleIds.length) continue;
        const fields = await fetchAllRows<{ deal_id: string; value_text: string | null }>((from, to) => supabase.from("deal_field_values")
          .select("deal_id, value_text").eq("field_id", PIPELINE_ITEM_VENDA_FIELD_ID).in("deal_id", visibleIds)
          .order("id").range(from, to));
        if (fields.error) throw fields.error;
        for (const field of fields.data) items.set(field.deal_id, field.value_text);
      }
      const [products, field] = await Promise.all([
        fetchAllRows<{ id: string; name: string }>((from, to) => supabase.from("products").select("id, name")
          .eq("account_id", accountId).order("id").range(from, to)),
        supabase.from("custom_fields").select("options").eq("id", PIPELINE_ITEM_VENDA_FIELD_ID).maybeSingle(),
      ]);
      if (products.error) throw products.error;
      if (field.error) throw field.error;
      const options = field.data?.options;
      const itemOptions = Array.isArray(options) ? options.flatMap(option => {
        if (!option || typeof option !== "object" || Array.isArray(option)) return [];
        return typeof option.value === "string" && typeof option.label === "string"
          ? [{ value: option.value, label: option.label }] : [];
      }) : [];
      return summarizeAccelerometerMeetings(tasks.data, items, "programas", userId, start, end, { products: products.data, itemOptions });
    },
  });
}