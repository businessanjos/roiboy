// spin-request-whatsapp
// - action "notify": chamado pelo usuário logado logo após solicitar um giro de roleta.
//   Envia aos gestores cadastrados (deal_transfer_whatsapp_recipients) mensagem com
//   botões Aprovar/Recusar (ids srq:approve:<id> / srq:reject:<id>).
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
  if (!ok) console.error(`[spin-request-whatsapp] ${path} falhou [${r.status}]`, JSON.stringify(res).slice(0, 300));
  return ok;
}

const monthLabel = (d?: string | null) => {
  if (!d) return null;
  const s = new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const requestId = String(body?.request_id || "");
    if (!UUID_RE.test(requestId)) return json({ error: "Pedido inválido" }, 400);

    const { data: r } = await supabase.from("spiff_spin_requests").select("*").eq("id", requestId).maybeSingle();
    if (!r) return json({ error: "Pedido não encontrado" }, 404);

    if (action === "confirm") {
      if ((req.headers.get("Authorization") || "") !== `Bearer ${service}`) return json({ error: "Não autorizado" }, 401);
      const phone = String(body?.phone || "").replace(/\D/g, "");
      const text = String(body?.text || "").slice(0, 500);
      const s = await getSender(supabase, r.account_id);
      if (!s || !phone || !text) return json({ ok: false });
      return json({ ok: await post(s, "/send/text", { number: phone, text }) });
    }
    if (action === "decided") {
      // Avisa o vendedor (WhatsApp + sininho) que o gestor aprovou ou recusou.
      const isService = (req.headers.get("Authorization") || "") === `Bearer ${service}`;
      if (!isService) {
        const uc = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
        });
        const { data: au } = await uc.auth.getUser();
        if (!au?.user) return json({ error: "Não autenticado" }, 401);
        const { data: mgr } = await supabase.from("users").select("id, account_id").eq("auth_user_id", au.user.id).maybeSingle();
        if (!mgr || mgr.account_id !== r.account_id || mgr.id !== r.reviewed_by) return json({ error: "Não autorizado" }, 403);
      }
      if (!["approved", "rejected"].includes(r.status)) return json({ ok: true, skipped: "not_decided" });
      const [{ data: spiff }, { data: reviewer }] = await Promise.all([
        supabase.from("sales_spiffs").select("name").eq("id", r.spiff_id).maybeSingle(),
        r.reviewed_by ? supabase.from("users").select("name").eq("id", r.reviewed_by).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      const approved = r.status === "approved";
      const by = reviewer?.name ? ` por ${reviewer.name}` : "";
      const comp = monthLabel(r.competence_month);
      const title = approved ? "🎰 Giro liberado!" : "Giro de roleta recusado";
      const content = approved
        ? `Seu giro em "${spiff?.name || "SPIFF"}"${comp ? ` (${comp})` : ""} foi aprovado${by}. Já pode girar a roleta!`
        : `Seu giro em "${spiff?.name || "SPIFF"}"${comp ? ` (${comp})` : ""} foi recusado${by}.${r.rejection_reason ? ` Motivo: ${r.rejection_reason}` : ""}`;
      const targets = [...new Set([r.user_id, r.requested_by].filter(Boolean))] as string[];
      await supabase.from("notifications").insert(targets.map((uid) => ({
        account_id: r.account_id, user_id: uid, type: "spiff_spin_decided", title, content,
        link: "/sales-team/spiffs", source_type: "spiff_spin_request", source_id: r.id,
      })));
      const s = await getSender(supabase, r.account_id);
      let sent = 0;
      if (s) {
        const { data: phones } = await supabase.from("sales_user_whatsapp_phones").select("phone_e164").in("user_id", targets);
        const text = `*${title}*\n\n${content}${approved ? `\n\nGirar no app: ${APP_URL}/sales-team/spiffs` : ""}`;
        for (const p of phones || []) {
          const number = String(p.phone_e164 || "").replace(/\D/g, "");
          if (number.length >= 10 && await post(s, "/send/text", { number, text })) sent++;
        }
      }
      return json({ ok: true, sent });
    }
    if (action !== "notify") return json({ error: "Ação inválida" }, 400);

    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);
    const { data: me } = await supabase.from("users").select("id, name, account_id").eq("auth_user_id", u.user.id).maybeSingle();
    if (!me || me.account_id !== r.account_id || (me.id !== r.requested_by && me.id !== r.user_id)) {
      return json({ error: "Não autorizado" }, 403);
    }
    if (r.status !== "pending") return json({ ok: true, skipped: "decided" });

    const [{ data: seller }, { data: spiff }, { data: recipients }] = await Promise.all([
      supabase.from("users").select("name").eq("id", r.user_id).maybeSingle(),
      supabase.from("sales_spiffs").select("name").eq("id", r.spiff_id).maybeSingle(),
      supabase.from("deal_transfer_whatsapp_recipients").select("user_id, phone_e164").eq("account_id", r.account_id),
    ]);
    if (!recipients?.length) return json({ ok: true, sent: 0, reason: "Nenhum gestor com WhatsApp cadastrado" });
    const s = await getSender(supabase, r.account_id);
    if (!s) return json({ ok: false, sent: 0, reason: "WhatsApp do Comercial desconectado" });

    const comp = monthLabel(r.competence_month);
    const lines = [
      "🎰 *Pedido de giro de roleta*",
      "",
      `*${seller?.name || "Vendedor"}* quer girar a roleta:`,
      "",
      `🏆 *Campanha:* ${spiff?.name || "SPIFF"}`,
    ];
    if (comp) lines.push(`📅 *Competência:* ${comp}`);
    if (me.id !== r.user_id) lines.push(`🙋 *Solicitado por:* ${me.name}`);
    lines.push("", "Deseja liberar o giro?");
    const text = lines.join("\n");
    const linkText = `\n\nAprovar ou recusar no app: ${APP_URL}/sales-team/spiffs`;

    let sent = 0;
    for (const rec of recipients) {
      const number = String(rec.phone_e164).replace(/\D/g, "");
      if (number.length < 10) continue;
      const okMenu = await post(s, "/send/menu", {
        number, type: "button", text,
        choices: [`✅ Aprovar|srq:approve:${r.id}`, `❌ Recusar|srq:reject:${r.id}`],
        footerText: "ROY APP · SPIFFs",
      });
      const okText = okMenu ? true : await post(s, "/send/text", { number, text: text + linkText });
      if (okMenu || okText) sent++;
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("[spin-request-whatsapp] erro:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
