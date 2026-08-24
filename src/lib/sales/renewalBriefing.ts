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
    .select("is_renewal")
    .eq("id", dealId)
    .maybeSingle();
  if ((freshDeal as { is_renewal?: boolean } | null)?.is_renewal) return true;

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
