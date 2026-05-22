import { pluggyFetch } from "../_shared/pluggy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Poll item até sair de UPDATING (máx ~20s)
async function waitItemReady(itemId: string) {
  const TERMINAL_OK = new Set(["UPDATED", "PARTIAL_SUCCESS", "WAITING_USER_INPUT", "WAITING_USER_ACTION"]);
  const TERMINAL_FAIL = new Set(["LOGIN_ERROR", "OUTDATED", "ERROR"]);
  const MAX_TRIES = 10;
  const DELAY_MS = 2000;

  let item: any = null;
  for (let i = 0; i < MAX_TRIES; i++) {
    item = await pluggyFetch(`/items/${itemId}`);
    const status = item?.status;
    if (TERMINAL_OK.has(status)) return item;
    if (TERMINAL_FAIL.has(status)) {
      throw new Error(`Pluggy item falhou: ${status} — ${item?.executionStatus ?? ""}`.trim());
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  return item; // devolve mesmo se ainda UPDATING — front mostra contas se já houver
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { itemId } = await req.json();
    if (!itemId) throw new Error("itemId é obrigatório");

    const item = await waitItemReady(itemId);
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
      institution: item?.connector?.name ?? "Pluggy",
      item_id: itemId,
    }));

    return new Response(
      JSON.stringify({ success: true, accounts, institution: item?.connector?.name, status: item?.status }),
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
