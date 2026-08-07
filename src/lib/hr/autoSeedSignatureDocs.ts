import { supabase } from "@/integrations/supabase/client";

/**
 * Gera automaticamente os documentos de assinatura da admissão a partir dos
 * modelos ativos da biblioteca da conta. Idempotente: a RPC ignora doc_keys
 * que já existem na admissão.
 */
export async function autoSeedSignatureDocs(admissionId: string, accountId: string): Promise<number> {
  const { data: templates, error } = await supabase
    .from("hr_document_templates" as any)
    .select("id, default_selected, active")
    .eq("account_id", accountId)
    .eq("active", true);
  if (error) throw error;

  const rows = (templates || []) as unknown as Array<{ id: string; default_selected: boolean }>;
  const ids = rows.filter((t) => t.default_selected !== false).map((t) => t.id);
  if (ids.length === 0) return 0;

  const { data, error: rpcError } = await supabase.rpc("seed_admission_signature_docs" as any, {
    _admission_id: admissionId,
    _template_ids: ids,
  });
  if (rpcError) throw rpcError;
  return (data as unknown as number) || 0;
}
