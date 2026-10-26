// transfer-whatsapp-notify
// Chamado pelo gatilho do banco quando um lead/negócio é transferido (notificação
// deal_transferred / lead_transferred). Envia aviso no WhatsApp para o vendedor
// (privado) e/ou para o grupo do time, conforme configurado pelo gestor.
// Cada notificação é enviada no máximo uma vez (transfer_whatsapp_sends).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://iamroy.app";
const UUID_RE = /^[0-9a-f-]{36}$/i;
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function getSender(supabase: any, accountId: string) {
  const { data: integration } = await supabase
    .from("integrations").select("id, config")
    .eq("account_id", accountId).eq("type", "whatsapp").eq("status", "connected").eq("sector_id", "vendas")
    .limit(1).maybeSingle();
  const cfg = (integration?.config || {}) as Record<string, string>;
  if (!cfg.instance_token) return null;
  const { data: ss } = await supabase.from("sector_settings").select("royzapp_host").eq("sector_id", "vendas").maybeSingle();
  const host = (cfg.host_url || ss?.royzapp_host || Deno.env.get("UAZAPI_URL") || "https://g1.uazapi.com").replace(/\/$/, "");
  return { host, token: cfg.instance_token };
}

async function sendText(s: { host: string; token: string }, number: string, text: string) {
  const r = await fetch(`${s.host}/send/text`, {
    method: "POST", headers: { "Content-Type": "application/json", token: s.token },
    body: JSON.stringify({ number, text }),
  });
  const res = await r.json().catch(() => ({}));
  const ok = r.ok && !(res as any)?.error;
  if (!ok) console.error(`[transfer-whatsapp-notify] envio falhou [${r.status}]`, JSON.stringify(res).slice(0, 300));
  return ok;
}

const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const id = String(body?.notification_id || "");
    if (!UUID_RE.test(id)) return json({ error: "Aviso inválido" }, 400);

    const { data: n } = await supabase.from("notifications")
      .select("id, account_id, user_id, type, source_id, triggered_by_user_id, created_at").eq("id", id).maybeSingle();
    if (!n || !["deal_transferred", "lead_transferred"].includes(n.type)) return json({ error: "Aviso não encontrado" }, 404);
    if (Date.now() - new Date(n.created_at).getTime() > 10 * 60 * 1000) return json({ ok: true, skipped: "old" });

    // Garante envio único
    const { error: claimErr } = await supabase.from("transfer_whatsapp_sends").insert({ notification_id: id });
    if (claimErr) return json({ ok: true, skipped: "already_sent" });

    const { data: cfg } = await supabase.from("sales_transfer_whatsapp_settings").select("*").eq("account_id", n.account_id).maybeSingle();
    if (!cfg || (!cfg.notify_private && !cfg.notify_group)) return json({ ok: true, skipped: "disabled" });

    const [{ data: seller }, { data: actor }] = await Promise.all([
      supabase.from("users").select("name").eq("id", n.user_id).maybeSingle(),
      n.triggered_by_user_id
        ? supabase.from("users").select("name").eq("id", n.triggered_by_user_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    const isDeal = n.type === "deal_transferred";
    const lines: string[] = [];
    let link = "";
    if (isDeal) {
      const { data: d } = await supabase.from("deals")
        .select("title, value, stage:deal_stages(name), pipeline:pipelines(name), lead:leads(full_name, source)")
        .eq("id", n.source_id).maybeSingle();
      lines.push(`📌 *Negócio:* ${d?.title || "Negócio"}`);
      if ((d as any)?.lead?.full_name) lines.push(`👤 *Lead:* ${(d as any).lead.full_name}`);
      if ((d as any)?.pipeline?.name) lines.push(`🧭 *Funil:* ${(d as any).pipeline.name}`);
      if ((d as any)?.stage?.name) lines.push(`📍 *Etapa:* ${(d as any).stage.name}`);
      if (d?.value && Number(d.value) > 0) lines.push(`💰 *Valor:* ${brl(Number(d.value))}`);
      if ((d as any)?.lead?.source) lines.push(`📣 *Origem:* ${(d as any).lead.source}`);
      link = `${APP_URL}/sales/pipeline?deal=${n.source_id}`;
    } else {
      const { data: l } = await supabase.from("leads").select("full_name, source").eq("id", n.source_id).maybeSingle();
      lines.push(`👤 *Lead:* ${l?.full_name || "Lead"}`);
      if (l?.source) lines.push(`📣 *Origem:* ${l.source}`);
      link = `${APP_URL}/leads?lead=${n.source_id}`;
    }
    const by = firstName(actor?.name);
    if (by) lines.push(`🔁 *Transferido por:* ${by}`);
    const what = isDeal ? "negócio" : "lead";
    const footer = ["", `Abrir no ROY: ${link}`];

    const s = await getSender(supabase, n.account_id);
    if (!s) return json({ ok: false, reason: "WhatsApp do Comercial desconectado" });

    const result: Record<string, boolean> = {};
    if (cfg.notify_private) {
      const { data: ph } = await supabase.from("sales_user_whatsapp_phones").select("phone_e164").eq("user_id", n.user_id).maybeSingle();
      const number = String(ph?.phone_e164 || "").replace(/\D/g, "");
      if (number.length >= 10) {
        const text = [`🎯 *Novo ${what} para você${firstName(seller?.name) ? ", " + firstName(seller?.name) : ""}!*`, "", ...lines, ...footer].join("\n");
        result.private = await sendText(s, number, text);
      }
    }
    if (cfg.notify_group && cfg.group_jid) {
      const text = [`🔔 *${firstName(seller?.name) || "Vendedor"}* recebeu um novo ${what}`, "", ...lines, ...footer].join("\n");
      result.group = await sendText(s, cfg.group_jid, text);
    }
    await supabase.from("transfer_whatsapp_sends").update({ result }).eq("notification_id", id);
    return json({ ok: true, result });
  } catch (e) {
    console.error("[transfer-whatsapp-notify] erro:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
