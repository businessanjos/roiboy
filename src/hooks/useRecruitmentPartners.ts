import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface RecruitmentPartner {
  id: string;
  full_name: string;
  company_name: string | null;
  recruitment_commission_pct: number | null;
}

export function useRecruitmentPartners() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["recruitment-partners", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async (): Promise<RecruitmentPartner[]> => {
      const { data, error } = await supabase
        .from("hr_service_providers")
        .select("id, full_name, company_name, recruitment_commission_pct, is_recruitment_partner, status" as any)
        .eq("account_id", currentUser!.account_id)
        .order("full_name");
      if (error) throw error;
      return ((data || []) as any[])
        .filter((p) => p.is_recruitment_partner && p.status !== "terminated")
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          company_name: p.company_name,
          recruitment_commission_pct: p.recruitment_commission_pct,
        }));
    },
  });
}
