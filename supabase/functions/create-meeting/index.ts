import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateMeetingRequest {
  task_id: string;
  platform: "zoom" | "google";
  participant_email?: string; // Optional for Zoom
  participant_name: string;
  start_time: string;
  end_time: string;
  title: string;
  email_send_at: string;
  email_message: string;
  email_subject: string;
  lead_id?: string;
  send_email?: boolean;
}

async function refreshZoomToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
  
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("ZOOM_RECONNECT_REQUIRED");
  }

  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error("Failed to refresh Zoom token:", responseData);
    // Se for invalid_grant, o refresh_token é inválido e precisa reconectar
    if (responseData.error === "invalid_grant") {
      throw new Error("ZOOM_RECONNECT_REQUIRED");
    }
    throw new Error(`Zoom token refresh failed: ${responseData.error || "Unknown error"}`);
  }

  return responseData;
}

async function createZoomMeeting(
  startTime: string,
  endTime: string,
  title: string,
  participantEmail: string | undefined,
  supabaseClient: any,
  userId?: string
): Promise<{ meeting_url: string; meeting_id: string; meeting_password: string; google_calendar_event_id?: string }> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let expiresAt: number | null = null;

  // Get user-level OAuth tokens from user_integrations
  if (userId) {
    const { data: userIntegration } = await supabaseClient
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", "zoom")
      .maybeSingle();

    if (userIntegration?.access_token) {
      accessToken = userIntegration.access_token;
      refreshToken = userIntegration.refresh_token;
      expiresAt = userIntegration.expires_at;
      console.log("Using user-level Zoom OAuth tokens");
    }
  }

  // Check if token needs refresh
  if (accessToken && expiresAt && refreshToken) {
    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = expiresAt < now + 300;
    console.log(`Zoom token status: expires_at=${expiresAt}, now=${now}, needs_refresh=${needsRefresh}`);
    
    if (needsRefresh) { // 5 minute buffer
      console.log("Zoom token expired or expiring soon, refreshing...");
      try {
        const newTokens = await refreshZoomToken(refreshToken);
        accessToken = newTokens.access_token;
        const newExpiresAt = Math.floor(Date.now() / 1000) + newTokens.expires_in;
        
        // Update stored token
        if (userId) {
          await supabaseClient
            .from("user_integrations")
            .update({ 
              access_token: accessToken,
              refresh_token: newTokens.refresh_token || refreshToken,
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", userId)
            .eq("provider", "zoom");
        }
        console.log("Zoom token refreshed successfully");
      } catch (refreshError: any) {
        console.error("Zoom token refresh failed:", refreshError.message);
        if (refreshError.message === "ZOOM_RECONNECT_REQUIRED") {
          throw new Error("Sua sessão do Zoom expirou. Por favor, reconecte sua conta em Configurações → Integrações.");
        }
        throw refreshError;
      }
    }
  }

  // Validar token antes de usar
  if (!accessToken) {
    console.error("Zoom access token not found for user:", userId);
    throw new Error("Zoom não conectado. Por favor, conecte sua conta Zoom em Configurações → Integrações.");
  }

  // Verificar se token parece válido (não vazio, tem formato esperado)
  if (accessToken.length < 20) {
    console.error("Zoom access token appears invalid (too short):", accessToken.length);
    throw new Error("Token Zoom inválido. Por favor, reconecte sua conta em Configurações → Integrações.");
  }

  // Calculate duration
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

  // Create meeting using user's access token
  const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: title,
      type: 2,
      start_time: startTime,
      duration: durationMinutes,
      timezone: "America/Sao_Paulo",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
        ...(participantEmail && { meeting_invitees: [{ email: participantEmail }] }),
      },
    }),
  });

  if (!meetingResponse.ok) {
    const errorText = await meetingResponse.text();
    console.error("Zoom meeting creation error:", errorText);
    throw new Error("Falha ao criar reunião no Zoom. Tente reconectar sua conta.");
  }

  const meetingData = await meetingResponse.json();
  return {
    meeting_url: meetingData.join_url,
    meeting_id: meetingData.id.toString(),
    meeting_password: meetingData.password || "",
  };
}

async function refreshGoogleToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

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

async function createGoogleMeetMeeting(
  startTime: string,
  endTime: string,
  title: string,
  participantEmail: string | undefined,
  supabaseClient: any,
  accountId: string,
  userId?: string
): Promise<{ meeting_url: string; meeting_id: string; meeting_password: string; google_calendar_event_id?: string }> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let expiresAt: number | null = null;

  // First try to get user-level OAuth tokens from user_integrations
  if (userId) {
    const { data: userIntegration } = await supabaseClient
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", "google")
      .maybeSingle();

    if (userIntegration?.access_token) {
      accessToken = userIntegration.access_token;
      refreshToken = userIntegration.refresh_token;
      expiresAt = userIntegration.expires_at;
      console.log("Using user-level Google OAuth tokens");
    }
  }

  // Fallback to account-level integration (legacy)
  if (!accessToken) {
    const { data: integration } = await supabaseClient
      .from("integrations")
      .select("config")
      .eq("account_id", accountId)
      .eq("type", "google_calendar")
      .eq("is_active", true)
      .maybeSingle();

    if (integration?.config?.access_token) {
      accessToken = integration.config.access_token;
      refreshToken = integration.config.refresh_token;
      expiresAt = integration.config.expires_at;
      console.log("Using account-level Google integration");
    }
  }

  // Check if token needs refresh
  if (accessToken && expiresAt && refreshToken) {
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt < now + 300) { // Refresh if expires in less than 5 minutes
      console.log("Token expired or expiring soon, refreshing...");
      const newTokens = await refreshGoogleToken(refreshToken);
      if (newTokens) {
        accessToken = newTokens.access_token;
        const newExpiresAt = Math.floor(Date.now() / 1000) + newTokens.expires_in;
        
        // Update the stored token
        if (userId) {
          await supabaseClient
            .from("user_integrations")
            .update({ 
              access_token: accessToken, 
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", userId)
            .eq("provider", "google");
        }
        console.log("Token refreshed successfully");
      }
    }
  }

  if (!accessToken) {
    // If no OAuth configured, generate a simple Meet link (fallback)
    console.log("No Google OAuth configured, using fallback link");
    const meetCode = crypto.randomUUID().split("-").slice(0, 3).join("-");
    return {
      meeting_url: `https://meet.google.com/${meetCode}`,
      meeting_id: meetCode,
      meeting_password: "", // Google Meet doesn't use passwords
    };
  }

  // Use Google Calendar API to create event with Meet link
  const calendarResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: startTime, timeZone: "America/Sao_Paulo" },
        end: { dateTime: endTime, timeZone: "America/Sao_Paulo" },
        // Only add attendees if email is provided
        ...(participantEmail && { attendees: [{ email: participantEmail }] }),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    }
  );

  if (!calendarResponse.ok) {
    // Fallback to simple link if API fails
    console.error("Google Calendar API error, using fallback:", await calendarResponse.text());
    const meetCode = crypto.randomUUID().split("-").slice(0, 3).join("-");
    return {
      meeting_url: `https://meet.google.com/${meetCode}`,
      meeting_id: meetCode,
      meeting_password: "", // Google Meet doesn't use passwords
    };
  }

  const eventData = await calendarResponse.json();
  console.log("Google Calendar event created successfully");
  return {
    meeting_url: eventData.hangoutLink || eventData.conferenceData?.entryPoints?.[0]?.uri || "",
    meeting_id: eventData.id,
    meeting_password: "", // Google Meet doesn't use passwords
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CreateMeetingRequest = await req.json();
    console.log("Creating meeting:", body);

    const {
      task_id,
      platform,
      participant_email,
      participant_name,
      start_time,
      end_time,
      title,
      email_send_at,
      email_message,
      email_subject,
      lead_id,
      send_email,
    } = body;

    // Get task to find account_id, assigned_to (responsável) and deal_id for history
    const { data: task, error: taskError } = await supabase
      .from("internal_tasks")
      .select("account_id, assigned_to, created_by, deal_id")
      .eq("id", task_id)
      .single();

    if (taskError || !task) {
      throw new Error("Task not found");
    }

    // Use the assigned_to (Responsável) user's credentials for meeting creation
    // Falls back to created_by if no responsible is assigned
    const internalUserId = task.assigned_to || task.created_by || undefined;
    console.log(`Creating meeting for responsible user_id: ${internalUserId} (assigned_to: ${task.assigned_to}, created_by: ${task.created_by})`);

    // Create meeting based on platform
    let meetingResult: { meeting_url: string; meeting_id: string; meeting_password: string };

    if (platform === "zoom") {
      meetingResult = await createZoomMeeting(
        start_time,
        end_time,
        title,
        participant_email,
        supabase,
        internalUserId
      );

      // After Zoom meeting created, try to register it in Google Calendar
      try {
        let googleAccessToken: string | null = null;
        let googleRefreshToken: string | null = null;
        let googleExpiresAt: number | null = null;

        if (internalUserId) {
          const { data: googleIntegration } = await supabase
            .from("user_integrations")
            .select("access_token, refresh_token, expires_at")
            .eq("user_id", internalUserId)
            .eq("provider", "google")
            .maybeSingle();

          if (googleIntegration?.access_token) {
            googleAccessToken = googleIntegration.access_token;
            googleRefreshToken = googleIntegration.refresh_token;
            googleExpiresAt = googleIntegration.expires_at;
          }
        }

        // Refresh token if needed
        if (googleAccessToken && googleExpiresAt && googleRefreshToken) {
          const now = Math.floor(Date.now() / 1000);
          if (googleExpiresAt < now + 300) {
            const newTokens = await refreshGoogleToken(googleRefreshToken);
            if (newTokens) {
              googleAccessToken = newTokens.access_token;
              const newExpiresAt = Math.floor(Date.now() / 1000) + newTokens.expires_in;
              if (internalUserId) {
                await supabase
                  .from("user_integrations")
                  .update({ access_token: googleAccessToken, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
                  .eq("user_id", internalUserId)
                  .eq("provider", "google");
              }
            }
          }
        }

        if (googleAccessToken) {
          const calResp = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${googleAccessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                summary: title,
                location: meetingResult.meeting_url,
                description: `Reunião via Zoom\nLink: ${meetingResult.meeting_url}${meetingResult.meeting_password ? `\nSenha: ${meetingResult.meeting_password}` : ""}`,
                start: { dateTime: start_time, timeZone: "America/Sao_Paulo" },
                end: { dateTime: end_time, timeZone: "America/Sao_Paulo" },
                ...(participant_email && { attendees: [{ email: participant_email }] }),
              }),
            }
          );

          if (calResp.ok) {
            const calEventData = await calResp.json();
            console.log("Zoom meeting registered in Google Calendar successfully, event ID:", calEventData.id);
            // Store the Google Calendar event ID for later sync
            (meetingResult as any).google_calendar_event_id = calEventData.id;
          } else {
            console.error("Failed to create Google Calendar event for Zoom meeting:", await calResp.text());
          }
        } else {
          console.log("User has no Google integration connected, skipping Google Calendar sync");
        }
      } catch (gcalError) {
        console.error("Error syncing Zoom meeting to Google Calendar (non-blocking):", gcalError);
      }
    } else {
      meetingResult = await createGoogleMeetMeeting(
        start_time,
        end_time,
        title,
        participant_email,
        supabase,
        task.account_id,
        internalUserId
      );
    }

    console.log("Meeting created:", meetingResult);

    // Update task with meeting URL and external IDs
    const taskUpdateData: Record<string, any> = {
      meeting_url: meetingResult.meeting_url,
      meeting_platform: platform,
    };

    // Store Google Calendar event ID if available
    if (platform === "google") {
      // For Google Meet, the meeting_id IS the calendar event ID
      taskUpdateData.google_calendar_event_id = meetingResult.meeting_id;
    } else if (platform === "zoom") {
      taskUpdateData.zoom_meeting_id = meetingResult.meeting_id;
      // Also store Google Calendar event ID if Zoom meeting was synced to Calendar
      if ((meetingResult as any).google_calendar_event_id) {
        taskUpdateData.google_calendar_event_id = (meetingResult as any).google_calendar_event_id;
      }
    }

    const { error: updateError } = await supabase
      .from("internal_tasks")
      .update(taskUpdateData)
      .eq("id", task_id);

    if (updateError) {
      console.error("Error updating task:", updateError);
    }

    // Register meeting in deal history if deal_id exists
    if (task.deal_id) {
      try {
        // Get responsible user name
        const userId = task.assigned_to || task.created_by;
        let userName = "Vendedor";
        if (userId) {
          const { data: userData } = await supabase
            .from("users")
            .select("name")
            .eq("id", userId)
            .single();
          if (userData?.name) {
            userName = userData.name;
          }
        }

        // Format meeting date
        const meetingDate = new Date(start_time);
        const formattedDate = meetingDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const platformLabel = platform === "zoom" ? "Zoom" : "Google Meet";

        // Create deal activity with meeting link
        const { error: activityError } = await supabase
          .from("deal_activities")
          .insert({
            account_id: task.account_id,
            deal_id: task.deal_id,
            type: "meeting",
            title: `🔗 Reunião ${platformLabel} Agendada`,
            content: `**Vendedor:** ${userName}\n**Data:** ${formattedDate}\n**Link da Reunião:** [Clique para entrar](${meetingResult.meeting_url})`,
            user_id: userId,
          });

        if (activityError) {
          console.error("Error creating deal activity:", activityError);
        } else {
          console.log("Meeting registered in deal history");
        }
      } catch (historyError) {
        console.error("Error registering meeting in history:", historyError);
        // Don't throw - meeting was created successfully, history is secondary
      }
    }

    // Only schedule email if send_email is not false AND participant has email
    if (send_email !== false && participant_email) {
      // Prepare HTML email content - replace placeholders with actual values
      const passwordDisplay = meetingResult.meeting_password || "Não requer senha";
      const emailHtml = email_message
        .replace("{MEETING_URL}", meetingResult.meeting_url)
        .replace("{MEETING_PASSWORD}", passwordDisplay)
        .replace(/\n/g, "<br>");

      // Schedule email
      const { error: emailError } = await supabase
        .from("email_queue")
        .insert({
          account_id: task.account_id,
          task_id: task_id,
          lead_id: lead_id || null,
          recipient_email: participant_email,
          recipient_name: participant_name,
          subject: email_subject,
          html_content: emailHtml,
          meeting_url: meetingResult.meeting_url,
          send_at: email_send_at,
          status: "pending",
        });

      if (emailError) {
        console.error("Error scheduling email:", emailError);
      }
    } else {
      console.log("Email sending skipped: no email or user opted out");
    }

    return new Response(
      JSON.stringify({
        success: true,
        meeting_url: meetingResult.meeting_url,
        meeting_id: meetingResult.meeting_id,
        meeting_password: meetingResult.meeting_password || "",
        platform,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in create-meeting:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
