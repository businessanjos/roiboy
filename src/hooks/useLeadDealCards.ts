import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLeadDealCards(leadId: string | null, userId: string | undefined, open: boolean) {
  const client = useQueryClient();
  const key = ["lead-deal-cards", userId, leadId];
  const query = useQuery({
    queryKey: key,
    enabled: open && !!leadId && !!userId,
    refetchInterval: open ? 15000 : false,
    queryFn: async () => {
      if (!leadId || !userId) return { deals: [], presence: [], pendingIds: [] as string[] };
      const [{ data: deals, error }, { data: presence, error: presenceError }] = await Promise.all([
        supabase.from("deals")
          .select("id, title, status, value, responsible_user_id, stage:deal_stages(name), responsible:users!deals_responsible_user_id_fkey(name)")
          .eq("lead_id", leadId).is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.rpc("get_lead_deal_presence", { p_lead_id: leadId }),
      ]);
      if (error) throw error;
      if (presenceError) throw presenceError;
      const ids = (presence || []).map((deal) => deal.id);
      const { data: pending, error: pendingError } = ids.length
        ? await supabase.from("deal_transfer_requests").select("deal_id")
          .eq("requester_id", userId).eq("status", "pending").in("deal_id", ids)
        : { data: [], error: null };
      if (pendingError) throw pendingError;
      return { deals: deals || [], presence: presence || [], pendingIds: (pending || []).map((r) => r.deal_id) };
    },
  });

  useEffect(() => {
    if (!open || !leadId || !userId) return;
    const refresh = () => { void client.invalidateQueries({ queryKey: ["lead-deal-cards", userId, leadId] }); };
    const channel = supabase.channel(`lead-deal-cards-${userId}-${leadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `lead_id=eq.${leadId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_transfer_requests", filter: `requester_id=eq.${userId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        if (["deal_transfer_decision", "deal_transferred"].includes(payload.new.type)) refresh();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [open, leadId, userId, client]);

  return query;
}