import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import type { HRJob, HRJobApplication, JobStatus, CandidateStage } from "@/types/job";

// ─── List Jobs ───
export function useHRJobs(filters?: { status?: JobStatus | "all" }) {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["hr-jobs", currentUser?.account_id, filters?.status],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      let query = supabase
        .from("hr_jobs")
        .select("*")
        .eq("account_id", currentUser!.account_id)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as HRJob[];
    },
  });
}

// ─── Get Job By ID ───
export function useHRJobById(jobId: string | undefined) {
  return useQuery({
    queryKey: ["hr-job", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from("hr_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        languages: (data.languages as unknown as any[]) || [],
        required_skills: data.required_skills || [],
        desired_skills: data.desired_skills || [],
        benefits: data.benefits || [],
        tags: data.tags || [],
      } as unknown as HRJob;
    },
  });
}

// ─── Create Job ───
export function useCreateHRJob() {
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: Record<string, any>) => {
      if (!currentUser?.account_id) throw new Error("Conta não encontrada");
      const { data, error } = await supabase
        .from("hr_jobs")
        .insert({
          ...input,
          account_id: currentUser.account_id,
          created_by: currentUser.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-jobs"] });
      toast.success("Vaga criada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar vaga: " + error.message);
    },
  });
}

// ─── Update Job ───
export function useUpdateHRJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, any>) => {
      const updateData = {
        ...input,
        ...(input.status === "closed" && !input.closed_at ? { closed_at: new Date().toISOString() } : {}),
        ...(input.status && input.status !== "closed" ? { closed_at: null } : {}),
      };
      const { data, error } = await supabase
        .from("hr_jobs")
        .update(updateData as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["hr-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["hr-job", data.id] });
      toast.success("Vaga atualizada!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar vaga: " + error.message);
    },
  });
}

// ─── Delete Job ───
export function useDeleteHRJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-jobs"] });
      toast.success("Vaga excluída!");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir vaga: " + error.message);
    },
  });
}

// ─── Job Applications ───
export function useHRJobApplications(jobId: string | undefined) {
  return useQuery({
    queryKey: ["hr-job-applications", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("hr_job_applications")
        .select("*")
        .eq("job_id", jobId)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as HRJobApplication[];
    },
  });
}

// ─── Update Candidate Stage ───
export function useUpdateCandidateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ candidateIds, stage, jobId }: { candidateIds: string[]; stage: CandidateStage; jobId: string }) => {
      const { error } = await supabase
        .from("hr_job_applications")
        .update({ stage } as any)
        .in("id", candidateIds);
      if (error) throw error;
      return { jobId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hr-job-applications", data.jobId] });
    },
    onError: (error: any) => {
      toast.error("Erro ao mover candidato: " + error.message);
    },
  });
}

// ─── Create Application (public) ───
export function useCreateHRJobApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, any>) => {
      const { data, error } = await supabase
        .from("hr_job_applications")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["hr-job-applications", data.job_id] });
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar candidatura: " + error.message);
    },
  });
}

// ─── Job Stats ───
export function useHRJobStats() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["hr-job-stats", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data: jobs } = await supabase
        .from("hr_jobs")
        .select("id, status")
        .eq("account_id", currentUser!.account_id);

      const { data: apps } = await supabase
        .from("hr_job_applications")
        .select("id, stage")
        .eq("account_id", currentUser!.account_id);

      const activeJobs = (jobs || []).filter((j: any) => j.status === "active").length;
      const totalApplications = (apps || []).length;
      const hiredCount = (apps || []).filter((a: any) => a.stage === "hired").length;

      return { activeJobs, totalApplications, hiredCount };
    },
  });
}

// ─── Recruitment Metrics ───
export function useRecruitmentMetrics() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["hr-recruitment-metrics", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: jobs } = await supabase
        .from("hr_jobs")
        .select("*")
        .eq("account_id", currentUser!.account_id);

      const { data: apps } = await supabase
        .from("hr_job_applications")
        .select("*")
        .eq("account_id", currentUser!.account_id);

      const jobsList = (jobs || []) as unknown as HRJob[];
      const appsList = (apps || []) as unknown as HRJobApplication[];

      const activeJobs = jobsList.filter(j => j.status === "active").length;
      const closedJobs = jobsList.filter(j => j.status === "closed");
      const totalApplications = appsList.length;
      const totalJobs = jobsList.length || 1;
      const avgCandidatesPerJob = Math.round(totalApplications / totalJobs);

      // Time to fill
      const closedWithTime = closedJobs.filter(j => j.closed_at);
      const avgTimeToFill = closedWithTime.length > 0
        ? Math.round(closedWithTime.reduce((acc, j) => {
            const diff = new Date(j.closed_at!).getTime() - new Date(j.created_at).getTime();
            return acc + diff / (1000 * 60 * 60 * 24);
          }, 0) / closedWithTime.length)
        : 0;

      // Pipeline
      const pipelineByStage = {
        applied: appsList.filter(a => a.stage === "applied").length,
        screening: appsList.filter(a => a.stage === "screening").length,
        interview: appsList.filter(a => a.stage === "interview").length,
        technical_test: appsList.filter(a => a.stage === "technical_test").length,
        offer: appsList.filter(a => a.stage === "offer").length,
        hired: appsList.filter(a => a.stage === "hired").length,
        rejected: appsList.filter(a => a.stage === "rejected").length,
      };

      // Offer acceptance
      const receivedOffer = pipelineByStage.offer + pipelineByStage.hired;
      const offerAcceptanceRate = receivedOffer > 0
        ? Math.round((pipelineByStage.hired / receivedOffer) * 100)
        : 0;

      // By department
      const deptMap = new Map<string, { activeJobs: number; totalApps: number; hires: number }>();
      jobsList.forEach(j => {
        const dept = j.department || "Sem departamento";
        if (!deptMap.has(dept)) deptMap.set(dept, { activeJobs: 0, totalApps: 0, hires: 0 });
        const d = deptMap.get(dept)!;
        if (j.status === "active") d.activeJobs++;
        const jobApps = appsList.filter(a => a.job_id === j.id);
        d.totalApps += jobApps.length;
        d.hires += jobApps.filter(a => a.stage === "hired").length;
      });

      return {
        activeJobs,
        totalApplications,
        avgCandidatesPerJob,
        avgTimeToFill,
        offerAcceptanceRate,
        pipelineByStage,
        hiringByDepartment: Array.from(deptMap.entries()).map(([dept, d]) => ({
          department: dept,
          ...d,
        })),
      };
    },
  });
}
