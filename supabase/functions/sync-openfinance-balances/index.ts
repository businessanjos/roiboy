import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callMcpTool } from "../_shared/banco-mcp.ts";

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
    const accountFilter: string | undefined = body.account_id;
    const bankAccountFilter: string | undefined = body.bank_account_id;

    let q = supabase
      .from("bank_accounts")
      .select("id, account_id, openfinance_connection_id, openfinance_account_id, name")
      .not("openfinance_account_id", "is", null);
    if (accountFilter) q = q.eq("account_id", accountFilter);
    if (bankAccountFilter) q = q.eq("id", bankAccountFilter);

    const { data: accounts, error } = await q;
    if (error) throw error;

    const results: Array<{ id: string; name: string; balance?: number; error?: string }> = [];
    for (const acc of accounts ?? []) {
      try {
        const r = await callMcpTool<any>("openfinance_get_balance", {
          connection_id: acc.openfinance_connection_id,
          account_id: acc.openfinance_account_id,
        });
        const balance =
          typeof r === "number"
            ? r
            : (r?.balance ?? r?.available ?? r?.current ?? r?.amount ?? null);
        if (balance == null) throw new Error("Resposta sem campo de saldo");

        await supabase
          .from("bank_accounts")
          .update({ current_balance: balance, last_balance_sync_at: new Date().toISOString() })
          .eq("id", acc.id);

        await supabase.from("openfinance_sync_logs").insert({
          account_id: acc.account_id,
          bank_account_id: acc.id,
          sync_type: "balance",
          status: "success",
          finished_at: new Date().toISOString(),
        });

        results.push({ id: acc.id, name: acc.name, balance });
      } catch (e: any) {
        await supabase.from("openfinance_sync_logs").insert({
          account_id: acc.account_id,
          bank_account_id: acc.id,
          sync_type: "balance",
          status: "error",
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
    console.error("sync-openfinance-balances error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
