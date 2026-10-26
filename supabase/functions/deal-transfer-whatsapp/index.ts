// deal-transfer-whatsapp
// - action "notify": chamado pelo vendedor logado logo após request_deal_transfer.
//   Envia aos gestores cadastrados (deal_transfer_whatsapp_recipients) uma mensagem
//   com botões Aprovar/Recusar e links de fallback.
// - action "confirm": chamado pelo uazapi-webhook (service role) para responder ao gestor.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://iamroy.app";
const UUID_RE = /^[0-9a-f-]{36}$/i;

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

async function post(s: { host: string; token: string }, path: string, body: unknown) {
  const r = await fetch(`${s.host}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", token: s.token }, body: JSON.stringify(body),
  });
  const res = await r.json().catch(() => ({}));
  const ok = r.ok && !(res as any)?.error;
  if (!ok) console.error(`[deal-transfer-whatsapp] ${path} falhou [${r.status}]`, JSON.stringify(res).slice(0, 300));
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const requestId = String(body?.request_id || "");

    // Exemplo visual para um gestor ver o modelo (sem pedido real; botões não decidem nada).
    if (action === "sample") {
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: "Não autenticado" }, 401);
      const { data: isMgr } = await supabase.rpc("can_manage_spiff_payments", { _auth_user_id: u.user.id } as any);
      const { data: me } = await supabase.from("users").select("account_id").eq("auth_user_id", u.user.id).maybeSingle();
      if (!isMgr || !me) return json({ error: "Apenas gestores" }, 403);
      let number = String(body?.phone || "").replace(/\D/g, "");
      if (number.length < 10 || number.length > 13) return json({ error: "Telefone inválido" }, 400);
      if (number.length <= 11) number = "55" + number;
      const s = await getSender(supabase, me.account_id);
      if (!s) return json({ error: "WhatsApp do Comercial desconectado" }, 400);
      const text = [
        "*Pedido de transferência de negócio* (EXEMPLO)",
        "Darlan Ferreira pediu: *[ORG-BP] Vanessa Fonseca*",
        "Etapa: Novo Lead · Hoje com: Jonathan Marcato",
        'Motivo: "cliente já falou comigo pelo Instagram"',
      ].join("\n");
      const okMenu = await post(s, "/send/menu", {
        number, type: "button", text,
        choices: ["Aprovar|dtr:sample:approve", "Recusar|dtr:sample:reject"], footerText: "ROY APP",
      });
      const okText = await post(s, "/send/text", {
        number,
        text: `Se os botões não aparecerem, use os links:\n\nAprovar: ${APP_URL}/transferencia/exemplo?d=sim\nRecusar: ${APP_URL}/transferencia/exemplo?d=nao`,
      });
      return json({ ok: okMenu || okText, buttons: okMenu, links: okText });
    }

    if (!UUID_RE.test(requestId)) return json({ error: "Pedido inválido" }, 400);


    const { data: r } = await supabase.from("deal_transfer_requests").select("*").eq("id", requestId).maybeSingle();
    if (!r) return json({ error: "Pedido não encontrado" }, 404);

    if (action === "confirm") {
      const auth = req.headers.get("Authorization") || "";
      if (auth !== `Bearer ${service}`) return json({ error: "Não autorizado" }, 401);
      const phone = String(body?.phone || "").replace(/\D/g, "");
      const text = String(body?.text || "").slice(0, 500);
      const s = await getSender(supabase, r.account_id);
      if (!s || !phone || !text) return json({ ok: false });
      return json({ ok: await post(s, "/send/text", { number: phone, text }) });
    }

    if (action !== "notify") return json({ error: "Ação inválida" }, 400);

    // Somente o próprio solicitante pode disparar o aviso do seu pedido.
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);
    const { data: me } = await supabase.from("users").select("id, name").eq("auth_user_id", u.user.id).maybeSingle();
    if (!me || me.id !== r.requester_id) return json({ error: "Não autorizado" }, 403);
    if (r.status !== "pending") return json({ ok: true, skipped: "decided" });

    const [{ data: deal }, { data: owner }, { data: recipients }] = await Promise.all([
      supabase.from("deals").select("title, stage:deal_stages(name)").eq("id", r.deal_id).maybeSingle(),
      r.current_owner_id
        ? supabase.from("users").select("name").eq("id", r.current_owner_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("deal_transfer_whatsapp_recipients").select("user_id, phone_e164").eq("account_id", r.account_id),
    ]);
    if (!recipients?.length) return json({ ok: true, sent: 0, reason: "Nenhum gestor com WhatsApp cadastrado" });
    const s = await getSender(supabase, r.account_id);
    if (!s) return json({ ok: false, sent: 0, reason: "WhatsApp do Comercial desconectado" });

    const lines = [
      "*Pedido de transferência de negócio*",
      `${me.name} pediu: *${deal?.title || "Negócio"}*`,
      `Etapa: ${(deal as any)?.stage?.name || "—"} · Hoje com: ${owner?.name || "Sem responsável"}`,
    ];
    if (r.reason) lines.push(`Motivo: "${r.reason}"`);
    const linkText = [
      "",
      `Aprovar: ${APP_URL}/transferencia/${r.id}?d=sim`,
      `Recusar: ${APP_URL}/transferencia/${r.id}?d=nao`,
    ].join("\n");

    let sent = 0;
    for (const rec of recipients) {
      const number = String(rec.phone_e164).replace(/\D/g, "");
      if (number.length < 10) continue;
      const okMenu = await post(s, "/send/menu", {
        number,
        type: "button",
        text: lines.join("\n"),
        choices: [`Aprovar|dtr:approve:${r.id}`, `Recusar|dtr:reject:${r.id}`],
        footerText: "ROY APP",
      });
      // Links sempre, pois botões nem sempre aparecem em todos os aparelhos.
      const okText = await post(s, "/send/text", {
        number,
        text: okMenu ? `Se os botões não aparecerem, use os links:${linkText}` : lines.join("\n") + "\n" + linkText,
      });
      if (okMenu || okText) sent++;
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("[deal-transfer-whatsapp] erro:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
