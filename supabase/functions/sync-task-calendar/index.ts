// Cria/atualiza/remove evento no Google Calendar do usuário responsável (assigned_to)
// para QUALQUER tarefa do CRM (não só no-show).
// Usa user_integrations.provider = 'google' para autenticar como o próprio responsável.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshGoogleToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function getGoogleAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (!integration?.access_token) return null;

  let accessToken = integration.access_token;
  const now = Math.floor(Date.now() / 1000);

  if (integration.expires_at && integration.expires_at < now + 300 && integration.refresh_token) {
    const newTokens = await refreshGoogleToken(integration.refresh_token);
    if (newTokens) {
      accessToken = newTokens.access_token;
      await supabase
        .from("user_integrations")
        .update({
          access_token: accessToken,
          expires_at: Math.floor(Date.now() / 1000) + newTokens.expires_in,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", "google");
    }
  }
  return accessToken;
}

const formatISO = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { task_id, action } = await req.json();
    if (!task_id) {
      return new Response(JSON.stringify({ error: "task_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: task, error: tErr } = await supabase
      .from("internal_tasks")
      .select(
        "id, title, description, due_date, due_time, assigned_to, lead_id, client_id, deal_id, google_calendar_event_id, meeting_url",
      )
      .eq("id", task_id)
      .single();
    if (tErr || !task) {
      return new Response(JSON.stringify({ error: "Tarefa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se a tarefa já tem meeting_url (Zoom/Meet) o evento é gerenciado por create-meeting/update-meeting
    if (task.meeting_url) {
      return new Response(
        JSON.stringify({ success: true, skipped: "managed_by_meeting" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!task.assigned_to) {
      return new Response(JSON.stringify({ success: false, reason: "no_assignee" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getGoogleAccessToken(supabase, task.assigned_to);
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, reason: "no_google_token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE
    if (action === "delete") {
      if (task.google_calendar_event_id) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.google_calendar_event_id}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
        );
        await supabase
          .from("internal_tasks")
          .update({ google_calendar_event_id: null })
          .eq("id", task_id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!task.due_date) {
      return new Response(JSON.stringify({ success: false, reason: "no_due_date" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context (lead/client name)
    let contextName = "";
    if (task.lead_id) {
      const { data: lead } = await supabase
        .from("leads").select("full_name").eq("id", task.lead_id).maybeSingle();
      if (lead?.full_name) contextName = lead.full_name;
    } else if (task.client_id) {
      const { data: client } = await supabase
        .from("clients").select("full_name").eq("id", task.client_id).maybeSingle();
      if (client?.full_name) contextName = client.full_name;
    }

    const summary = contextName ? `${task.title} — ${contextName}` : task.title;

    // Datas: se tem horário, evento de 1h. Senão, all-day.
    const isAllDay = !task.due_time;
    let eventBody: any;
    if (isAllDay) {
      // Google Calendar all-day usa "date" (YYYY-MM-DD) e end exclusivo
      const start = task.due_date;
      const endDate = new Date(`${task.due_date}T12:00:00`);
      endDate.setDate(endDate.getDate() + 1);
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      eventBody = {
        summary,
        description: task.description || "",
        start: { date: start },
        end: { date: endStr },
      };
    } else {
      const startDate = new Date(`${task.due_date}T${task.due_time}`);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      eventBody = {
        summary,
        description: task.description || "",
        start: { dateTime: formatISO(startDate), timeZone: "America/Sao_Paulo" },
        end: { dateTime: formatISO(endDate), timeZone: "America/Sao_Paulo" },
      };
    }

    let calEvent: any;
    if (task.google_calendar_event_id) {
      // UPDATE
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.google_calendar_event_id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        },
      );
      if (r.status === 404 || r.status === 410) {
        // Evento foi removido manualmente do Calendar -> criar novo
        const r2 = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(eventBody),
          },
        );
        if (!r2.ok) {
          const err = await r2.text();
          console.error("Calendar create after 404 failed:", err);
          return new Response(JSON.stringify({ success: false, error: err }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        calEvent = await r2.json();
      } else if (!r.ok) {
        const err = await r.text();
        console.error("Calendar update failed:", err);
        return new Response(JSON.stringify({ success: false, error: err }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        calEvent = await r.json();
      }
    } else {
      // CREATE
      const r = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        },
      );
      if (!r.ok) {
        const err = await r.text();
        console.error("Calendar create failed:", err);
        return new Response(JSON.stringify({ success: false, error: err }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      calEvent = await r.json();
    }

    await supabase
      .from("internal_tasks")
      .update({ google_calendar_event_id: calEvent.id })
      .eq("id", task_id);

    return new Response(
      JSON.stringify({ success: true, calendar_event_id: calEvent.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("sync-task-calendar error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
