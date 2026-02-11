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

    if (!response.ok) {
      console.error("Failed to refresh Google token:", await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error refreshing Google token:", error);
    return null;
  }
}

async function refreshZoomToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Zoom credentials not configured");
  }

  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Failed to refresh Zoom token:", data);
    throw new Error(`Zoom token refresh failed: ${data.error || "Unknown error"}`);
  }
  return data;
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

async function getZoomAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "zoom")
    .maybeSingle();

  if (!integration?.access_token) return null;

  let accessToken = integration.access_token;
  const now = Math.floor(Date.now() / 1000);

  if (integration.expires_at && integration.expires_at < now + 300 && integration.refresh_token) {
    const newTokens = await refreshZoomToken(integration.refresh_token);
    accessToken = newTokens.access_token;
    await supabase
      .from("user_integrations")
      .update({
        access_token: accessToken,
        refresh_token: newTokens.refresh_token || integration.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + newTokens.expires_in,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "zoom");
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

    const { task_id, start_time, end_time, title } = await req.json();

    if (!task_id || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ error: "task_id, start_time e end_time são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get task with calendar/zoom IDs
    const { data: task, error: taskError } = await supabase
      .from("internal_tasks")
      .select("google_calendar_event_id, zoom_meeting_id, meeting_platform, assigned_to, created_by, meeting_url")
      .eq("id", task_id)
      .single();

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ error: "Tarefa não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = task.assigned_to || task.created_by;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Nenhum usuário responsável encontrado na tarefa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { google_calendar?: string; zoom?: string } = {};

    // Update Google Calendar event
    if (task.google_calendar_event_id) {
      try {
        const accessToken = await getGoogleAccessToken(supabase, userId);
        if (accessToken) {
          const eventBody: Record<string, any> = {
            start: { dateTime: start_time, timeZone: "America/Sao_Paulo" },
            end: { dateTime: end_time, timeZone: "America/Sao_Paulo" },
          };
          if (title) eventBody.summary = title;

          const resp = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.google_calendar_event_id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(eventBody),
            }
          );

          if (resp.ok) {
            results.google_calendar = "updated";
            console.log("Google Calendar event updated successfully");
          } else {
            const errorText = await resp.text();
            console.error("Failed to update Google Calendar event:", errorText);
            results.google_calendar = "error";
          }
        } else {
          console.log("No Google access token available, skipping calendar update");
          results.google_calendar = "skipped_no_token";
        }
      } catch (err) {
        console.error("Error updating Google Calendar:", err);
        results.google_calendar = "error";
      }
    }

    // Update Zoom meeting
    if (task.zoom_meeting_id) {
      try {
        const accessToken = await getZoomAccessToken(supabase, userId);
        if (accessToken) {
          const start = new Date(start_time);
          const end = new Date(end_time);
          const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

          const zoomBody: Record<string, any> = {
            start_time: start_time,
            duration: durationMinutes,
            timezone: "America/Sao_Paulo",
          };
          if (title) zoomBody.topic = title;

          const resp = await fetch(
            `https://api.zoom.us/v2/meetings/${task.zoom_meeting_id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(zoomBody),
            }
          );

          if (resp.ok || resp.status === 204) {
            results.zoom = "updated";
            console.log("Zoom meeting updated successfully");
          } else {
            const errorText = await resp.text();
            console.error("Failed to update Zoom meeting:", errorText);
            results.zoom = "error";
          }
        } else {
          console.log("No Zoom access token available, skipping Zoom update");
          results.zoom = "skipped_no_token";
        }
      } catch (err) {
        console.error("Error updating Zoom meeting:", err);
        results.zoom = "error";
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in update-meeting:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
