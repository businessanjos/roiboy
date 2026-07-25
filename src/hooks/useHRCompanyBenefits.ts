import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface HRCompanyBenefit {
  id: string;
  account_id: string;
  name: string;
  category: string;
  provider: string | null;
  description: string | null;
  monthly_value: number | null;
  employee_contribution: number | null;
  contract_types: string[];
  is_highlight: boolean;
  include_in_jobs_by_default: boolean;
  use_in_benchmark: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const BENEFIT_CATEGORY_LABELS: Record<string, string> = {
  saude: "Saúde e bem-estar",
  alimentacao: "Alimentação",
  transporte: "Transporte / mobilidade",
  educacao: "Educação e desenvolvimento",
  financeiro: "Financeiro e incentivos",
  flexibilidade: "Flexibilidade e tempo",
  familia: "Família e parentalidade",
  outros: "Outros",
};

const KEY = "hr_company_benefits";

export function useHRCompanyBenefits() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();

  const { data: benefits = [], isLoading: loading } = useQuery({
    queryKey: [KEY, currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_company_benefits")
        .select("*")
        .eq("account_id", currentUser!.account_id)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as HRCompanyBenefit[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const createMutation = useMutation({
    mutationFn: async (input: Partial<HRCompanyBenefit>) => {
      const { error } = await supabase.from("hr_company_benefits").insert({
        ...input,
        account_id: currentUser!.account_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Benefício cadastrado!"); invalidate(); },
    onError: () => toast.error("Erro ao cadastrar benefício"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<HRCompanyBenefit> & { id: string }) => {
      const { error } = await supabase.from("hr_company_benefits").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); },
    onError: () => toast.error("Erro ao atualizar benefício"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_company_benefits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Benefício removido!"); invalidate(); },
    onError: () => toast.error("Erro ao remover benefício"),
  });

  return {
    benefits,
    loading,
    activeBenefits: benefits.filter((b) => b.is_active),
    createBenefit: createMutation.mutateAsync,
    updateBenefit: updateMutation.mutateAsync,
    deleteBenefit: deleteMutation.mutateAsync,
  };
}
