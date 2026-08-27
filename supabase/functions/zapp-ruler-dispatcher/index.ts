// zapp-ruler-dispatcher
//
// Dispara os toques da Régua de Relacionamento do RoyZapp marcados como
// `auto_send = true` cuja data/hora já venceu. Executado por pg_cron.
//
// Regras:
// - Janela de envio no fuso America/Sao_Paulo (fora da janela o toque volta pra fila).
// - "Parar se o contato responder": cancela os toques restantes se houve mensagem
//   recebida na conversa depois da criação da régua.
// - Nada de envio retroativo: toques vencidos há mais de 24h são cancelados.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BACKLOG_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function brazilHour(): number {
  return Number(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).slice(0, 2),
  );
}

function personalize(text: string, name: string | null): string {
  const full = (name || "").trim();
  const first = full.split(/\s+/)[0] || "";
  return text
    .replace(/\{nome\}/gi, full)
    .replace(/\{primeiro_nome\}/gi, first);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_zapp_ruler_touches",
      { p_limit: 40 },
    );
    if (claimError) {
      console.error("[ruler] claim error", claimError);
      return json({ error: claimError.message }, 500);
    }

    const touches = (claimed || []) as Array<Record<string, any>>;
    if (touches.length === 0) return json({ ok: true, processed: 0 });

    const enrollmentIds = [...new Set(touches.map((t) => t.enrollment_id))];
    const { data: enrollments } = await supabase
      .from("zapp_ruler_enrollments")
      .select("*")
      .in("id", enrollmentIds);
    const byId = new Map((enrollments || []).map((e: any) => [e.id, e]));

    // Integrações WhatsApp usáveis por conta
    const accountIds = [...new Set(touches.map((t) => t.account_id))];
    const { data: integrations } = await supabase
      .from("integrations")
      .select("id, account_id, sector_id, config, status")
      .in("account_id", accountIds)
      .eq("type", "whatsapp")
      .eq("status", "connected");

    const usable = (integrations || []).filter((i: any) => {
      const cfg = (i.config || {}) as Record<string, string>;
      return (cfg.provider || "uazapi") === "uazapi" && !!cfg.instance_token;
    });

    function pickIntegration(enrollment: any) {
      const pool = usable.filter((i: any) => i.account_id === enrollment.account_id);
      return (
        pool.find((i: any) => i.id === enrollment.integration_id) ||
        pool.find((i: any) => i.sector_id === enrollment.sector_id && (i.config || {}).host_url) ||
        pool.find((i: any) => i.sector_id === enrollment.sector_id) ||
        pool.find((i: any) => (i.config || {}).host_url) ||
        pool[0] ||
        null
      );
    }

    const hour = brazilHour();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const touch of touches) {
      const enrollment = byId.get(touch.enrollment_id);
      if (!enrollment || enrollment.status !== "active") {
        await supabase.from("zapp_ruler_touches")
          .update({ status: "cancelled", last_error: "régua não está ativa" })
          .eq("id", touch.id);
        skipped++;
        continue;
      }

      // Envio retroativo bloqueado
      if (Date.now() - new Date(touch.scheduled_at).getTime() > MAX_BACKLOG_MS) {
        await supabase.from("zapp_ruler_touches")
          .update({ status: "cancelled", last_error: "toque vencido há mais de 24h" })
          .eq("id", touch.id);
        skipped++;
        continue;
      }

      // Janela de envio
      const ws = enrollment.send_window_start ?? 9;
      const we = enrollment.send_window_end ?? 20;
      if (hour < ws || hour >= we) {
        await supabase.from("zapp_ruler_touches")
          .update({
            attempts: Math.max(0, (touch.attempts || 1) - 1),
            claimed_at: null,
            last_error: `aguardando janela de envio (${ws}h-${we}h)`,
          })
          .eq("id", touch.id);
        skipped++;
        continue;
      }

      // Parar se o contato respondeu
      if (enrollment.stop_on_reply && enrollment.conversation_id) {
        const { data: reply } = await supabase
          .from("zapp_messages")
          .select("id")
          .eq("zapp_conversation_id", enrollment.conversation_id)
          .eq("direction", "inbound")
          .gt("created_at", enrollment.created_at)
          .limit(1)
          .maybeSingle();
        if (reply) {
          await supabase.from("zapp_ruler_touches")
            .update({ status: "cancelled", last_error: "cancelado: contato respondeu" })
            .eq("enrollment_id", enrollment.id)
            .eq("status", "pending");
          await supabase.from("zapp_ruler_enrollments")
            .update({ status: "completed", cancel_reason: "contato respondeu" })
            .eq("id", enrollment.id);
          skipped++;
          continue;
        }
      }

      const integration = pickIntegration(enrollment);
      const cfg = (integration?.config || {}) as Record<string, string>;
      const token = cfg.instance_token;
      if (!integration || !token) {
        await supabase.from("zapp_ruler_touches")
          .update({ status: "failed", last_error: "nenhuma instância WhatsApp conectada" })
          .eq("id", touch.id);
        failed++;
        continue;
      }

      const host = cfg.host_url || Deno.env.get("UAZAPI_URL") || "https://g1.uazapi.com";
      const phone = String(enrollment.contact_phone || "").replace(/\D/g, "");
      const text = personalize(String(touch.message || "").trim(), enrollment.contact_name);

      if (!phone || !text) {
        await supabase.from("zapp_ruler_touches")
          .update({ status: "failed", last_error: !phone ? "contato sem telefone" : "mensagem vazia" })
          .eq("id", touch.id);
        failed++;
        continue;
      }

      try {
        const res = await fetch(`${host}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token },
          body: JSON.stringify({ number: phone, text }),
        });
        const result = await res.json().catch(() => ({}));
        const ok =
          result.error === false ||
          !!result.chatid ||
          !!result.messageid ||
          !!result.messageId ||
          String(result.status || "").toLowerCase() === "pending";

        if (ok) {
          await supabase.from("zapp_ruler_touches")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              external_message_id: result.messageid || result.messageId || null,
              last_error: null,
            })
            .eq("id", touch.id);
          sent++;
        } else {
          const msg = result.message || result.error || `HTTP ${res.status}`;
          await supabase.from("zapp_ruler_touches")
            .update({
              status: (touch.attempts || 1) >= 5 ? "failed" : "pending",
              claimed_at: null,
              last_error: String(msg).slice(0, 500),
            })
            .eq("id", touch.id);
          failed++;
        }
      } catch (err) {
        await supabase.from("zapp_ruler_touches")
          .update({
            status: (touch.attempts || 1) >= 5 ? "failed" : "pending",
            claimed_at: null,
            last_error: (err as Error).message.slice(0, 500),
          })
          .eq("id", touch.id);
        failed++;
      }

      // Espaçamento anti-ban entre envios
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500));
    }

    console.log(`[ruler] processed=${touches.length} sent=${sent} failed=${failed} skipped=${skipped}`);
    return json({ ok: true, processed: touches.length, sent, failed, skipped });
  } catch (err) {
    console.error("[ruler] unexpected", err);
    return json({ error: (err as Error).message }, 500);
  }
});
