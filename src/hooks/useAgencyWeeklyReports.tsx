import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface AgencyWeeklyReport {
  id: string;
  account_id: string;
  agency_id: string;
  week_start: string;
  week_end: string;
  spend: number;
  cpl: number | null;
  cost_per_mql: number | null;
  cpm: number | null;
  impressions: number;
  link_clicks: number;
  page_views: number;
  leads_total: number;
  leads_mql: number;
  ctr: number | null;
  connect_rate: number | null;
  mql_rate: number | null;
  lp_conversion_rate: number | null;
  best_creative_name: string | null;
  best_creative_spend: number | null;
  best_creative_mqls: number | null;
  best_creative_cpa: number | null;
  best_creative_url: string | null;
  best_creative_notes: string | null;
  comparison_notes: string | null;
  evolution_notes: string | null;
  bottleneck_notes: string | null;
  team_actions: string | null;
  client_dependencies: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export type AgencyWeeklyReportInput = Partial<AgencyWeeklyReport> & {
  agency_id: string;
  week_start: string;
  week_end: string;
};

export function useAgencyWeeklyReports(agencyId?: string) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["agency-weekly-reports", agencyId, accountId],
    enabled: !!agencyId && !!accountId,
    queryFn: async (): Promise<AgencyWeeklyReport[]> => {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("agency_weekly_reports")
        .select("*")
        .eq("agency_id", agencyId)
        .order("week_start", { ascending: false });
      if (error) throw error;
      return (data || []) as AgencyWeeklyReport[];
    },
  });

  const save = useMutation({
    mutationFn: async (input: AgencyWeeklyReportInput) => {
      if (!accountId) throw new Error("Sem conta ativa");
      const sb: any = supabase;
      const payload = { ...input, account_id: accountId };
      if (input.id) {
        const { error } = await sb.from("agency_weekly_reports").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("agency_weekly_reports").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency-weekly-reports", agencyId, accountId] });
      toast.success("Relatório semanal salvo");
    },
    onError: (e: any) =>
      toast.error(
        e?.code === "23505" ? "Já existe um relatório para essa semana" : e.message || "Erro ao salvar",
      ),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const sb: any = supabase;
      const { error } = await sb.from("agency_weekly_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency-weekly-reports", agencyId, accountId] });
      toast.success("Relatório excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { reports: query.data ?? [], isLoading: query.isLoading, save, remove };
}
