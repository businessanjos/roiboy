import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { startOfMonth, endOfMonth } from "date-fns";

export interface TrafficAgency {
  id: string;
  account_id: string;
  name: string;
  color: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // computed
  campaignsCount?: number;
  spendThisMonth?: number;
  leadsThisMonth?: number;
  membersCount?: number;
  openRequests?: number;
}

export function useTrafficAgencies() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  return useQuery({
    queryKey: ["traffic-agencies", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<TrafficAgency[]> => {
      const sb: any = supabase;
      const { data: agencies = [], error } = await sb
        .from("traffic_agencies")
        .select("*")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;

      const ids = (agencies as TrafficAgency[]).map((a) => a.id);
      if (!ids.length) return agencies as TrafficAgency[];

      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

      const [adsRes, membersRes, requestsRes, dealsRes] = await Promise.all([
        sb
          .from("marketing_ad_sets")
          .select("agency_id, spend")
          .in("agency_id", ids),
        sb.from("traffic_agency_members").select("agency_id").in("agency_id", ids),
        sb
          .from("marketing_material_requests")
          .select("agency_id, status")
          .in("agency_id", ids),
        sb
          .from("deals")
          .select("agency_id, created_at")
          .in("agency_id", ids)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd),
      ]);

      const counts: Record<string, { camp: number; spend: number; mem: number; req: number; leads: number }> = {};
      ids.forEach((id) => (counts[id] = { camp: 0, spend: 0, mem: 0, req: 0, leads: 0 }));
      for (const a of (adsRes.data || []) as any[]) {
        const c = counts[a.agency_id];
        if (!c) continue;
        c.camp++;
        c.spend += Number(a.spend) || 0;
      }
      for (const m of (membersRes.data || []) as any[]) {
        if (counts[m.agency_id]) counts[m.agency_id].mem++;
      }
      for (const r of (requestsRes.data || []) as any[]) {
        if (counts[r.agency_id] && r.status !== "entregue" && r.status !== "cancelado") {
          counts[r.agency_id].req++;
        }
      }
      for (const d of (dealsRes.data || []) as any[]) {
        if (counts[d.agency_id]) counts[d.agency_id].leads++;
      }

      return (agencies as TrafficAgency[]).map((a) => ({
        ...a,
        campaignsCount: counts[a.id].camp,
        spendThisMonth: counts[a.id].spend,
        membersCount: counts[a.id].mem,
        openRequests: counts[a.id].req,
        leadsThisMonth: counts[a.id].leads,
      }));
    },
  });
}

export function useTrafficAgency(agencyId?: string) {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["traffic-agency", agencyId],
    enabled: !!agencyId && !!currentUser,
    queryFn: async (): Promise<TrafficAgency | null> => {
      const sb: any = supabase;
      const { data } = await sb
        .from("traffic_agencies")
        .select("*")
        .eq("id", agencyId)
        .maybeSingle();
      return data as TrafficAgency | null;
    },
  });
}
