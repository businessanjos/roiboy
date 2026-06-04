import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export type MarketingProjectStatus =
  | "planning"
  | "active"
  | "launched"
  | "completed"
  | "on_hold"
  | "cancelled";

export interface MarketingProject {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  status: MarketingProjectStatus;
  cover_color: string | null;
  cover_emoji: string | null;
  start_date: string | null;
  target_date: string | null;
  budget_planned: number | null;
  budget_actual: number | null;
  owner_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined counts
  stakeholders_count?: number;
  milestones_count?: number;
  milestones_done?: number;
  events_count?: number;
  tasks_count?: number;
}

export interface ProjectStakeholder {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string | null;
  role: string;
  type: "internal" | "external";
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export type MilestonePhase =
  | "discovery"
  | "planning"
  | "pre_production"
  | "production"
  | "launch"
  | "post_launch";

export type MilestonePriority = "low" | "medium" | "high" | "critical";

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  start_date: string | null;
  completed: boolean;
  completed_at: string | null;
  display_order: number;
  phase: MilestonePhase;
  owner: string | null;
  priority: MilestonePriority;
  progress: number;
}

export const MILESTONE_PHASE_META: Record<MilestonePhase, { label: string; color: string; description: string }> = {
  discovery: { label: "Descoberta", color: "from-sky-500 to-cyan-500", description: "Pesquisa, benchmarks, definição de objetivos e métricas" },
  planning: { label: "Planejamento", color: "from-violet-500 to-purple-500", description: "Estratégia, cronograma, orçamento, briefings e aprovações" },
  pre_production: { label: "Pré-Produção", color: "from-blue-500 to-indigo-500", description: "Fornecedores, contratos, conteúdo, setup de canais e ferramentas" },
  production: { label: "Produção", color: "from-amber-500 to-orange-500", description: "Execução das entregas — criativos, filmagens, builds, materiais" },
  launch: { label: "Lançamento", color: "from-pink-500 to-rose-500", description: "Go-live, mídia paga, eventos, ativação e comunicação" },
  post_launch: { label: "Pós-Lançamento", color: "from-emerald-500 to-teal-500", description: "Resultados, retrospectiva, otimização e relatórios finais" },
};

export const MILESTONE_PHASE_ORDER: MilestonePhase[] = ["discovery", "planning", "pre_production", "production", "launch", "post_launch"];

export const MILESTONE_PRIORITY_META: Record<MilestonePriority, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  medium: { label: "Média", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  high: { label: "Alta", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  critical: { label: "Crítica", color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

export interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  url: string;
  kind: string;
  created_at: string;
}

export const PROJECT_STATUS_META: Record<
  MarketingProjectStatus,
  { label: string; color: string }
> = {
  planning: { label: "Planejamento", color: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  active: { label: "Em execução", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  launched: { label: "Lançado", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  completed: { label: "Concluído", color: "bg-green-600/15 text-green-700 dark:text-green-300 border-green-600/30" },
  on_hold: { label: "Pausado", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

// Resolve a possibly-auth_user_id value into the matching users.id (FK target)
async function resolveUserId(value: string | null): Promise<string | null> {
  if (!value) return null;
  const { data: byId } = await supabase.from("users").select("id").eq("id", value).maybeSingle();
  if (byId?.id) return byId.id;
  const { data: byAuth } = await supabase.from("users").select("id").eq("auth_user_id", value).maybeSingle();
  return byAuth?.id ?? null;
}

export function useMarketingProjects() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["marketing-projects", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<MarketingProject[]> => {
      const { data, error } = await supabase
        .from("marketing_projects" as any)
        .select(
          `*,
          stakeholders:marketing_project_stakeholders(id),
          milestones:marketing_project_milestones(id, completed),
          events:marketing_project_events(event_id),
          tasks:marketing_project_tasks(task_id)`
        )
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        stakeholders_count: p.stakeholders?.length ?? 0,
        milestones_count: p.milestones?.length ?? 0,
        milestones_done: (p.milestones || []).filter((m: any) => m.completed).length,
        events_count: p.events?.length ?? 0,
        tasks_count: p.tasks?.length ?? 0,
      }));
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<MarketingProject>) => {
      if (!accountId) throw new Error("no account");
      const ownerId = await resolveUserId(payload.owner_user_id ?? null);
      const { data, error } = await supabase
        .from("marketing_projects" as any)
        .insert({
          account_id: accountId,
          created_by: currentUser?.id,
          name: payload.name!,
          description: payload.description ?? null,
          status: payload.status ?? "planning",
          cover_color: payload.cover_color ?? "#8b5cf6",
          cover_emoji: payload.cover_emoji ?? null,
          start_date: payload.start_date ?? null,
          target_date: payload.target_date ?? null,
          budget_planned: payload.budget_planned ?? null,
          budget_actual: payload.budget_actual ?? null,
          owner_user_id: ownerId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-projects"] });
      toast.success("Projeto criado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar projeto"),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<MarketingProject> & { id: string }) => {
      const allowedFields = [
        "name", "description", "status", "cover_color", "cover_emoji",
        "start_date", "target_date", "budget_planned", "budget_actual",
        "owner_user_id",
      ];
      const finalPayload: any = {};
      for (const key of allowedFields) {
        if (key in payload) finalPayload[key] = (payload as any)[key];
      }
      if ("owner_user_id" in payload) {
        finalPayload.owner_user_id = await resolveUserId(payload.owner_user_id ?? null);
      }
      const { error } = await supabase
        .from("marketing_projects" as any)
        .update(finalPayload)
        .eq("id", id);
      if (error) throw error;
      return finalPayload;
    },
    onSuccess: (patch, vars) => {
      qc.setQueriesData<MarketingProject[]>({ queryKey: ["marketing-projects"] }, (old) =>
        old?.map((project) => project.id === vars.id ? { ...project, ...patch } : project) ?? old
      );
      qc.setQueryData<MarketingProject | null>(["marketing-project", vars.id], (old) =>
        old ? { ...old, ...patch } : old
      );
      qc.invalidateQueries({ queryKey: ["marketing-projects"] });
      qc.invalidateQueries({ queryKey: ["marketing-project", vars.id] });
      toast.success("Projeto atualizado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketing_projects" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-projects"] });
      toast.success("Projeto removido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  return { projects: list.data || [], isLoading: list.isLoading, create, update, remove };
}

export function useMarketingProject(id: string | undefined) {
  return useQuery({
    queryKey: ["marketing-project", id],
    enabled: !!id,
    queryFn: async (): Promise<MarketingProject | null> => {
      const { data, error } = await supabase
        .from("marketing_projects" as any)
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

// --- Stakeholders ---
export function useProjectStakeholders(projectId: string | undefined) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["project-stakeholders", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectStakeholder[]> => {
      const { data, error } = await supabase
        .from("marketing_project_stakeholders" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as any;
    },
  });
  const add = useMutation({
    mutationFn: async (payload: Partial<ProjectStakeholder>) => {
      const { error } = await supabase.from("marketing_project_stakeholders" as any).insert({
        project_id: projectId,
        account_id: currentUser?.account_id,
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-stakeholders", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_project_stakeholders" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-stakeholders", projectId] }),
  });
  return { items: query.data || [], isLoading: query.isLoading, add, remove };
}

// --- Milestones ---
export function useProjectMilestones(projectId: string | undefined) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["project-milestones", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectMilestone[]> => {
      const { data, error } = await supabase
        .from("marketing_project_milestones" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });
  const add = useMutation({
    mutationFn: async (payload: Partial<ProjectMilestone>) => {
      const { error } = await supabase.from("marketing_project_milestones" as any).insert({
        project_id: projectId,
        account_id: currentUser?.account_id,
        title: payload.title,
        due_date: payload.due_date,
        start_date: payload.start_date,
        description: payload.description,
        phase: payload.phase || "planning",
        owner: payload.owner,
        priority: payload.priority || "medium",
        progress: payload.progress ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-milestones", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ProjectMilestone> & { id: string }) => {
      const { error } = await supabase
        .from("marketing_project_milestones" as any)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-milestones", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("marketing_project_milestones" as any)
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-milestones", projectId] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_project_milestones" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-milestones", projectId] }),
  });
  return { items: query.data || [], isLoading: query.isLoading, add, update, toggle, remove };
}

// --- Documents ---
export function useProjectDocuments(projectId: string | undefined) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["project-documents", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectDocument[]> => {
      const { data, error } = await supabase
        .from("marketing_project_documents" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });
  const add = useMutation({
    mutationFn: async (payload: Partial<ProjectDocument>) => {
      const { error } = await supabase.from("marketing_project_documents" as any).insert({
        project_id: projectId,
        account_id: currentUser?.account_id,
        created_by: currentUser?.id,
        title: payload.title,
        url: payload.url,
        kind: payload.kind ?? "link",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-documents", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_project_documents" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-documents", projectId] }),
  });
  return { items: query.data || [], isLoading: query.isLoading, add, remove };
}

// --- Linked events ---
export function useProjectEvents(projectId: string | undefined) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["project-events", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_project_events" as any)
        .select("event_id, event:events(id, title, scheduled_at, event_type, color, status, category)")
        .eq("project_id", projectId!);
      if (error) throw error;
      return (data || []).map((r: any) => r.event).filter(Boolean);
    },
  });
  const link = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("marketing_project_events" as any).insert({
        project_id: projectId,
        event_id: eventId,
        account_id: currentUser?.account_id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-events", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });
  const unlink = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("marketing_project_events" as any)
        .delete()
        .eq("project_id", projectId)
        .eq("event_id", eventId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-events", projectId] }),
  });
  return { items: query.data || [], isLoading: query.isLoading, link, unlink };
}

// --- Linked tasks ---
export function useProjectTasks(projectId: string | undefined) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["project-tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_project_tasks" as any)
        .select("task_id, task:marketing_tasks(id, title, status, priority, due_date, assignee_id, is_completed)")
        .eq("project_id", projectId!);
      if (error) throw error;
      return (data || []).map((r: any) => r.task).filter(Boolean);
    },
  });
  const link = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("marketing_project_tasks" as any).insert({
        project_id: projectId,
        task_id: taskId,
        account_id: currentUser?.account_id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });
  const unlink = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("marketing_project_tasks" as any)
        .delete()
        .eq("project_id", projectId)
        .eq("task_id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });
  return { items: query.data || [], isLoading: query.isLoading, link, unlink };
}
