// Régua de cobrança: envia lembretes e cobranças conforme regras da conta.
// Chamado por pg_cron a cada hora e também on-demand (com {test_installment_id, rule_id}).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DEFAULT_UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "https://g1.uazapi.com";

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v || 0),
  );
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function firstName(full: string | null | undefined) {
  return (full || "").trim().split(/\s+/)[0] || "";
}

interface Vars {
  nome: string;
  primeiro_nome: string;
  valor: string;
  vencimento: string;
  dias_para_vencer: string;
  dias_atraso: string;
  numero_parcela: string;
  empresa: string;
}

function renderTemplate(tpl: string, v: Vars): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (v as Record<string, string>)[k] ?? "");
}

interface Installment {
  id: string;
  account_id: string;
  invoice_id: string;
  amount: number;
  due_date: string;
  number: number;
  status: string;
  invoices: {
    client_id: string | null;
    clients?: { id: string; full_name: string; phone_e164: string | null; emails: string[] | null } | null;
    companies?: { legal_name: string | null; trade_name: string | null } | null;
  } | null;
}

async function sendWhatsapp(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  phoneE164: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: integs } = await supabase
    .from("integrations")
    .select("id, sector_id, config")
    .eq("account_id", accountId)
    .eq("type", "whatsapp")
    .eq("status", "connected");
  const usable = (integs || []).filter((i) => {
    const cfg = (i.config || {}) as Record<string, string>;
    return (cfg.provider || "uazapi") === "uazapi" && !!cfg.instance_token;
  });
  const pick =
    usable.find((i) => i.sector_id === "financeiro") ||
    usable.find((i) => i.sector_id === "operacoes") ||
    usable[0];
  if (!pick) return { ok: false, error: "Nenhuma instância WhatsApp UAZAPI conectada" };
  const cfg = pick.config as Record<string, string>;
  const url = cfg.host_url || DEFAULT_UAZAPI_URL;
  const phone = phoneE164.replace(/\D/g, "");
  try {
    const resp = await fetch(`${url}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: cfg.instance_token },
      body: JSON.stringify({ number: phone, text }),
    });
    const j = await resp.json().catch(() => ({}));
    const ok =
      resp.ok &&
      (j.error === false ||
        j.chatid ||
        j.messageid ||
        j.messageId ||
        j.status?.toLowerCase?.() === "pending");
    return ok ? { ok: true } : { ok: false, error: j.message || j.error || "Falha UAZAPI" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromName: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY não configurado" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName || "Financeiro"} <financeiro@iamroy.app>`,
        to: [to],
        subject,
        html,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j?.message || `HTTP ${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = (await req.json().catch(() => ({}))) as {
    test_installment_id?: string;
    rule_id?: string;
    account_id?: string;
  };

  try {
    // 1) Load active rules — either all or a single one for test.
    let rulesQ = supabase
      .from("billing_reminder_rules")
      .select("id, account_id, name, days_offset, channels, subject, message, active");
    if (body.rule_id) rulesQ = rulesQ.eq("id", body.rule_id);
    else rulesQ = rulesQ.eq("active", true);
    if (body.account_id) rulesQ = rulesQ.eq("account_id", body.account_id);
    const { data: rules, error: rErr } = await rulesQ;
    if (rErr) throw rErr;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const rule of rules || []) {
      // Target date: dueDate = today - days_offset  =>  today.plus(-days_offset) ... simpler:
      // we want installments whose due_date is (today - days_offset)? No:
      // days_offset -7 means "7d antes vencer": send today if due_date = today + 7.
      // days_offset  5 means "5d após": send today if due_date = today - 5.
      const target = new Date(today);
      target.setUTCDate(target.getUTCDate() - rule.days_offset);
      const targetIso = target.toISOString().split("T")[0];

      let instQ = supabase
        .from("installments")
        .select(
          `id, account_id, invoice_id, amount, due_date, number, status,
           invoices!inner (
             client_id,
             clients ( id, full_name, phone_e164, emails ),
             companies ( legal_name, trade_name )
           )`,
        )
        .eq("account_id", rule.account_id)
        .not("status", "in", "(paid,cancelled,renegotiated)");

      if (body.test_installment_id) {
        instQ = instQ.eq("id", body.test_installment_id);
      } else {
        instQ = instQ.eq("due_date", targetIso);
      }

      const { data: installments, error: iErr } = await instQ;
      if (iErr) {
        console.error("[rule]", rule.id, iErr);
        continue;
      }

      for (const inst of (installments || []) as unknown as Installment[]) {
        const client = inst.invoices?.clients;
        if (!client) {
          totalSkipped++;
          continue;
        }

        // Skip if client is paused
        const { data: setting } = await supabase
          .from("billing_reminder_client_settings")
          .select("paused, custom_channels")
          .eq("client_id", client.id)
          .maybeSingle();
        if (setting?.paused && !body.test_installment_id) {
          totalSkipped++;
          continue;
        }
        const channels: string[] =
          (setting?.custom_channels && setting.custom_channels.length > 0
            ? setting.custom_channels
            : rule.channels) || [];

        const dueDate = new Date(inst.due_date);
        dueDate.setUTCHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        const vars: Vars = {
          nome: client.full_name || "",
          primeiro_nome: firstName(client.full_name),
          valor: fmtBRL(inst.amount),
          vencimento: fmtDate(inst.due_date),
          dias_para_vencer: diffDays > 0 ? String(diffDays) : "0",
          dias_atraso: diffDays < 0 ? String(Math.abs(diffDays)) : "0",
          numero_parcela: String(inst.number),
          empresa: inst.invoices?.companies?.name || "",
        };
        const messageText = renderTemplate(rule.message, vars);
        const subjectText = renderTemplate(rule.subject || rule.name, vars);

        for (const channel of channels) {
          // Dedup: skip if already sent for this (rule, installment, channel)
          if (!body.test_installment_id) {
            const { data: existing } = await supabase
              .from("billing_reminder_sends")
              .select("id")
              .eq("rule_id", rule.id)
              .eq("installment_id", inst.id)
              .eq("channel", channel)
              .maybeSingle();
            if (existing) {
              totalSkipped++;
              continue;
            }
          }

          let ok = false;
          let err: string | undefined;
          let recipient = "";

          if (channel === "whatsapp") {
            if (!client.phone_e164) {
              err = "Cliente sem telefone";
            } else {
              recipient = client.phone_e164;
              const r = await sendWhatsapp(supabase, rule.account_id, client.phone_e164, messageText);
              ok = r.ok;
              err = r.error;
            }
          } else if (channel === "email") {
            const email = (client.emails || [])[0];
            if (!email) {
              err = "Cliente sem e-mail";
            } else {
              recipient = email;
              const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111">
                <p style="white-space:pre-line;font-size:15px;line-height:1.55">${messageText
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")}</p>
                <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
                <p style="color:#888;font-size:12px">Este é um lembrete automático de cobrança. Se já efetuou o pagamento, desconsidere.</p>
              </div>`;
              const r = await sendEmail(email, subjectText, html, vars.empresa || "Financeiro");
              ok = r.ok;
              err = r.error;
            }
          } else {
            err = `Canal desconhecido: ${channel}`;
          }

          await supabase.from("billing_reminder_sends").insert({
            account_id: rule.account_id,
            rule_id: rule.id,
            installment_id: inst.id,
            client_id: client.id,
            channel,
            recipient,
            status: ok ? "sent" : "failed",
            error: err ?? null,
            message_preview: messageText.slice(0, 300),
          });
          if (ok) totalSent++;
          else totalFailed++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent, skipped: totalSkipped, failed: totalFailed }),
      { headers: corsHeaders },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
