// Edge function: notify-cs-overdue
// Detecta clientes que passaram para "inadimplente" (>30 dias) e notifica
// o CS responsável. Executa via cron diário. Idempotente por dia (dedupe
// via source_id + created_at same day).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Todas as parcelas em atraso há >30 dias
    const { data: entries, error: entriesError } = await supabase
      .from("financial_entries")
      .select("client_id, amount, due_date, account_id")
      .eq("entry_type", "receivable")
      .in("status", ["pending", "overdue", "partially_paid"])
      .lt("due_date", cutoff)
      .not("client_id", "is", null);

    if (entriesError) throw entriesError;

    const byClient = new Map<
      string,
      { account_id: string; count: number; amount: number; oldest: number }
    >();
    const now = Date.now();
    for (const e of entries || []) {
      if (!e.client_id) continue;
      const cur = byClient.get(e.client_id) || {
        account_id: e.account_id,
        count: 0,
        amount: 0,
        oldest: 0,
      };
      cur.count += 1;
      cur.amount += Number(e.amount) || 0;
      const days = Math.floor(
        (now - new Date(e.due_date as string).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days > cur.oldest) cur.oldest = days;
      byClient.set(e.client_id, cur);
    }

    if (byClient.size === 0) {
      return new Response(
        JSON.stringify({ ok: true, notified: 0, message: "no overdue" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const clientIds = Array.from(byClient.keys());
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, full_name, responsible_user_id")
      .in("id", clientIds)
      .not("responsible_user_id", "is", null);

    if (clientsError) throw clientsError;

    let created = 0;
    const todayIso = new Date().toISOString().split("T")[0];

    for (const c of clients || []) {
      if (!c.responsible_user_id) continue;
      const stats = byClient.get(c.id);
      if (!stats) continue;

      // Dedupe: já existe notificação hoje para este cliente?
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", c.responsible_user_id)
        .eq("source_type", "client_overdue")
        .eq("source_id", c.id)
        .gte("created_at", `${todayIso}T00:00:00`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const amountFmt = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(stats.amount);

      const { error: insertError } = await supabase.from("notifications").insert({
        account_id: stats.account_id,
        user_id: c.responsible_user_id,
        type: "financial",
        title: `Cliente inadimplente: ${c.full_name}`,
        content: `${stats.count} parcela(s) em atraso · Total ${amountFmt} · Maior atraso ${stats.oldest} dias.`,
        link: `/clients/${c.id}`,
        source_type: "client_overdue",
        source_id: c.id,
      });

      if (!insertError) created += 1;
      else console.error("[notify-cs-overdue] insert error:", insertError);
    }

    return new Response(
      JSON.stringify({ ok: true, notified: created, scanned: byClient.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[notify-cs-overdue] error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
