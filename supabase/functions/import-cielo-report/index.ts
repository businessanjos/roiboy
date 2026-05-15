// Cielo report importer
// Receives CSV/Excel rows already parsed by the frontend (array of objects),
// creates a financial_import_batch + rows, attempts to match each row to an
// open installment by amount + date + brand + NSU, and returns preview results.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface CieloRow {
  date?: string; // ISO date or BR date
  amount?: number; // gross
  fee_amount?: number;
  net_amount?: number;
  brand?: string;
  nsu?: string;
  auth_code?: string;
  payer_name?: string;
  doc?: string;
  installments?: number;
  raw?: Record<string, unknown>;
}

function parseDate(input?: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // BR dd/mm/yyyy
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rows: CieloRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const filename: string | null = body?.filename ?? null;
    const apply: boolean = body?.apply === true;

    if (!rows.length) {
      return new Response(JSON.stringify({ error: "rows_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create batch
    const { data: batch, error: bErr } = await supabase
      .from("financial_import_batches")
      .insert({
        source: "cielo",
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
    let totalFee = 0;

    const inserted: any[] = [];

    for (const r of rows) {
      const parsed_date = parseDate(r.date);
      const parsed_amount = num(r.amount);
      const parsed_fee_amount = num(r.fee_amount) ?? 0;
      const parsed_net_amount = num(r.net_amount) ?? (parsed_amount !== null ? parsed_amount - parsed_fee_amount : null);
      const parsed_nsu = r.nsu ? String(r.nsu).trim() : null;

      // Try match
      let installment_id: string | null = null;
      let status: string = "unmatched";
      let match_score = 0;

      if (parsed_nsu) {
        const { data: byNsu } = await supabase
          .from("installments")
          .select("id, status")
          .eq("card_nsu", parsed_nsu)
          .limit(1)
          .maybeSingle();
        if (byNsu) {
          installment_id = byNsu.id;
          status = byNsu.status === "paid" ? "duplicate" : "matched";
          match_score = 1;
        }
      }

      if (!installment_id && parsed_amount !== null && parsed_date) {
        // Match by amount + due_date proximity (±15 days) + payment_method = 'cartao'
        const from = new Date(parsed_date);
        from.setDate(from.getDate() - 15);
        const to = new Date(parsed_date);
        to.setDate(to.getDate() + 15);
        const { data: candidates } = await supabase
          .from("installments")
          .select("id, status, due_date")
          .eq("payment_method", "cartao")
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
      else if (status === "duplicate") duplicate++;
      else unmatched++;
      if (parsed_amount) totalAmount += parsed_amount;
      totalFee += parsed_fee_amount;

      const { data: rowData } = await supabase
        .from("financial_import_rows")
        .insert({
          batch_id: batch.id,
          raw: r.raw ?? r,
          parsed_date,
          parsed_amount,
          parsed_fee_amount,
          parsed_net_amount,
          parsed_brand: r.brand ?? null,
          parsed_nsu,
          parsed_auth_code: r.auth_code ?? null,
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

    // Update batch totals
    await supabase
      .from("financial_import_batches")
      .update({
        status: "preview",
        matched_rows: matched,
        unmatched_rows: unmatched,
        duplicate_rows: duplicate,
        total_amount: totalAmount,
        total_fee_amount: totalFee,
      })
      .eq("id", batch.id);

    let settled = 0;
    if (apply) {
      for (const row of inserted) {
        if (row.status === "matched") {
          const { error } = await supabase.rpc("settle_installment_from_import", {
            p_row_id: row.id,
            p_payment_status: "cartao_capturado",
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
      JSON.stringify({
        batch_id: batch.id,
        total: rows.length,
        matched,
        unmatched,
        duplicate,
        settled,
        rows: inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("import-cielo-report error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
