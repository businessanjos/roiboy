import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface JobStage {
  id: string;
  job_id: string;
  account_id: string;
  name: string;
  order_index: number;
  sla_days: number | null;
  owner_role: string | null;
  owner_name: string | null;
  owner_provider_id: string | null;
  evaluation_criteria: string[];
  what_to_do: string | null;
  test_or_material: string | null;
  ai_focus: string | null;
  created_at: string;
  updated_at: string;
}

export type JobStageDraft = Omit<JobStage, "id" | "account_id" | "created_at" | "updated_at" | "job_id"> & {
  id?: string;
};

export function useHRJobStages(jobId: string | undefined) {
  return useQuery({
    queryKey: ["hr-job-stages", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("hr_job_stages" as any)
        .select("*")
        .eq("job_id", jobId)
        .order("order_index");
      if (error) throw error;
      return (data || []) as unknown as JobStage[];
    },
  });
}

export function useReplaceHRJobStages() {
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ jobId, stages }: { jobId: string; stages: JobStageDraft[] }) => {
      if (!currentUser?.account_id) throw new Error("Conta não encontrada");
      // Replace all stages: delete then insert
      const { error: delErr } = await supabase.from("hr_job_stages" as any).delete().eq("job_id", jobId);
      if (delErr) throw delErr;
      if (!stages.length) return [];
      const rows = stages.map((s, i) => ({
        job_id: jobId,
        account_id: currentUser.account_id,
        name: s.name,
        order_index: i,
        sla_days: s.sla_days ?? null,
        owner_role: s.owner_role ?? null,
        owner_name: s.owner_name ?? null,
        owner_provider_id: (s as any).owner_provider_id ?? null,
        evaluation_criteria: s.evaluation_criteria || [],
        what_to_do: s.what_to_do ?? null,
        test_or_material: s.test_or_material ?? null,
        ai_focus: null,
      }));
      const { data, error } = await supabase.from("hr_job_stages" as any).insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["hr-job-stages", vars.jobId] });
      toast.success("Etapas salvas!");
    },
    onError: (e: any) => toast.error("Erro ao salvar etapas: " + e.message),
  });
}

export async function suggestStagesAI(input: {
  title: string;
  description?: string;
  seniority?: string;
  contract_type?: string;
  department?: string;
}): Promise<JobStageDraft[]> {
  const { data, error } = await supabase.functions.invoke("suggest-job-stages", { body: input });
  if (error) throw error;
  const stages = (data?.stages || []) as any[];
  return stages.map((s, i) => ({
    name: String(s.name || `Etapa ${i + 1}`),
    order_index: i,
    sla_days: typeof s.sla_days === "number" ? s.sla_days : null,
    owner_role: s.owner_role || null,
    owner_name: s.owner_name || null,
    owner_provider_id: null,
    evaluation_criteria: Array.isArray(s.evaluation_criteria) ? s.evaluation_criteria.map(String) : [],
    what_to_do: s.what_to_do || null,
    test_or_material: s.test_or_material || null,
    ai_focus: null,
  }));
}

export async function analyzeCandidateMatchAI(applicationId: string) {
  const { data, error } = await supabase.functions.invoke("analyze-candidate-match", {
    body: { application_id: applicationId },
  });
  if (error) throw error;
  return data as { ok: boolean; score: number; report: any };
}

export function useAccountUsersForJobs() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["account-users-for-jobs", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("account_id", currentUser!.account_id)
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string; email: string }[];
    },
  });
}
