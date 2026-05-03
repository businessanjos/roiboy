// Lista eventos do Google Calendar do usuário autenticado em um intervalo.
// Usa user_integrations.provider = 'google' para autenticar como o próprio usuário.

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
    if (!r.ok) {
      const errText = await r.text();
      console.error("Google token refresh failed:", r.status, errText);
      return null;
    }
    return await r.json();
  } catch {
    return null;
  }
}

async function getGoogleAccessToken(
  supabase: any,
  authUserId: string,
  internalUserId: string | null,
  forceRefresh = false,
): Promise<{ accessToken: string | null; refreshToken: string | null; userId: string | null; refreshFailed: boolean }> {
  // Tenta primeiro pelo internal users.id (formato salvo pelo oauth-init),
  // depois pelo auth_user_id como fallback.
  const ids = [internalUserId, authUserId].filter(Boolean) as string[];
  let integration: any = null;
  for (const uid of ids) {
    const { data } = await supabase
      .from("user_integrations")
      .select("user_id, access_token, refresh_token, expires_at")
      .eq("user_id", uid)
      .eq("provider", "google")
      .maybeSingle();
    if (data?.access_token) {
      integration = data;
      break;
    }
  }

  if (!integration?.access_token) {
    return { accessToken: null, refreshToken: null, userId: null, refreshFailed: false };
  }

  let accessToken = integration.access_token;
  const now = Math.floor(Date.now() / 1000);
  let refreshFailed = false;

  if ((forceRefresh || (integration.expires_at && integration.expires_at < now + 300)) && integration.refresh_token) {
    const newTokens = await refreshGoogleToken(integration.refresh_token);
    if (newTokens?.access_token) {
      accessToken = newTokens.access_token;
      await supabase
        .from("user_integrations")
        .update({
          access_token: accessToken,
          expires_at: Math.floor(Date.now() / 1000) + newTokens.expires_in,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", integration.user_id)
        .eq("provider", "google");
    } else {
      refreshFailed = true;
    }
  }
  return { accessToken, refreshToken: integration.refresh_token, userId: integration.user_id, refreshFailed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = userData.user.id;

    // Resolve internal users.id (oauth-init pode ter salvo com esse id)
    const { data: internalUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    const internalUserId = internalUser?.id ?? null;

    const { timeMin, timeMax } = await req.json();
    if (!timeMin || !timeMax) {
      return new Response(JSON.stringify({ error: "timeMin e timeMax obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let tokenInfo = await getGoogleAccessToken(supabase, authUserId, internalUserId);
    let accessToken = tokenInfo.accessToken;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ events: [], connected: false, message: "Google Calendar não conectado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", new Date(timeMin).toISOString());
    url.searchParams.set("timeMax", new Date(timeMax).toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    let r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let googleErrorText: string | null = null;

    if (r.status === 401 && tokenInfo.refreshToken) {
      googleErrorText = await r.text();
      tokenInfo = await getGoogleAccessToken(supabase, authUserId, internalUserId, true);
      accessToken = tokenInfo.accessToken;
      if (accessToken && !tokenInfo.refreshFailed) {
        googleErrorText = null;
        r = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    }

    if (!r.ok) {
      const errText = googleErrorText ?? await r.text();
      console.error("Google Calendar API error:", r.status, errText);
      const needsReconnect = r.status === 401;
      return new Response(
        JSON.stringify({
          events: [],
          connected: !needsReconnect,
          needsReconnect,
          error: needsReconnect ? "GOOGLE_RECONNECT_REQUIRED" : `Google API ${r.status}`,
          message: needsReconnect ? "A conexão com o Google expirou. Reconecte sua agenda." : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await r.json();
    const events = (data.items || []).map((e: any) => ({
      id: e.id,
      title: e.summary || "(sem título)",
      description: e.description || "",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      allDay: !e.start?.dateTime,
      location: e.location || "",
      htmlLink: e.htmlLink,
      status: e.status,
      colorId: e.colorId,
      hangoutLink: e.hangoutLink,
      attendees: (e.attendees || []).length,
    }));

    return new Response(
      JSON.stringify({ events, connected: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("fetch-google-calendar-events error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal error", events: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
