// Generic bank/PIX/boleto webhook receiver.
// Public endpoint (no auth) — secured by a shared header `x-webhook-secret`
// matched against the env var BANK_WEBHOOK_SECRET.
//
// Payload shape (flexible):
//   {
//     source: 'inter' | 'itau' | 'bradesco' | 'santander' | 'pix' | string,
//     event_type: 'paid' | 'received' | string,
//     external_id: string,           // bank txid / e2e id
//     amount: number,
//     occurred_at?: string,
//     reference?: string,            // installment.id (when known) or invoice ref
//     payment_status?: string        // optional override
//   }
//
// Behavior:
//  1. dedupe by (source, external_id)
//  2. if `reference` is a UUID and matches an installment, settle directly via RPC
//  3. else try to match by amount + due_date proximity (±10 days) and any open
//     installment with payment_method in ('boleto','pix')
//  4. record everything in bank_webhook_events with the resulting status

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const expectedSecret = Deno.env.get("BANK_WEBHOOK_SECRET");
  const provided = req.headers.get("x-webhook-secret");
  if (expectedSecret && provided !== expectedSecret) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const source = String(body.source ?? "unknown");
  const external_id = body.external_id ? String(body.external_id) : null;
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount) || null;
  const occurred_at = body.occurred_at ?? null;
  const reference = body.reference ? String(body.reference) : null;
  const payment_status_override = body.payment_status ? String(body.payment_status) : null;

  // Dedupe
  if (external_id) {
    const { data: dupe } = await supabase
      .from("bank_webhook_events")
      .select("id")
      .eq("source", source)
      .eq("external_id", external_id)
      .maybeSingle();
    if (dupe) {
      return new Response(JSON.stringify({ ok: true, duplicate: true, id: dupe.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Try resolve installment
  let installment_id: string | null = null;
  let account_id: string | null = null;

  if (reference && UUID_RE.test(reference)) {
    const { data } = await supabase
      .from("installments")
      .select("id, account_id, status, payment_method")
      .eq("id", reference)
      .maybeSingle();
    if (data) {
      installment_id = data.id;
      account_id = data.account_id;
    }
  }

  if (!installment_id && amount && occurred_at) {
    const ref = new Date(occurred_at);
    const from = new Date(ref); from.setDate(from.getDate() - 10);
    const to = new Date(ref); to.setDate(to.getDate() + 10);
    const { data: cands } = await supabase
      .from("installments")
      .select("id, account_id, status")
      .in("payment_method", ["boleto", "pix"])
      .neq("status", "paid")
      .gte("due_date", from.toISOString().slice(0, 10))
      .lte("due_date", to.toISOString().slice(0, 10))
      .eq("amount", amount)
      .limit(2);
    if (cands && cands.length === 1) {
      installment_id = cands[0].id;
      account_id = cands[0].account_id;
    }
  }

  let status: string = installment_id ? "matched" : "unmatched";
  let error_message: string | null = null;

  // Settle directly when matched
  if (installment_id) {
    const ps = payment_status_override ?? (source === "pix" ? "pix_confirmado" : "boleto_pago");
    const { error: updErr } = await supabase
      .from("installments")
      .update({
        status: "paid",
        payment_status: ps,
        paid_amount: amount,
        paid_at: occurred_at ?? new Date().toISOString(),
        payment_status_updated_at: new Date().toISOString(),
      })
      .eq("id", installment_id)
      .neq("status", "paid");
    if (updErr) {
      status = "error";
      error_message = updErr.message;
    } else {
      status = "settled";
    }
  }

  const { data: ev } = await supabase
    .from("bank_webhook_events")
    .insert({
      source,
      event_type: body.event_type ?? null,
      external_id,
      payload: body,
      amount,
      occurred_at,
      installment_id,
      account_id,
      status,
      error_message,
      processed_at: new Date().toISOString(),
    })
    .select()
    .single();

  return new Response(JSON.stringify({ ok: true, id: ev?.id, status }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
