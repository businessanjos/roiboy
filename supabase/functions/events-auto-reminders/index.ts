import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cria (de forma idempotente) as campanhas automáticas de lembrete de eventos.
 * O envio em si continua a cargo de `process-scheduled-reminders`; aqui só
 * agendamos as campanhas com o público certo em cada marco.
 *
 * Marcos:
 *  - rsvp_reminder       D-7   -> quem ainda não respondeu o RSVP
 *  - pre_event_24h       D-1   -> confirmados
 *  - checkin_day         D-0 (2h antes) -> confirmados
 *  - post_event_feedback +3h após o fim -> presentes (ou confirmados)
 */

type AutoType = "rsvp_reminder" | "pre_event_24h" | "checkin_day" | "post_event_feedback";

interface RuleDef {
  autoType: AutoType;
  campaignType: "rsvp" | "notice" | "checkin" | "feedback";
  label: string;
  offsetMinutes: number; // relativo ao início (ou ao fim, quando fromEnd)
  fromEnd?: boolean;
  audience: "pending" | "confirmed" | "attended";
  template: (title: string, when: string) => string;
}

const RULES: RuleDef[] = [
  {
    autoType: "rsvp_reminder",
    campaignType: "rsvp",
    label: "Confirmação de presença (D-7)",
    offsetMinutes: -7 * 24 * 60,
    audience: "pending",
    template: (title, when) =>
      `Oi {nome}! Você foi convidado(a) para *${title}* em ${when}. Confirma sua presença por aqui: {link_rsvp}`,
  },
  {
    autoType: "pre_event_24h",
    campaignType: "notice",
    label: "Lembrete véspera (D-1)",
    offsetMinutes: -24 * 60,
    audience: "confirmed",
    template: (title, when) =>
      `Oi {nome}! Amanhã tem *${title}* (${when}). Estamos te esperando!`,
  },
  {
    autoType: "checkin_day",
    campaignType: "checkin",
    label: "Check-in no dia",
    offsetMinutes: -120,
    audience: "confirmed",
    template: (title, when) =>
      `Oi {nome}! *${title}* começa em breve (${when}). Faça seu check-in aqui: {link_checkin}`,
  },
  {
    autoType: "post_event_feedback",
    campaignType: "feedback",
    label: "Feedback pós-evento",
    offsetMinutes: 180,
    fromEnd: true,
    audience: "attended",
    template: (title) =>
      `Oi {nome}! Obrigado por participar de *${title}*. Conta pra gente como foi: {link_feedback}`,
  },
];

// Janela máxima de atraso tolerada: se o marco passou há mais que isso, não agenda
// (evita disparo retroativo ao ativar a automação num evento antigo).
const MAX_LATE_MINUTES = 6 * 60;
// Só agenda marcos que acontecem dentro dos próximos 30 dias.
const LOOKAHEAD_DAYS = 30;

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = Date.now();
    const horizon = new Date(now + LOOKAHEAD_DAYS * 24 * 3600 * 1000).toISOString();
    // Eventos com automação ligada, com data definida, ainda não cancelados,
    // e que terminaram há pouco ou ainda vão acontecer.
    const floor = new Date(now - 7 * 24 * 3600 * 1000).toISOString();

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(
        "id, account_id, title, scheduled_at, ends_at, duration_minutes, status, auto_reminders_enabled, auto_reminder_types",
      )
      .eq("auto_reminders_enabled", true)
      .not("scheduled_at", "is", null)
      .neq("status", "cancelled")
      .gte("scheduled_at", floor)
      .lte("scheduled_at", horizon);

    if (eventsError) throw eventsError;

    let created = 0;
    const details: Array<Record<string, unknown>> = [];

    for (const event of events || []) {
      const startMs = new Date(event.scheduled_at as string).getTime();
      const endMs = event.ends_at
        ? new Date(event.ends_at as string).getTime()
        : startMs + (Number(event.duration_minutes) || 120) * 60000;

      const enabled: string[] = Array.isArray(event.auto_reminder_types)
        ? (event.auto_reminder_types as string[])
        : [];

      for (const rule of RULES) {
        if (!enabled.includes(rule.autoType)) continue;

        const dueMs = (rule.fromEnd ? endMs : startMs) + rule.offsetMinutes * 60000;
        const minutesLate = (now - dueMs) / 60000;
        if (minutesLate > MAX_LATE_MINUTES) continue; // marco passou faz tempo
        if (dueMs - now > LOOKAHEAD_DAYS * 24 * 3600 * 1000) continue;

        // Idempotência: índice único (event_id, auto_type) + checagem prévia.
        const { data: existing } = await supabase
          .from("reminder_campaigns")
          .select("id")
          .eq("event_id", event.id)
          .eq("auto_type", rule.autoType)
          .maybeSingle();
        if (existing) continue;

        // Público do marco
        let q = supabase
          .from("event_participants")
          .select("id, client_id, guest_name, guest_email, guest_phone, rsvp_status, clients(full_name, phone_e164, emails)")
          .eq("event_id", event.id);

        if (rule.audience === "pending") q = q.in("rsvp_status", ["pending", "waitlist"]);
        else if (rule.audience === "confirmed") q = q.eq("rsvp_status", "confirmed");
        else q = q.in("rsvp_status", ["attended", "confirmed"]);

        const { data: participants, error: partsError } = await q;
        if (partsError) {
          console.error("participants error", event.id, partsError.message);
          continue;
        }

        const recipients = (participants || [])
          .map((p: Record<string, any>, index: number) => {
            const client = p.clients as Record<string, any> | null;
            const name = p.guest_name || client?.full_name || "Participante";
            const phone = p.guest_phone || client?.phone_e164 || null;
            const email =
              p.guest_email || (Array.isArray(client?.emails) ? client?.emails[0] : null) || null;
            return { participant_id: p.id, client_id: p.client_id, name, phone, email, index };
          })
          .filter((r) => !!r.phone);

        if (recipients.length === 0) continue;

        const scheduledFor = new Date(Math.max(dueMs, now + 60000)).toISOString();
        const message = rule.template(event.title as string, fmtWhen(event.scheduled_at as string));

        const { data: campaign, error: campaignError } = await supabase
          .from("reminder_campaigns")
          .insert({
            account_id: event.account_id,
            event_id: event.id,
            campaign_type: rule.campaignType,
            auto_type: rule.autoType,
            name: `[Auto] ${rule.label} — ${event.title}`,
            message_template: message,
            send_whatsapp: true,
            send_email: false,
            status: "scheduled",
            scheduled_for: scheduledFor,
            total_recipients: recipients.length,
            delay_min_seconds: 3,
            delay_max_seconds: 10,
          })
          .select("id")
          .single();

        if (campaignError) {
          // Corrida com outra execução: índice único barra a duplicata.
          console.error("campaign insert error", event.id, rule.autoType, campaignError.message);
          continue;
        }

        const { error: recipientsError } = await supabase.from("reminder_recipients").insert(
          recipients.map((r) => ({
            account_id: event.account_id,
            campaign_id: campaign.id,
            participant_id: r.participant_id,
            client_id: r.client_id,
            recipient_name: r.name,
            recipient_phone: r.phone,
            recipient_email: r.email,
            whatsapp_status: "queued",
            email_status: "pending",
            send_order: r.index,
          })),
        );

        if (recipientsError) {
          console.error("recipients insert error", campaign.id, recipientsError.message);
          await supabase.from("reminder_campaigns").delete().eq("id", campaign.id);
          continue;
        }

        created++;
        details.push({
          event: event.title,
          auto_type: rule.autoType,
          scheduled_for: scheduledFor,
          recipients: recipients.length,
        });
      }
    }

    console.log(`Auto reminders: ${created} campanhas agendadas`);
    return new Response(JSON.stringify({ success: true, created, details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("events-auto-reminders error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
