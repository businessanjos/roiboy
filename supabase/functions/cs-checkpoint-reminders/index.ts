import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHECKPOINT_INTERVAL_DAYS = 15;
/** Dias de antecedência em que o consultor é avisado. */
const LEAD_DAYS = [3, 1, 0];
/** Cadência de cobrança depois de vencido (a cada N dias). */
const OVERDUE_EVERY_DAYS = 3;
const MAX_CLIENTS = 5000;
const ACTIVE_STATUSES = ["active", "churn_risk", "paused"];

function brazilToday(): Date {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  br.setHours(0, 0, 0, 0);
  return br;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const today = brazilToday();
    const todayIso = today.toISOString().slice(0, 10);
    const isMonday = today.getDay() === 1;

    // 1. Clientes ativos com consultor responsável (paginado: o PostgREST corta em 1000).
    const clients: any[] = [];
    for (let page = 0; page * 1000 < MAX_CLIENTS; page++) {
      const from = page * 1000;
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, account_id, responsible_user_id, status")
        .in("status", ACTIVE_STATUSES)
        .not("responsible_user_id", "is", null)
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      clients.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    if (clients.length === 0) {
      return new Response(JSON.stringify({ ok: true, clients: 0, created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Último checkpoint por cliente.
    const { data: checkins, error: cErr } = await supabase
      .from("client_checkins")
      .select("client_id, happened_at")
      .eq("kind", "checkpoint")
      .order("happened_at", { ascending: false })
      .limit(20000);
    if (cErr) throw cErr;

    const lastCheckpoint = new Map<string, string>();
    for (const row of checkins || []) {
      if (!lastCheckpoint.has(row.client_id)) lastCheckpoint.set(row.client_id, row.happened_at);
    }

    // 3. Notificações já criadas hoje (dedupe idempotente).
    const { data: sentToday } = await supabase
      .from("notifications")
      .select("source_id, user_id, type")
      .eq("type", "cs_checkpoint")
      .gte("created_at", `${todayIso}T00:00:00`)
      .limit(20000);
    const alreadySent = new Set(
      (sentToday || []).map((n: any) => `${n.user_id}:${n.source_id}`),
    );

    const notifications: any[] = [];
    const noCheckpointByUser = new Map<string, { account_id: string; count: number }>();

    for (const client of clients) {
      const userId = client.responsible_user_id as string;
      const last = lastCheckpoint.get(client.id);

      if (!last) {
        // Sem checkpoint algum: entra no resumo semanal, não gera ruído diário.
        const entry = noCheckpointByUser.get(userId) || { account_id: client.account_id, count: 0 };
        entry.count += 1;
        noCheckpointByUser.set(userId, entry);
        continue;
      }

      const due = new Date(new Date(last).getTime() + CHECKPOINT_INTERVAL_DAYS * 86_400_000);
      due.setHours(0, 0, 0, 0);
      const daysUntilDue = daysBetween(today, due);

      const isLead = daysUntilDue >= 0 && LEAD_DAYS.includes(daysUntilDue);
      const overdueDays = -daysUntilDue;
      const isOverdueBeat = daysUntilDue < 0 && overdueDays % OVERDUE_EVERY_DAYS === 0;
      if (!isLead && !isOverdueBeat) continue;

      if (alreadySent.has(`${userId}:${client.id}`)) continue;

      const title =
        daysUntilDue > 0
          ? `Checkpoint em ${daysUntilDue} dia${daysUntilDue > 1 ? "s" : ""}: ${client.full_name}`
          : daysUntilDue === 0
            ? `Checkpoint de hoje: ${client.full_name}`
            : `Checkpoint atrasado há ${overdueDays} dias: ${client.full_name}`;

      const content =
        daysUntilDue >= 0
          ? `Previsto para ${formatDate(due)}. Registre o contato quinzenal com o cliente.`
          : `Estava previsto para ${formatDate(due)}. Faça o contato e registre o checkpoint.`;

      notifications.push({
        account_id: client.account_id,
        user_id: userId,
        type: "cs_checkpoint",
        title,
        content,
        link: `/clients/${client.id}`,
        source_type: "client_checkpoint",
        source_id: client.id,
      });
    }

    // 4. Resumo semanal (segunda-feira) dos clientes sem nenhum checkpoint.
    if (isMonday) {
      for (const [userId, info] of noCheckpointByUser) {
        if (alreadySent.has(`${userId}:${userId}`)) continue;
        notifications.push({
          account_id: info.account_id,
          user_id: userId,
          type: "cs_checkpoint",
          title: `${info.count} cliente(s) sem checkpoint registrado`,
          content: "Abra o painel de Checkpoints e registre o primeiro contato quinzenal.",
          link: "/clients/checkpoints",
          source_type: "client_checkpoint_digest",
          source_id: userId,
        });
      }
    }

    let created = 0;
    for (let i = 0; i < notifications.length; i += 500) {
      const chunk = notifications.slice(i, i + 500);
      const { error } = await supabase.from("notifications").insert(chunk);
      if (error) throw error;
      created += chunk.length;
    }

    return new Response(
      JSON.stringify({ ok: true, clients: clients.length, created, date: todayIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cs-checkpoint-reminders]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
