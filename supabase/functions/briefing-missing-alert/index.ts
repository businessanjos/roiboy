import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Número padrão do Comercial (gestão)
const DEFAULT_TO = "5511976461705";
const LOOKBACK_DAYS_DEFAULT = 30;

function normalizePhone(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dryRun === true;
    const to = normalizePhone(body?.to || DEFAULT_TO);
    const lookbackDays = Number(body?.lookbackDays ?? LOOKBACK_DAYS_DEFAULT);
    const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60_000).toISOString();

    // 1. Negócios ganhos recentes
    const { data: wonDeals, error: dealsErr } = await supabase
      .from("deals")
      .select("id, account_id, title, value, won_at, client_id, responsible_user_id, sdr_user_id")
      .is("deleted_at", null)
      .eq("status", "won")
      .gte("won_at", sinceIso)
      .order("won_at", { ascending: false });

    if (dealsErr) throw dealsErr;
    const deals = wonDeals || [];

    if (deals.length === 0) {
      return new Response(JSON.stringify({ success: true, pending: 0, message: "Sem negócios ganhos no período" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dealIds = deals.map((d: any) => d.id);

    // 2. Briefings existentes
    const { data: briefings } = await supabase
      .from("deal_operation_briefings")
      .select("deal_id, client_id, is_complete")
      .in("deal_id", dealIds);

    const briefingByDeal = new Map<string, any>((briefings || []).map((b: any) => [b.deal_id, b]));

    // 3. Detecta pendências: sem briefing, incompleto, ou não vinculado ao cliente
    type Pending = { deal: any; reason: string };
    const pendings: Pending[] = [];
    for (const deal of deals as any[]) {
      const b = briefingByDeal.get(deal.id);
      if (!b) {
        pendings.push({ deal, reason: "sem briefing criado" });
      } else if (!b.is_complete) {
        pendings.push({ deal, reason: "briefing incompleto" });
      } else if (deal.client_id && !b.client_id) {
        pendings.push({ deal, reason: "briefing não vinculado ao cliente do CS" });
      }
    }

    if (pendings.length === 0) {
      return new Response(JSON.stringify({ success: true, pending: 0, message: "Nenhuma pendência de briefing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Notificações in-app (dedupe por negócio)
    const { data: alreadyNotified } = await supabase
      .from("notifications")
      .select("source_id, user_id")
      .eq("type", "briefing_missing")
      .in("source_id", pendings.map((p) => p.deal.id));

    const notifiedKeys = new Set((alreadyNotified || []).map((n: any) => `${n.source_id}:${n.user_id}`));

    const newNotifications: any[] = [];
    for (const { deal, reason } of pendings) {
      const targets = [deal.responsible_user_id, deal.sdr_user_id].filter(Boolean);
      for (const userId of new Set(targets)) {
        const key = `${deal.id}:${userId}`;
        if (notifiedKeys.has(key)) continue;
        newNotifications.push({
          account_id: deal.account_id,
          user_id: userId,
          type: "briefing_missing",
          title: "Briefing pendente em negócio ganho",
          content: `${deal.title || "Negócio"} — ${reason}. Preencha o briefing para operação para o CS receber a ficha do cliente.`,
          link: `/sales/pipeline?deal=${deal.id}`,
          source_type: "deal",
          source_id: deal.id,
          sector_id: "vendas",
        });
      }
    }

    let notificationsCreated = 0;
    if (!dryRun && newNotifications.length > 0) {
      const { error: notifErr } = await supabase.from("notifications").insert(newNotifications);
      if (notifErr) console.error("[briefing-missing-alert] erro ao criar notificações:", notifErr.message);
      else notificationsCreated = newNotifications.length;
    }

    // 5. Mensagem consolidada para o Comercial
    const { data: users } = await supabase.from("users").select("id, name");
    const nameById = new Map((users || []).map((u: any) => [u.id, (u.name || "").split(" ")[0] || "—"]));

    const lines: string[] = [];
    lines.push("*ALERTA — BRIEFING PENDENTE (COMERCIAL)*");
    lines.push(`_Negócios ganhos nos últimos ${lookbackDays} dias sem briefing completo/vinculado_`);
    lines.push("");
    lines.push(`Total pendente: *${pendings.length}*`);
    lines.push("");
    for (const { deal, reason } of pendings.slice(0, 15)) {
      const resp = nameById.get(deal.responsible_user_id) || "sem responsável";
      lines.push(`• ${fmtDate(deal.won_at)} — ${deal.title || "Negócio"} (${resp}) — _${reason}_`);
    }
    if (pendings.length > 15) lines.push(`… e mais ${pendings.length - 15} negócio(s).`);
    lines.push("");
    lines.push("O CS não recebe a ficha do cliente enquanto o briefing não estiver completo.");
    lines.push("_ROY APP · alerta automático_");

    const message = lines.join("\n");

    if (dryRun) {
      return new Response(
        JSON.stringify({ success: true, dryRun: true, pending: pendings.length, wouldNotify: newNotifications.length, to, message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6. Envio via instância do Comercial
    const { data: integration } = await supabase
      .from("integrations")
      .select("id, config")
      .eq("type", "whatsapp")
      .eq("status", "connected")
      .eq("sector_id", "vendas")
      .maybeSingle();

    const cfg = (integration?.config || {}) as Record<string, string>;
    const instanceToken = cfg.instance_token;
    if (!instanceToken) {
      return new Response(
        JSON.stringify({ error: "Instância do Comercial não conectada", pending: pendings.length, notificationsCreated, message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: sectorSettings } = await supabase
      .from("sector_settings")
      .select("royzapp_host")
      .eq("sector_id", "vendas")
      .maybeSingle();
    const host = (cfg.host_url || sectorSettings?.royzapp_host || Deno.env.get("UAZAPI_URL") || "https://g1.uazapi.com").replace(/\/$/, "");

    const resp = await fetch(`${host}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify({ number: to, text: message }),
    });
    const result = await resp.json().catch(() => ({}));
    const ok = resp.ok && (result.error === false || result.chatid || result.messageid || result.messageId || String(result.status || "").toLowerCase() === "pending");

    if (!ok) {
      console.error(`[briefing-missing-alert] falha no envio [${resp.status}]:`, JSON.stringify(result));
      return new Response(
        JSON.stringify({ error: "Falha no envio", status: resp.status, details: result, pending: pendings.length, notificationsCreated }),
        { status: resp.status === 200 ? 502 : resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, pending: pendings.length, notificationsCreated, to, message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[briefing-missing-alert] erro:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
