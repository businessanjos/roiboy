// Roteamento de funil por faixa de faturamento, definido pelo gestor em
// Configurações > Roteamento de leads (tabela lead_revenue_routing).
// Retorna o funil configurado para a faixa, ou null para usar a regra padrão (MQL).
export const FATURAMENTO_FIELD_ID = "ed5c7c0e-0740-4945-b982-70a593ffae0c";

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export async function resolveRevenueRoutedPipeline(
  supabase: any,
  accountId: string,
  revenueLabel: string | null | undefined,
): Promise<string | null> {
  const raw = (revenueLabel || "").trim();
  if (!raw) return null;
  try {
    const { data: field } = await supabase
      .from("custom_fields").select("options").eq("id", FATURAMENTO_FIELD_ID).maybeSingle();
    const opts: any[] = Array.isArray(field?.options) ? field.options : [];
    const hit = opts.find((o) => norm(o?.label) === norm(raw) || o?.value === raw);
    if (!hit?.value) return null;
    const { data: rule } = await supabase
      .from("lead_revenue_routing").select("pipeline_id")
      .eq("account_id", accountId).eq("revenue_value", hit.value).maybeSingle();
    if (!rule?.pipeline_id) return null;
    const { data: pipe } = await supabase
      .from("pipelines").select("id").eq("id", rule.pipeline_id)
      .eq("account_id", accountId).eq("is_active", true).maybeSingle();
    return pipe?.id || null;
  } catch (e) {
    console.error("[leadRevenueRouting] falha, usando regra padrão:", e);
    return null;
  }
}
