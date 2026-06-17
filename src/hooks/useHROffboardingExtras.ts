import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

// ============ Timeline ============
export interface OffboardingTimelineEvent {
  id: string;
  offboarding_id: string;
  actor_user_id: string | null;
  event_type: string;
  description: string | null;
  metadata: any;
  created_at: string;
  actor?: { id: string; name: string | null; avatar_url: string | null } | null;
}

export function useOffboardingTimeline(offboardingId: string | null | undefined) {
  return useQuery({
    queryKey: ["offboarding_timeline", offboardingId],
    enabled: !!offboardingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_offboarding_timeline" as any)
        .select("*, actor:users!actor_user_id(id, name, avatar_url)")
        .eq("offboarding_id", offboardingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OffboardingTimelineEvent[];
    },
  });
}

export async function logOffboardingEvent(
  offboardingId: string,
  accountId: string,
  eventType: string,
  description: string,
  metadata: any = {},
  actorUserId: string | null = null,
) {
  await supabase.from("hr_offboarding_timeline" as any).insert({
    offboarding_id: offboardingId,
    account_id: accountId,
    actor_user_id: actorUserId,
    event_type: eventType,
    description,
    metadata,
  } as any);
}

// ============ Documents ============
export interface OffboardingDocument {
  id: string;
  offboarding_id: string;
  category: string;
  file_url: string;
  file_path: string | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const DOCUMENT_CATEGORIES = [
  { key: "trct", label: "TRCT / Termo de Rescisão" },
  { key: "aviso_previo", label: "Aviso Prévio assinado" },
  { key: "termo_quitacao", label: "Termo de Quitação / Homologação" },
  { key: "exame_demissional", label: "ASO — Exame Demissional" },
  { key: "devolucao_equipamentos", label: "Recibo de Devolução de Equipamentos" },
  { key: "acordo", label: "Acordo / Distrato" },
  { key: "comprovante_pagamento", label: "Comprovante de Pagamento" },
  { key: "general", label: "Outros documentos" },
];

export function useOffboardingDocuments(offboardingId: string | null | undefined) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();

  const query = useQuery({
    queryKey: ["offboarding_documents", offboardingId],
    enabled: !!offboardingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_offboarding_documents" as any)
        .select("*")
        .eq("offboarding_id", offboardingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OffboardingDocument[];
    },
  });

  const upload = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: string }) => {
      if (!offboardingId || !currentUser?.account_id) throw new Error("Sem contexto");
      const path = `${currentUser.account_id}/${offboardingId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("offboarding-docs").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("offboarding-docs").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error } = await supabase.from("hr_offboarding_documents" as any).insert({
        offboarding_id: offboardingId,
        account_id: currentUser.account_id,
        category,
        file_url: signed?.signedUrl || "",
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: currentUser.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento anexado");
      qc.invalidateQueries({ queryKey: ["offboarding_documents", offboardingId] });
      qc.invalidateQueries({ queryKey: ["offboarding_timeline", offboardingId] });
    },
    onError: (e: any) => toast.error("Erro ao enviar: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (doc: OffboardingDocument) => {
      if (doc.file_path) await supabase.storage.from("offboarding-docs").remove([doc.file_path]);
      const { error } = await supabase.from("hr_offboarding_documents" as any).delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offboarding_documents", offboardingId] });
    },
  });

  return {
    documents: query.data || [],
    loading: query.isLoading,
    upload: upload.mutateAsync,
    remove: remove.mutateAsync,
  };
}

// ============ Pendências do colaborador ============
export interface CollaboratorPendencies {
  openTasks: number;
  openDeals: number;
  assignedClients: number;
  zappInstances: number;
  userId: string | null;
}

export function useCollaboratorPendencies(collaboratorId: string | null | undefined) {
  return useQuery({
    queryKey: ["collaborator_pendencies", collaboratorId],
    enabled: !!collaboratorId,
    queryFn: async (): Promise<CollaboratorPendencies> => {
      // 1) descobrir user_id do colaborador
      const { data: c } = await supabase
        .from("hr_collaborators")
        .select("user_id")
        .eq("id", collaboratorId!)
        .maybeSingle();
      const userId = (c as any)?.user_id || null;
      if (!userId) return { openTasks: 0, openDeals: 0, assignedClients: 0, zappInstances: 0, userId: null };

      const [tasks, deals, clients] = await Promise.all([
        (supabase.from("internal_tasks") as any).select("id", { count: "exact", head: true })
          .eq("assigned_to", userId).neq("status", "done").is("completed_at", null),
        (supabase.from("deals") as any).select("id", { count: "exact", head: true })
          .or(`responsible_user_id.eq.${userId},sales_user_id.eq.${userId},sdr_user_id.eq.${userId}`)
          .not("stage", "in", "(won,lost)").is("deleted_at", null),
        (supabase.from("clients") as any).select("id", { count: "exact", head: true })
          .eq("responsible_user_id", userId),
      ]);

      return {
        userId,
        openTasks: tasks.count || 0,
        openDeals: deals.count || 0,
        assignedClients: clients.count || 0,
        zappInstances: 0,
      };
    },
  });
}

export async function reassignCollaboratorResources(
  fromUserId: string,
  toUserId: string,
  scope: { tasks?: boolean; deals?: boolean; clients?: boolean },
) {
  const results: Record<string, number> = {};
  if (scope.tasks) {
    const { count } = await (supabase.from("internal_tasks") as any)
      .update({ assigned_to: toUserId }, { count: "exact" })
      .eq("assigned_to", fromUserId).neq("status", "done");
    results.tasks = count || 0;
  }
  if (scope.deals) {
    const { count: c1 } = await (supabase.from("deals") as any)
      .update({ responsible_user_id: toUserId }, { count: "exact" })
      .eq("responsible_user_id", fromUserId).not("stage", "in", "(won,lost)").is("deleted_at", null);
    const { count: c2 } = await (supabase.from("deals") as any)
      .update({ sales_user_id: toUserId }, { count: "exact" })
      .eq("sales_user_id", fromUserId).not("stage", "in", "(won,lost)").is("deleted_at", null);
    results.deals = (c1 || 0) + (c2 || 0);
  }
  if (scope.clients) {
    const { count } = await (supabase.from("clients") as any)
      .update({ responsible_user_id: toUserId }, { count: "exact" })
      .eq("responsible_user_id", fromUserId);
    results.clients = count || 0;
  }
  return results;
}

// ============ Acessos externos predefinidos ============
export const EXTERNAL_ACCESS_SYSTEMS = [
  { key: "google_workspace", label: "Google Workspace (e-mail, Drive, Calendar)" },
  { key: "roy_zapp", label: "RoyZapp / Instâncias WhatsApp" },
  { key: "omie", label: "Omie ERP" },
  { key: "pluggy", label: "Pluggy / Open Finance" },
  { key: "meta_business", label: "Meta Business Manager" },
  { key: "instagram", label: "Instagram corporativo" },
  { key: "youtube", label: "YouTube / Google Ads" },
  { key: "notion", label: "Notion / Docs internos" },
  { key: "github", label: "GitHub / Repositórios" },
  { key: "1password", label: "1Password / Cofre de senhas" },
  { key: "slack", label: "Slack / Discord" },
];

// ============ Public exit interview link ============
export function buildExitInterviewLink(token: string) {
  return `${window.location.origin}/desligamento/saida/${token}`;
}

export async function ensureExitInterviewToken(offboardingId: string, existing?: string | null) {
  if (existing) return existing;
  const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
  await supabase.from("hr_offboardings" as any).update({ exit_interview_token: token } as any).eq("id", offboardingId);
  return token;
}
