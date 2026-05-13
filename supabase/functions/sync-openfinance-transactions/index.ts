import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callMcpTool } from "../_shared/banco-mcp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Tx {
  id?: string;
  transaction_id?: string;
  date?: string;
  posted_at?: string;
  amount?: number;
  value?: number;
  type?: string; // 'credit' | 'debit'
  direction?: string;
  description?: string;
  memo?: string;
  category?: string;
  counterparty?: string;
}

function normalizeTx(t: Tx) {
  const id = String(t.id ?? t.transaction_id ?? "");
  const rawAmount = t.amount ?? t.value ?? 0;
  const direction = (t.type ?? t.direction ?? "").toLowerCase();
  // Open Finance: débito (saída) negativo, crédito (entrada) positivo
  let signed = Number(rawAmount);
  if (direction.includes("deb") || direction.includes("out")) signed = -Math.abs(signed);
  if (direction.includes("cred") || direction.includes("in")) signed = Math.abs(signed);
  const date = (t.date ?? t.posted_at ?? new Date().toISOString()).slice(0, 10);
  const description = t.description ?? t.memo ?? t.counterparty ?? "Movimentação Open Finance";
  return { id, signed, date, description };
}

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
    const fullSync: boolean = body.full === true;

    let q = supabase
      .from("bank_accounts")
      .select("id, account_id, openfinance_connection_id, openfinance_account_id, name, last_transactions_sync_at")
      .not("openfinance_account_id", "is", null);
    if (accountFilter) q = q.eq("account_id", accountFilter);
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
          status: "running",
        })
        .select("id")
        .single();
      const logId = logRow.data?.id;

      try {
        // Janela: desde último sync ou últimos 90 dias
        const since = !fullSync && acc.last_transactions_sync_at
          ? new Date(acc.last_transactions_sync_at)
          : new Date(Date.now() - 90 * 86400_000);
        const sinceStr = since.toISOString().slice(0, 10);
        const untilStr = new Date().toISOString().slice(0, 10);

        const r = await callMcpTool<any>("openfinance_list_transactions", {
          connection_id: acc.openfinance_connection_id,
          account_id: acc.openfinance_account_id,
          from: sinceStr,
          to: untilStr,
        });
        const txs: Tx[] = Array.isArray(r) ? r : (r?.transactions ?? r?.items ?? []);

        let imported = 0;
        for (const raw of txs) {
          const n = normalizeTx(raw);
          if (!n.id) continue;

          // Dedup
          const { data: exists } = await supabase
            .from("financial_entries")
            .select("id")
            .eq("bank_account_id", acc.id)
            .eq("openfinance_transaction_id", n.id)
            .maybeSingle();
          if (exists) continue;

          const isReceivable = n.signed >= 0;
          const { error: insErr } = await supabase.from("financial_entries").insert({
            account_id: acc.account_id,
            bank_account_id: acc.id,
            entry_type: isReceivable ? "receivable" : "payable",
            description: n.description.slice(0, 500),
            amount: Math.abs(n.signed),
            due_date: n.date,
            payment_date: n.date,
            status: "paid",
            source: "openfinance",
            openfinance_transaction_id: n.id,
            is_conciliated: true,
            conciliated_at: new Date().toISOString(),
          });
          if (!insErr) imported++;
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
    console.error("sync-openfinance-transactions error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
