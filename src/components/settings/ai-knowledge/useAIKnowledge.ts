import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface KnowledgeStage {
  key: string;
  label: string;
  goal: string;
  guidelines: string;
}

export const DEFAULT_STAGES: KnowledgeStage[] = [
  { key: "apresentacao", label: "Apresentação", goal: "", guidelines: "" },
  { key: "descoberta", label: "Descoberta", goal: "", guidelines: "" },
  { key: "qualificacao", label: "Qualificação", goal: "", guidelines: "" },
  { key: "proposta", label: "Proposta", goal: "", guidelines: "" },
  { key: "fechamento", label: "Fechamento", goal: "", guidelines: "" },
];

export interface KnowledgeSettings {
  id?: string;
  account_id?: string;
  business_summary: string | null;
  target_audience: string | null;
  offer_type: string | null;
  selling_to: string | null;
  average_ticket: string | null;
  tone_of_voice: string | null;
  competitors: string[];
  discovery_questions: string[];
  qualification_criteria: string[];
  opening_scripts: { organic?: string; form?: string };
  web_sources: { website?: string; instagram?: string; linkedin?: string; others?: string[] };
  stages: KnowledgeStage[];
}

export const EMPTY_SETTINGS: KnowledgeSettings = {
  business_summary: "",
  target_audience: "",
  offer_type: "",
  selling_to: "",
  average_ticket: "",
  tone_of_voice: "",
  competitors: [],
  discovery_questions: [],
  qualification_criteria: [],
  opening_scripts: { organic: "", form: "" },
  web_sources: { website: "", instagram: "", linkedin: "", others: [] },
  stages: DEFAULT_STAGES,
};

export function useKnowledgeSettings() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-knowledge-settings", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<KnowledgeSettings> => {
      const { data, error } = await supabase
        .from("ai_knowledge_settings")
        .select("*")
        .eq("account_id", accountId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...EMPTY_SETTINGS };
      return {
        ...EMPTY_SETTINGS,
        ...data,
        competitors: (data.competitors as string[]) ?? [],
        discovery_questions: (data.discovery_questions as string[]) ?? [],
        qualification_criteria: (data.qualification_criteria as string[]) ?? [],
        opening_scripts: (data.opening_scripts as KnowledgeSettings["opening_scripts"]) ?? {},
        web_sources: (data.web_sources as KnowledgeSettings["web_sources"]) ?? {},
        stages: ((data.stages as unknown as KnowledgeStage[])?.length
          ? (data.stages as unknown as KnowledgeStage[])
          : DEFAULT_STAGES),
      } as KnowledgeSettings;
    },
  });

  const save = useMutation({
    mutationFn: async (values: KnowledgeSettings) => {
      if (!accountId) throw new Error("Conta não encontrada");
      const payload = {
        account_id: accountId,
        business_summary: values.business_summary,
        target_audience: values.target_audience,
        offer_type: values.offer_type,
        selling_to: values.selling_to,
        average_ticket: values.average_ticket,
        tone_of_voice: values.tone_of_voice,
        competitors: values.competitors,
        discovery_questions: values.discovery_questions as unknown as never,
        qualification_criteria: values.qualification_criteria as unknown as never,
        opening_scripts: values.opening_scripts as unknown as never,
        web_sources: values.web_sources as unknown as never,
        stages: values.stages as unknown as never,
        updated_by: currentUser?.id ?? null,
      };
      const { error } = await supabase
        .from("ai_knowledge_settings")
        .upsert(payload, { onConflict: "account_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Base de conhecimento salva");
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { settings: query.data, isLoading: query.isLoading, save, accountId };
}

export function useKnowledgeDocuments() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-knowledge-documents", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_knowledge_documents")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    // enquanto houver arquivo em processamento, atualiza sozinho
    refetchInterval: (q) =>
      (q.state.data ?? []).some(
        (d: { status: string }) => d.status === "pending" || d.status === "processing",
      )
        ? 4000
        : false,
  });

  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

  const process = async (documentId: string) => {
    const { error } = await supabase.functions.invoke("process-knowledge-doc", {
      body: { documentId },
    });
    if (error) {
      await supabase
        .from("ai_knowledge_documents")
        .update({ status: "error", error_message: error.message })
        .eq("id", documentId);
      throw error;
    }
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!accountId) throw new Error("Conta não encontrada");
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("Arquivo maior que 50 MB. Envie um arquivo menor.");
      }
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
      const path = `${accountId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("ai-knowledge-docs")
        .upload(path, file);
      if (upErr) throw upErr;
      const { data: inserted, error } = await supabase
        .from("ai_knowledge_documents")
        .insert({
          account_id: accountId,
          title: file.name,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          source_type: "upload",
          status: "processing",
          created_by: currentUser?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-documents"] });
      await process(inserted.id);
    },
    onSuccess: () => {
      toast.success("Documento enviado — lendo o conteúdo");
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-documents"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-documents"] });
    },
  });

  const reprocess = useMutation({
    mutationFn: async (documentId: string) => {
      await process(documentId);
    },
    onSuccess: () => {
      toast.success("Arquivo reprocessado");
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-documents"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-documents"] });
    },
  });


  const remove = useMutation({
    mutationFn: async (doc: { id: string; file_path: string | null }) => {
      if (doc.file_path) {
        await supabase.storage.from("ai-knowledge-docs").remove([doc.file_path]);
      }
      const { error } = await supabase.from("ai_knowledge_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (doc: { file_path: string | null; file_name: string | null }) => {
    if (!doc.file_path) return;
    const { data, error } = await supabase.storage
      .from("ai-knowledge-docs")
      .createSignedUrl(doc.file_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return { documents: query.data ?? [], isLoading: query.isLoading, upload, remove, download };
}

export function useKnowledgeCorrections() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-knowledge-corrections", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_knowledge_corrections")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["ai-knowledge-corrections"] });

  const upsert = useMutation({
    mutationFn: async (values: {
      id?: string;
      lead_message: string;
      incorrect_response: string;
      problem_identified: string;
      expected_response: string;
      action_type: string;
      is_active: boolean;
    }) => {
      if (!accountId) throw new Error("Conta não encontrada");
      const { error } = await supabase.from("ai_knowledge_corrections").upsert({
        ...values,
        account_id: accountId,
        created_by: currentUser?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Correção salva");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("ai_knowledge_corrections")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_knowledge_corrections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Correção removida");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { corrections: query.data ?? [], isLoading: query.isLoading, upsert, toggle, remove };
}
