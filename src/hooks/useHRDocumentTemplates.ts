import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ADMISSION_DOC_TEMPLATE_SEEDS } from "@/lib/hr/admissionDocTemplates";

export interface HRDocumentTemplate {
  id: string;
  account_id: string;
  doc_key: string;
  title: string;
  description: string | null;
  category: string;
  body_html: string;
  default_selected: boolean;
  required: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useHRDocumentTemplates() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["hr-document-templates", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_document_templates" as any)
        .select("*")
        .eq("account_id", currentUser!.account_id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as HRDocumentTemplate[];
    },
  });
}

export function useUpsertDocumentTemplate() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (input: Partial<HRDocumentTemplate> & { doc_key: string; title: string }) => {
      const payload = {
        account_id: currentUser!.account_id,
        doc_key: input.doc_key,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "admissao",
        body_html: input.body_html ?? "",
        default_selected: input.default_selected ?? true,
        required: input.required ?? true,
        active: input.active ?? true,
        sort_order: input.sort_order ?? 99,
      };
      if (input.id) {
        const { error } = await supabase.from("hr_document_templates" as any).update(payload as any).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hr_document_templates" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-document-templates"] });
      toast.success("Modelo salvo");
    },
    onError: (e: any) => toast.error("Erro ao salvar modelo: " + e.message),
  });
}

export function useDeleteDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_document_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-document-templates"] });
      toast.success("Modelo removido");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });
}

/** Cria (ou restaura) os 6 modelos padrão da Eternum na biblioteca da conta. */
export function useSeedDefaultTemplates() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (overwrite: boolean = false) => {
      const rows = ADMISSION_DOC_TEMPLATE_SEEDS.map((t) => ({
        account_id: currentUser!.account_id,
        doc_key: t.doc_key,
        title: t.title,
        description: t.description,
        category: "admissao",
        body_html: t.body_html,
        default_selected: true,
        required: true,
        active: true,
        sort_order: t.sort_order,
      }));
      if (overwrite) {
        const { error } = await supabase
          .from("hr_document_templates" as any)
          .upsert(rows as any, { onConflict: "account_id,doc_key" });
        if (error) throw error;
        return rows.length;
      }
      const { data: existing } = await supabase
        .from("hr_document_templates" as any)
        .select("doc_key")
        .eq("account_id", currentUser!.account_id);
      const have = new Set(((existing || []) as any[]).map((r) => r.doc_key));
      const missing = rows.filter((r) => !have.has(r.doc_key));
      if (missing.length === 0) return 0;
      const { error } = await supabase.from("hr_document_templates" as any).insert(missing as any);
      if (error) throw error;
      return missing.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["hr-document-templates"] });
      if (n > 0) toast.success(`${n} modelo(s) padrão adicionados`);
      else toast.info("Todos os modelos padrão já estão na biblioteca");
    },
    onError: (e: any) => toast.error("Erro ao carregar modelos: " + e.message),
  });
}

/** Adiciona documentos de assinatura em uma admissão a partir dos modelos escolhidos. */
export function useApplyTemplatesToAdmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ admissionId, templateIds }: { admissionId: string; templateIds: string[] }) => {
      const { data, error } = await supabase.rpc("seed_admission_signature_docs" as any, {
        _admission_id: admissionId,
        _template_ids: templateIds,
      });
      if (error) throw error;
      return (data as unknown as number) || 0;
    },
    onSuccess: (n, vars) => {
      qc.invalidateQueries({ queryKey: ["hr-admission-docs", vars.admissionId] });
      toast.success(n > 0 ? `${n} documento(s) adicionados para assinatura` : "Nenhum documento novo");
    },
    onError: (e: any) => toast.error("Erro ao aplicar modelos: " + e.message),
  });
}
