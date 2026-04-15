import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface HRPosition {
  id: string;
  account_id: string;
  title: string;
  department_id: string | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  responsibilities: string[];
  technical_skills: string[];
  behavioral_skills: string[];
  requirements: string | null;
  education_level: string | null;
  experience_years: number | null;
  career_path: string | null;
  next_position_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const KEY = "hr_positions";

export function useHRPositions() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();

  const { data: positions = [], isLoading: loading } = useQuery({
    queryKey: [KEY, currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_positions")
        .select("*")
        .eq("account_id", currentUser!.account_id)
        .order("title");
      if (error) throw error;
      return (data || []) as unknown as HRPosition[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const createMutation = useMutation({
    mutationFn: async (input: Partial<HRPosition>) => {
      const { error } = await supabase.from("hr_positions").insert({
        ...input,
        account_id: currentUser!.account_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cargo criado!"); invalidate(); },
    onError: () => toast.error("Erro ao criar cargo"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<HRPosition> & { id: string }) => {
      const { error } = await supabase.from("hr_positions").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cargo atualizado!"); invalidate(); },
    onError: () => toast.error("Erro ao atualizar cargo"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_positions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cargo excluído!"); invalidate(); },
    onError: () => toast.error("Erro ao excluir cargo"),
  });

  return {
    positions,
    loading,
    createPosition: createMutation.mutateAsync,
    updatePosition: updateMutation.mutateAsync,
    deletePosition: deleteMutation.mutateAsync,
  };
}
