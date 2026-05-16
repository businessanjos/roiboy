import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pluggyFetch } from "../_shared/pluggy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const bankAccountFilter: string | undefined = body.bank_account_id;

    let q = supabase
      .from("bank_accounts")
      .select("id, account_id, openfinance_connection_id, openfinance_account_id, name")
      .eq("openfinance_provider", "pluggy")
      .not("openfinance_account_id", "is", null);
    if (bankAccountFilter) q = q.eq("id", bankAccountFilter);

    const { data: accounts, error } = await q;
    if (error) throw error;

    const results: Array<{ id: string; name: string; balance?: number; error?: string }> = [];

    for (const acc of accounts ?? []) {
      try {
        // Força refresh do item para puxar saldo atualizado, depois lê a conta
        await pluggyFetch(`/items/${acc.openfinance_connection_id}`).catch(() => null);
        const a = await pluggyFetch(`/accounts/${acc.openfinance_account_id}`);
        const balance = typeof a.balance === "number" ? a.balance : null;
        if (balance == null) throw new Error("Resposta sem saldo");

        await supabase
          .from("bank_accounts")
          .update({ current_balance: balance, last_balance_sync_at: new Date().toISOString() })
          .eq("id", acc.id);

        await supabase.from("openfinance_sync_logs").insert({
          account_id: acc.account_id,
          bank_account_id: acc.id,
          sync_type: "balance",
          status: "success",
          provider: "pluggy",
          finished_at: new Date().toISOString(),
        });

        results.push({ id: acc.id, name: acc.name, balance });
      } catch (e: any) {
        await supabase.from("openfinance_sync_logs").insert({
          account_id: acc.account_id,
          bank_account_id: acc.id,
          sync_type: "balance",
          status: "error",
          provider: "pluggy",
          error_message: e.message,
          finished_at: new Date().toISOString(),
        });
        results.push({ id: acc.id, name: acc.name, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("pluggy-sync-balances:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
