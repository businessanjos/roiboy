// pay-link-whatsapp
// - action "notify": chamado pelo vendedor logo após pedir o vínculo de um pagamento feito por outra pessoa.
//   Avisa os gestores cadastrados (deal_transfer_whatsapp_recipients) com o link da lista completa de vendas sem dono.
// - action "decided": chamado pelo gestor após vincular ou recusar; avisa o vendedor que pediu.
// A decisão em si nunca passa por aqui: só o app vincula, porque o gestor precisa escolher a venda.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://iamroy.app";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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
    method: "POST", headers: { "Content-Type": "application/json", token: s.token }, body: JSON.stringify({ number, text }),
  });
  const res = await r.json().catch(() => ({}));
  const ok = r.ok && !(res as any)?.error;
  if (!ok) console.error(`[pay-link-whatsapp] envio falhou [${r.status}]`, JSON.stringify(res).slice(0, 300));
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const requestId = String(body?.request_id || "");
    if (!UUID_RE.test(requestId)) return json({ error: "Pedido inválido" }, 400);
    if (action !== "notify" && action !== "decided") return json({ error: "Ação inválida" }, 400);

    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);
    const { data: me } = await supabase.from("users").select("id, name, account_id").eq("auth_user_id", u.user.id).maybeSingle();
    const { data: r } = await supabase.from("pay_link_requests").select("*").eq("id", requestId).maybeSingle();
    if (!me || !r || me.account_id !== r.account_id) return json({ error: "Pedido não encontrado" }, 404);
    const { data: deal } = await supabase.from("deals").select("title").eq("id", r.deal_id).maybeSingle();
    const title = deal?.title || "Negócio";

    if (action === "notify") {
      if (me.id !== r.requester_id) return json({ error: "Não autorizado" }, 403);
      if (r.status !== "pending") return json({ ok: true, sent: 0, skipped: "decided" });
      const { data: recipients } = await supabase
        .from("deal_transfer_whatsapp_recipients").select("user_id, phone_e164").eq("account_id", r.account_id);
      const targets = (recipients || []).filter((rec: any) => rec.user_id !== me.id);
      if (!targets.length) return json({ ok: true, sent: 0, reason: "Nenhum gestor com WhatsApp cadastrado" });
      const s = await getSender(supabase, r.account_id);
      if (!s) return json({ ok: false, sent: 0, reason: "WhatsApp do Comercial desconectado" });
      const lines = [
        "💳 *Pagamento sem dono para vincular*",
        "",
        `*${me.name}* pediu para vincular um pagamento feito por outra pessoa:`,
        "",
        `📌 *Negócio:* ${title}`,
      ];
      if (r.suggested_label) lines.push(`👤 *Sugestão do vendedor:* ${r.suggested_label}`);
      if (r.note) lines.push(`📝 *Observação:* ${String(r.note).slice(0, 400)}`);
      lines.push("", `Ver todas as vendas sem dono e vincular: ${APP_URL}/sales-team/pay-links?pedido=${r.id}`);
      const text = lines.join("\n");
      let sent = 0;
      for (const rec of targets) {
        const number = String(rec.phone_e164 || "").replace(/\D/g, "");
        if (number.length >= 10 && await sendText(s, number, text)) sent++;
      }
      return json({ ok: true, sent });
    }

    // decided
    if (me.id !== r.decided_by) return json({ error: "Não autorizado" }, 403);
    if (!["approved", "rejected"].includes(r.status)) return json({ ok: true, sent: 0, skipped: "not_decided" });
    if (r.requester_id === r.decided_by) return json({ ok: true, sent: 0, skipped: "self" });
    const s = await getSender(supabase, r.account_id);
    if (!s) return json({ ok: false, sent: 0, reason: "WhatsApp do Comercial desconectado" });
    const approved = r.status === "approved";
    const text = approved
      ? `✅ *Pagamento vinculado*\n\n${me.name} vinculou o pagamento ao negócio "${title}". Abra o ganho e clique em "Verificar de novo".`
      : `❌ *Vínculo de pagamento recusado*\n\n${me.name} recusou o vínculo no negócio "${title}".${r.decision_reason ? `\nMotivo: ${String(r.decision_reason).slice(0, 300)}` : ""}`;
    const { data: phones } = await supabase.from("sales_user_whatsapp_phones").select("phone_e164").eq("user_id", r.requester_id);
    let sent = 0;
    for (const p of phones || []) {
      const number = String(p.phone_e164 || "").replace(/\D/g, "");
      if (number.length >= 10 && await sendText(s, number, text)) sent++;
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("[pay-link-whatsapp] erro:", e);
    return json({ error: "Não foi possível enviar o aviso." }, 500);
  }
});
