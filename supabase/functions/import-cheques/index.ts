// Cheques importer
// Same shape as import-cielo-report but for cheques.
// Each row: { date, amount, doc (cheque number), bank, payer_name, status }
// Matches by amount + due_date + payment_method='cheque'.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface ChequeRow {
  date?: string;
  amount?: number;
  doc?: string;
  bank?: string;
  payer_name?: string;
  status?: string;
  raw?: Record<string, unknown>;
}

function parseDate(input?: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rows: ChequeRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const apply: boolean = body?.apply === true;
    const filename: string | null = body?.filename ?? null;
    if (!rows.length) {
      return new Response(JSON.stringify({ error: "rows_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: batch, error: bErr } = await supabase
      .from("financial_import_batches")
      .insert({
        source: "cheques",
        filename,
        status: "processing",
        total_rows: rows.length,
        created_by: userData.user.id,
      })
      .select()
      .single();
    if (bErr) throw bErr;

    let matched = 0;
    let unmatched = 0;
    let duplicate = 0;
    let totalAmount = 0;
    const inserted: any[] = [];

    for (const r of rows) {
      const parsed_date = parseDate(r.date);
      const parsed_amount = num(r.amount);
      let installment_id: string | null = null;
      let status = "unmatched";
      let match_score = 0;

      if (parsed_amount !== null && parsed_date) {
        const from = new Date(parsed_date);
        from.setDate(from.getDate() - 30);
        const to = new Date(parsed_date);
        to.setDate(to.getDate() + 30);
        const { data: candidates } = await supabase
          .from("installments")
          .select("id, status, due_date")
          .eq("payment_method", "cheque")
          .neq("status", "paid")
          .gte("due_date", from.toISOString().slice(0, 10))
          .lte("due_date", to.toISOString().slice(0, 10))
          .eq("amount", parsed_amount)
          .limit(2);
        if (candidates && candidates.length === 1) {
          installment_id = candidates[0].id;
          status = "matched";
          match_score = 0.7;
        }
      }

      if (status === "matched") matched++;
      else unmatched++;
      if (parsed_amount) totalAmount += parsed_amount;

      const { data: rowData } = await supabase
        .from("financial_import_rows")
        .insert({
          batch_id: batch.id,
          raw: r.raw ?? r,
          parsed_date,
          parsed_amount,
          parsed_fee_amount: 0,
          parsed_net_amount: parsed_amount,
          parsed_doc: r.doc ?? null,
          parsed_payer_name: r.payer_name ?? null,
          installment_id,
          match_score,
          status,
        })
        .select()
        .single();
      if (rowData) inserted.push(rowData);
    }

    await supabase
      .from("financial_import_batches")
      .update({
        status: "preview",
        matched_rows: matched,
        unmatched_rows: unmatched,
        duplicate_rows: duplicate,
        total_amount: totalAmount,
      })
      .eq("id", batch.id);

    let settled = 0;
    if (apply) {
      for (const row of inserted) {
        if (row.status === "matched") {
          const { error } = await supabase.rpc("settle_installment_from_import", {
            p_row_id: row.id,
            p_payment_status: "cheque_recebido",
          });
          if (!error) settled++;
        }
      }
      await supabase
        .from("financial_import_batches")
        .update({ status: "applied", applied_at: new Date().toISOString(), settled_rows: settled })
        .eq("id", batch.id);
    }

    return new Response(
      JSON.stringify({ batch_id: batch.id, total: rows.length, matched, unmatched, settled, rows: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("import-cheques error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
