import { supabase } from "@/integrations/supabase/client";
import { DEAL_FIELD_IDS } from "@/utils/dealToClientContractMapping";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Renovação dispensa o Briefing para Operação.
 * Considera o flag manual em `deals.is_renewal` e, como fallback,
 * o produto vinculado ao campo "Item da Venda" com `products.is_renewal`.
 */
export async function isRenewalDeal(
  dealId: string,
  localFlag?: boolean | null,
): Promise<boolean> {
  if (localFlag) return true;

  const { data: freshDeal } = await supabase
    .from("deals")
    .select("is_renewal, source, tags")
    .eq("id", dealId)
    .maybeSingle();
  const d = freshDeal as { is_renewal?: boolean; source?: string | null; tags?: string[] | null } | null;
  if (d?.is_renewal) return true;
  if (d?.source === "contract_renewal") return true;
  if (Array.isArray(d?.tags) && d!.tags!.some((t) => String(t).toLowerCase().includes("renova"))) return true;


  const { data: itemVenda } = await supabase
    .from("deal_field_values")
    .select("value_text")
    .eq("deal_id", dealId)
    .eq("field_id", DEAL_FIELD_IDS.ITEM_VENDA)
    .maybeSingle();

  const productId = itemVenda?.value_text;
  if (!productId || !UUID_RE.test(productId)) return false;

  const { data: product } = await supabase
    .from("products")
    .select("is_renewal")
    .eq("id", productId)
    .maybeSingle();

  return !!product?.is_renewal;
}

/** Regra pura: renovação ou carteira dispensam o Briefing para Operação. */
export function briefingExempt(flags: { isRenewal?: boolean | null; isPortfolio?: boolean | null }): boolean {
  return !!flags.isRenewal || !!flags.isPortfolio;
}

/**
 * Negócio de carteira (cliente que já está na operação) marcado manualmente
 * em `deals.is_portfolio`. Lê o valor atual do banco para não depender de cache.
 */
export async function isPortfolioDeal(dealId: string, localFlag?: boolean | null): Promise<boolean> {
  if (localFlag) return true;
  const { data } = await supabase.from("deals").select("is_portfolio").eq("id", dealId).maybeSingle();
  return !!data?.is_portfolio;
}

/** Ponto único usado pelos fluxos de ganho para saber se o briefing é dispensado. */
export async function dealSkipsBriefing(
  dealId: string,
  local?: { is_renewal?: boolean | null; is_portfolio?: boolean | null } | null,
): Promise<boolean> {
  const isPortfolio = await isPortfolioDeal(dealId, local?.is_portfolio);
  if (isPortfolio) return true;
  return briefingExempt({ isRenewal: await isRenewalDeal(dealId, local?.is_renewal), isPortfolio });
}
