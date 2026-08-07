import { supabase } from "@/integrations/supabase/client";

/**
 * Gera automaticamente os documentos de assinatura da admissão a partir dos
 * modelos padrão ativos da biblioteca da conta (categoria "admissao").
 * Idempotente: a RPC ignora doc_keys que já existem na admissão.
 * Retorna a quantidade de documentos criados.
 */
export async function autoSeedSignatureDocs(admissionId: string): Promise<number> {
  const { data, error } = await supabase.rpc("seed_admission_signature_docs" as any, {
    _admission_id: admissionId,
    _template_ids: null,
  });
  if (error) throw error;
  return Number(data ?? 0) || 0;
}
