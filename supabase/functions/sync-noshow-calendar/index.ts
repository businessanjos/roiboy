import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshGoogleToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) return null;
    return await response.json();
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { task_id, user_id } = await req.json();

    if (!task_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "task_id e user_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the No-Show task details
    const { data: task, error: taskError } = await supabase
      .from("internal_tasks")
      .select(`
        id, title, description, due_date, due_time, assigned_to,
        lead_id, client_id, deal_id
      `)
      .eq("id", task_id)
      .single();

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ error: "Tarefa não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context info (lead name, client name)
    let contextName = "";
    if (task.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("full_name")
        .eq("id", task.lead_id)
        .maybeSingle();
      if (lead?.full_name) contextName = lead.full_name;
    } else if (task.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("full_name")
        .eq("id", task.client_id)
        .maybeSingle();
      if (client?.full_name) contextName = client.full_name;
    }

    // Build calendar event
    const eventTitle = contextName
      ? `❌ No-Show - ${contextName}`
      : `❌ No-Show`;

    // Use task's date/time for the calendar event
    const startTime = task.due_time
      ? `${task.due_date}T${task.due_time}`
      : `${task.due_date}T09:00:00`;
    
    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 min duration

    const formatISO = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // Get Google access token for the assigned user
    const targetUserId = task.assigned_to || user_id;
    const accessToken = await getGoogleAccessToken(supabase, targetUserId);

    if (!accessToken) {
      console.log("No Google access token for user, skipping calendar sync");
      return new Response(
        JSON.stringify({ success: false, reason: "no_google_token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Google Calendar event
    const calendarBody = {
      summary: eventTitle,
      description: task.description || `Atividade de No-Show registrada${contextName ? ` para ${contextName}` : ""}`,
      start: { dateTime: formatISO(startDate), timeZone: "America/Sao_Paulo" },
      end: { dateTime: formatISO(endDate), timeZone: "America/Sao_Paulo" },
      colorId: "11", // Red color in Google Calendar
      reminders: { useDefault: false, overrides: [] },
    };

    const calResp = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarBody),
      }
    );

    if (calResp.ok) {
      const calEvent = await calResp.json();
      console.log("No-Show event created in Google Calendar:", calEvent.id);

      // Store the Google Calendar event ID on the task
      await supabase
        .from("internal_tasks")
        .update({ google_calendar_event_id: calEvent.id })
        .eq("id", task_id);

      return new Response(
        JSON.stringify({ success: true, calendar_event_id: calEvent.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorText = await calResp.text();
      console.error("Failed to create Google Calendar event:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Calendar API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Error in sync-noshow-calendar:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
