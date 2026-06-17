import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import type { TerminationType, NoticeType } from "@/lib/rescissionCalc";

export type OffboardingStage =
  | "opened"
  | "documentation"
  | "rescission"
  | "access_cutoff"
  | "exit_interview"
  | "completed"
  | "cancelled";

export const OFFBOARDING_STAGES: OffboardingStage[] = [
  "opened","documentation","rescission","access_cutoff","exit_interview","completed",
];

export const OFFBOARDING_STAGE_LABELS: Record<OffboardingStage, string> = {
  opened: "Aberto",
  documentation: "Documentação",
  rescission: "Rescisão",
  access_cutoff: "Corte de Acessos",
  exit_interview: "Entrevista de Saída",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const OFFBOARDING_STAGE_COLORS: Record<OffboardingStage, string> = {
  opened: "bg-slate-500/10 text-slate-700 border-slate-200",
  documentation: "bg-amber-500/10 text-amber-700 border-amber-200",
  rescission: "bg-blue-500/10 text-blue-700 border-blue-200",
  access_cutoff: "bg-orange-500/10 text-orange-700 border-orange-200",
  exit_interview: "bg-violet-500/10 text-violet-700 border-violet-200",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-500/10 text-rose-700 border-rose-200",
};

export interface HROffboarding {
  id: string;
  account_id: string;
  collaborator_id: string;
  responsible_user_id: string | null;
  termination_type: TerminationType;
  initiated_by: string;
  notice_communicated_at: string | null;
  last_day_worked: string | null;
  termination_date: string | null;
  notice_type: NoticeType;
  notice_days: number | null;
  reason: string | null;
  reason_details: string | null;
  will_replace: boolean;
  replacement_job_id: string | null;
  stage: OffboardingStage;
  rescission_calc: any;
  exit_interview: any;
  exit_nps: number | null;
  access_cutoff_done: boolean;
  access_cutoff_at: string | null;
  notes: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  exit_interview_token: string | null;
  exit_interview_submitted_at: string | null;
  subject_type: string;
  service_provider_id: string | null;
  financial_entry_id: string | null;
  reassignments: any;
  created_at: string;
  updated_at: string;
  collaborator?: { id: string; full_name: string; position: string | null; department: string | null; avatar_url: string | null; email: string | null; hire_date: string | null; base_salary: number | null; salary: number | null };
  replacement_job?: { id: string; title: string; status: string } | null;
}

export interface HROffboardingChecklistItem {
  id: string;
  offboarding_id: string;
  account_id: string;
  item_key: string;
  label: string;
  category: string;
  sort_order: number;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  notes: string | null;
}

export function useHROffboardings() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["hr_offboardings", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_offboardings" as any)
        .select(`*, collaborator:hr_collaborators(id, full_name, position, department, avatar_url, email, hire_date, base_salary, salary), replacement_job:hr_jobs(id, title, status)`)
        .eq("account_id", currentUser!.account_id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as HROffboarding[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: { collaborator_id: string; termination_type: TerminationType; reason?: string; notice_communicated_at?: string; will_replace?: boolean }) => {
      if (!currentUser?.account_id) throw new Error("Sem conta");
      const { data, error } = await supabase
        .from("hr_offboardings" as any)
        .insert({
          account_id: currentUser.account_id,
          collaborator_id: input.collaborator_id,
          termination_type: input.termination_type,
          reason: input.reason,
          notice_communicated_at: input.notice_communicated_at,
          will_replace: input.will_replace ?? false,
          responsible_user_id: currentUser.id,
          created_by: currentUser.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (created: any) => {
      toast.success("Desligamento criado");
      // Se marcou para repor, criar vaga rascunho automaticamente
      if (created?.will_replace) {
        try {
          const { data: collab } = await supabase
            .from("hr_collaborators")
            .select("position, department, employment_type, hr_department_id")
            .eq("id", created.collaborator_id)
            .single();
          const { data: job } = await supabase
            .from("hr_jobs")
            .insert({
              account_id: currentUser!.account_id!,
              created_by: currentUser!.id,
              title: collab?.position ? `Reposição: ${collab.position}` : "Reposição de vaga",
              position: collab?.position || null,
              department: collab?.department || null,
              contract_type: collab?.employment_type || "clt",
              status: "draft" as any,
              openings_count: 1,
              description_context: `Vaga gerada automaticamente a partir do desligamento ${created.id}`,
            } as any)
            .select()
            .single();
          if (job?.id) {
            await supabase.from("hr_offboardings" as any).update({ replacement_job_id: job.id }).eq("id", created.id);
            toast.success("Vaga rascunho criada em /rh/vacancies");
          }
        } catch (e: any) {
          toast.warning("Desligamento criado, mas falhou criar vaga: " + e.message);
        }
      }
      qc.invalidateQueries({ queryKey: ["hr_offboardings"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<HROffboarding> }) => {
      const { data, error } = await supabase
        .from("hr_offboardings" as any)
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr_offboardings"] });
      qc.invalidateQueries({ queryKey: ["hr_offboarding_checklist"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_offboardings" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desligamento excluído");
      qc.invalidateQueries({ queryKey: ["hr_offboardings"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return {
    offboardings: query.data || [],
    loading: query.isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    refetch: query.refetch,
  };
}

export function useHROffboardingChecklist(offboardingId: string | null | undefined) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  const query = useQuery({
    queryKey: ["hr_offboarding_checklist", offboardingId],
    enabled: !!offboardingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_offboarding_checklist_items" as any)
        .select("*")
        .eq("offboarding_id", offboardingId!)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as HROffboardingChecklistItem[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("hr_offboarding_checklist_items" as any)
        .update({ done, done_at: done ? new Date().toISOString() : null, done_by: done ? currentUser?.id : null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_offboarding_checklist", offboardingId] }),
  });

  const addMutation = useMutation({
    mutationFn: async ({ label, category }: { label: string; category: string }) => {
      if (!offboardingId || !currentUser?.account_id) return;
      const { error } = await supabase.from("hr_offboarding_checklist_items" as any).insert({
        offboarding_id: offboardingId,
        account_id: currentUser.account_id,
        item_key: `custom_${Date.now()}`,
        label,
        category,
        sort_order: 999,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_offboarding_checklist", offboardingId] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_offboarding_checklist_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr_offboarding_checklist", offboardingId] }),
  });

  return {
    items: query.data || [],
    loading: query.isLoading,
    toggle: toggleMutation.mutateAsync,
    add: addMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
  };
}
