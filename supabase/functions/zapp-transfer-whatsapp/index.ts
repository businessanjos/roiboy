// zapp-transfer-whatsapp — pedido de transferência de conversa do RoyZapp (setor Vendas).
// - "notify": o vendedor que pediu dispara; envia aos gestores (deal_transfer_whatsapp_recipients) botões ztr:approve/reject.
// - "decided": após a decisão (gestor logado ou webhook com service role), avisa o vendedor no WhatsApp, se tiver número.
// - "confirm": webhook (service role) responde ao gestor.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://iamroy.app";
const UUID_RE = /^[0-9a-f-]{36}$/i;
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const first = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "Alguém";

async function getSender(supabase: any, accountId: string) {
  const { data: integration } = await supabase.from("integrations").select("config")
    .eq("account_id", accountId).eq("type", "whatsapp").eq("status", "connected").eq("sector_id", "vendas")
    .limit(1).maybeSingle();
  const cfg = (integration?.config || {}) as Record<string, string>;
  if (!cfg.instance_token) return null;
  const { data: ss } = await supabase.from("sector_settings").select("royzapp_host").eq("sector_id", "vendas").maybeSingle();
  const host = (cfg.host_url || ss?.royzapp_host || Deno.env.get("UAZAPI_URL") || "https://g1.uazapi.com").replace(/\/$/, "");
  return { host, token: cfg.instance_token };
}
async function post(s: { host: string; token: string }, path: string, body: unknown) {
  const r = await fetch(`${s.host}${path}`, { method: "POST", headers: { "Content-Type": "application/json", token: s.token }, body: JSON.stringify(body) });
  const res = await r.json().catch(() => ({}));
  const ok = r.ok && !(res as any)?.error;
  if (!ok) console.error(`[zapp-transfer-whatsapp] ${path} falhou [${r.status}]`);
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const requestId = String(body?.request_id || "");
    if (!UUID_RE.test(requestId)) return json({ error: "Pedido inválido" }, 400);
    const { data: r } = await supabase.from("zapp_conversation_transfer_requests").select("*").eq("id", requestId).maybeSingle();
    if (!r) return json({ error: "Pedido não encontrado" }, 404);
    const isService = (req.headers.get("Authorization") || "") === `Bearer ${service}`;

    let me: { id: string; name: string } | null = null;
    if (!isService) {
      const uc = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const { data: u } = await uc.auth.getUser();
      if (!u?.user) return json({ error: "Não autenticado" }, 401);
      const { data } = await supabase.from("users").select("id, name, account_id").eq("auth_user_id", u.user.id).maybeSingle();
      if (!data || data.account_id !== r.account_id) return json({ error: "Não autorizado" }, 403);
      me = data;
    }

    if (action === "confirm") {
      if (!isService) return json({ error: "Não autorizado" }, 401);
      const phone = String(body?.phone || "").replace(/\D/g, "");
      const text = String(body?.text || "").slice(0, 500);
      const s = await getSender(supabase, r.account_id);
      if (!s || !phone || !text) return json({ ok: false });
      return json({ ok: await post(s, "/send/text", { number: phone, text }) });
    }

    if (action === "notify") {
      if (!me || me.id !== r.requester_id) return json({ error: "Não autorizado" }, 403);
      if (r.status !== "pending") return json({ ok: true, skipped: "decided" });
      const { data: recipients } = await supabase.from("deal_transfer_whatsapp_recipients").select("phone_e164").eq("account_id", r.account_id);
      if (!recipients?.length) return json({ ok: true, sent: 0 });
      const s = await getSender(supabase, r.account_id);
      if (!s) return json({ ok: false, sent: 0, reason: "WhatsApp do Comercial desconectado" });
      const lines = [
        "🔄 *Solicitação de transferência de conversa*", "",
        `*${first(me.name)}* pediu o atendimento da conversa abaixo:`, "",
        `👤 *Contato:* ${r.contact_name || "Contato"}`,
        `📍 *Hoje com:* ${r.current_owner_name || "outro atendente"}`,
      ];
      if (r.reason) lines.push("", `💬 *Motivo:* _${r.reason}_`);
      lines.push("", "Deseja aprovar a transferência?");
      const text = lines.join("\n");
      const links = `\n\nAprovar: ${APP_URL}/transferencia-conversa/${r.id}?d=sim\nRecusar: ${APP_URL}/transferencia-conversa/${r.id}?d=nao`;
      let sent = 0;
      for (const rec of recipients) {
        const number = String(rec.phone_e164).replace(/\D/g, "");
        if (number.length < 10) continue;
        const okMenu = await post(s, "/send/menu", {
          number, type: "button", text, footerText: "ROY APP · Comercial",
          choices: [`✅ Aprovar|ztr:approve:${r.id}`, `❌ Recusar|ztr:reject:${r.id}`],
        });
        const ok = okMenu || (await post(s, "/send/text", { number, text: text + links }));
        if (ok) sent++;
      }
      return json({ ok: true, sent });
    }

    if (action === "decided") {
      if (!isService && me?.id !== r.decided_by) return json({ error: "Não autorizado" }, 403);
      if (!["approved", "rejected"].includes(r.status)) return json({ ok: true, skipped: "not_decided" });
      const [{ data: phone }, { data: mgr }] = await Promise.all([
        supabase.from("sales_user_whatsapp_phones").select("phone_e164").eq("user_id", r.requester_id).maybeSingle(),
        supabase.from("users").select("name").eq("id", r.decided_by).maybeSingle(),
      ]);
      const number = String(phone?.phone_e164 || "").replace(/\D/g, "");
      if (number.length < 10) return json({ ok: true, sent: false });
      const s = await getSender(supabase, r.account_id);
      if (!s) return json({ ok: false });
      const text = r.status === "approved"
        ? `✅ *Transferência aceita*\n\n${first(mgr?.name)} aprovou: a conversa com *${r.contact_name || "o contato"}* agora é sua no RoyZapp.`
        : `❌ *Transferência recusada*\n\n${first(mgr?.name)} recusou o pedido da conversa com *${r.contact_name || "o contato"}*.`;
      return json({ ok: await post(s, "/send/text", { number, text }) });
    }
    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[zapp-transfer-whatsapp] erro:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
