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
    const fullSync: boolean = body.full === true;

    let q = supabase
      .from("bank_accounts")
      .select("id, account_id, openfinance_connection_id, openfinance_account_id, name, last_transactions_sync_at")
      .eq("openfinance_provider", "pluggy")
      .not("openfinance_account_id", "is", null);
    if (bankAccountFilter) q = q.eq("id", bankAccountFilter);

    const { data: accounts, error } = await q;
    if (error) throw error;

    const results: Array<{ id: string; name: string; imported: number; error?: string }> = [];

    for (const acc of accounts ?? []) {
      const logRow = await supabase
        .from("openfinance_sync_logs")
        .insert({
          account_id: acc.account_id,
          bank_account_id: acc.id,
          sync_type: "transactions",
          provider: "pluggy",
          status: "running",
        })
        .select("id")
        .single();
      const logId = logRow.data?.id;

      try {
        const since = !fullSync && acc.last_transactions_sync_at
          ? new Date(acc.last_transactions_sync_at)
          : new Date(Date.now() - 90 * 86400_000);
        const fromStr = since.toISOString().slice(0, 10);
        const toStr = new Date().toISOString().slice(0, 10);

        // Paginação Pluggy: /transactions?accountId=&from=&to=&page=&pageSize=
        let page = 1;
        let imported = 0;
        const pageSize = 200;
        while (true) {
          const r = await pluggyFetch(
            `/transactions?accountId=${acc.openfinance_account_id}&from=${fromStr}&to=${toStr}&page=${page}&pageSize=${pageSize}`
          );
          const txs = r.results ?? [];
          if (txs.length === 0) break;

          // Dedup em lote: 1 query por página em vez de 1 por transação
          const pageIds = txs.map((t: any) => String(t.id));
          const { data: existing } = await supabase
            .from("financial_entries")
            .select("openfinance_transaction_id")
            .eq("bank_account_id", acc.id)
            .in("openfinance_transaction_id", pageIds);
          const existingSet = new Set((existing ?? []).map((e: any) => e.openfinance_transaction_id));

          const rows = txs
            .filter((t: any) => !existingSet.has(String(t.id)))
            .map((t: any) => {
              const amount = Number(t.amount);
              const isReceivable = amount >= 0;
              const date = (t.date ?? new Date().toISOString()).slice(0, 10);
              const description = t.descriptionRaw || t.description || "Movimentação Pluggy";
              return {
                account_id: acc.account_id,
                bank_account_id: acc.id,
                entry_type: isReceivable ? "receivable" : "payable",
                description: String(description).slice(0, 500),
                amount: Math.abs(amount),
                due_date: date,
                payment_date: date,
                status: "paid",
                source: "openfinance",
                openfinance_transaction_id: String(t.id),
                is_conciliated: true,
                conciliated_at: new Date().toISOString(),
              };
            });

          if (rows.length > 0) {
            const { error: insErr, count } = await supabase
              .from("financial_entries")
              .insert(rows, { count: "exact" });
            if (!insErr) imported += count ?? rows.length;
          }

          if (txs.length < pageSize) break;
          page++;
          if (page > 50) break; // safety
        }

        await supabase
          .from("bank_accounts")
          .update({ last_transactions_sync_at: new Date().toISOString() })
          .eq("id", acc.id);

        if (logId)
          await supabase
            .from("openfinance_sync_logs")
            .update({
              status: "success",
              transactions_imported: imported,
              finished_at: new Date().toISOString(),
            })
            .eq("id", logId);

        results.push({ id: acc.id, name: acc.name, imported });
      } catch (e: any) {
        if (logId)
          await supabase
            .from("openfinance_sync_logs")
            .update({
              status: "error",
              error_message: e.message,
              finished_at: new Date().toISOString(),
            })
            .eq("id", logId);
        results.push({ id: acc.id, name: acc.name, imported: 0, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("pluggy-sync-transactions:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
