import { pluggyFetch } from "../_shared/pluggy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { itemId } = await req.json();
    if (!itemId) throw new Error("itemId é obrigatório");

    const item = await pluggyFetch(`/items/${itemId}`);
    const accountsRes = await pluggyFetch(`/accounts?itemId=${itemId}`);

    const accounts = (accountsRes.results ?? []).map((a: any) => ({
      account_id: a.id,
      account_name: a.name ?? a.marketingName ?? `Conta ${a.number ?? a.id}`,
      account_number: a.number ?? "",
      account_type: a.subtype === "SAVINGS_ACCOUNT" ? "savings"
        : a.subtype === "CREDIT_CARD" ? "credit_card"
        : "checking",
      balance: typeof a.balance === "number" ? a.balance : null,
      currency: a.currencyCode ?? "BRL",
      institution: item.connector?.name ?? "Pluggy",
      item_id: itemId,
    }));

    return new Response(
      JSON.stringify({ success: true, accounts, institution: item.connector?.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("pluggy-list-item-accounts:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
