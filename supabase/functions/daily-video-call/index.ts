const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { data: userData } = await supabase
      .from("users")
      .select("id, account_id, name")
      .eq("auth_user_id", user.id)
      .single();
    if (!userData) throw new Error("User not found");

    const body = await req.json();
    const { action } = body;

    if (action === "create-room") {
      const { participant_name, participant_phone, lead_id, client_id, deal_id } = body;

      // Create a Daily.co room with recording enabled
      const roomName = `roy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      
      const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roomName,
          privacy: "public",
          properties: {
            enable_chat: true,
            enable_screenshare: true,
            exp: Math.floor(Date.now() / 1000) + 3600,
            max_participants: 10,
            enable_knocking: false,
            start_video_off: false,
            start_audio_off: false,
          },
        }),
      });

      if (!dailyRes.ok) {
        const errorText = await dailyRes.text();
        console.error("Daily.co create room error:", errorText);
        throw new Error(`Failed to create video room: ${dailyRes.status}`);
      }

      const room = await dailyRes.json();

      // Create a meeting token for the host
      const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            user_name: userData.name || "Vendedor",
            is_owner: true,
            enable_recording: "cloud",
            start_cloud_recording: false,
          },
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error("Daily.co token error:", errorText);
        throw new Error("Failed to create meeting token");
      }

      const tokenData = await tokenRes.json();

      // Save session to DB
      const { data: session, error: dbError } = await supabase
        .from("video_call_sessions")
        .insert({
          account_id: userData.account_id,
          user_id: userData.id,
          lead_id: lead_id || null,
          client_id: client_id || null,
          deal_id: deal_id || null,
          daily_room_name: roomName,
          daily_room_url: room.url,
          status: "waiting",
          participant_name: participant_name || null,
          participant_phone: participant_phone || null,
        })
        .select()
        .single();

      if (dbError) {
        console.error("DB error:", dbError);
        throw new Error("Failed to save video call session");
      }

      return new Response(
        JSON.stringify({
          session_id: session.id,
          room_url: room.url,
          room_name: roomName,
          token: tokenData.token,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "start-recording") {
      const { room_name, session_id } = body;

      const recordRes = await fetch(`https://api.daily.co/v1/rooms/${room_name}/recordings/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      // Update session status
      await supabase
        .from("video_call_sessions")
        .update({ status: "recording", started_at: new Date().toISOString() })
        .eq("id", session_id);

      if (!recordRes.ok) {
        const errorText = await recordRes.text();
        console.error("Daily.co recording error:", errorText);
        // Don't throw - recording might not be available on free plan
        return new Response(
          JSON.stringify({ success: false, error: "Recording not available" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "stop-recording") {
      const { room_name, session_id } = body;

      await fetch(`https://api.daily.co/v1/rooms/${room_name}/recordings/stop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      await supabase
        .from("video_call_sessions")
        .update({ status: "processing" })
        .eq("id", session_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "end-call") {
      const { session_id, room_name } = body;

      // Calculate duration
      const { data: session } = await supabase
        .from("video_call_sessions")
        .select("started_at")
        .eq("id", session_id)
        .single();

      const duration = session?.started_at
        ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
        : 0;

      await supabase
        .from("video_call_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq("id", session_id);

      // Delete the room
      await fetch(`https://api.daily.co/v1/rooms/${room_name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      });

      // Check for recordings and trigger processing
      try {
        const recordingsRes = await fetch(
          `https://api.daily.co/v1/recordings?room_name=${room_name}`,
          { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
        );
        
        if (recordingsRes.ok) {
          const recordings = await recordingsRes.json();
          if (recordings.data && recordings.data.length > 0) {
            const recording = recordings.data[0];
            
            // Get download link
            const accessRes = await fetch(
              `https://api.daily.co/v1/recordings/${recording.id}/access-link`,
              { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
            );
            
            if (accessRes.ok) {
              const accessData = await accessRes.json();
              
              await supabase
                .from("video_call_sessions")
                .update({
                  recording_id: recording.id,
                  recording_url: accessData.download_link,
                  analysis_status: "transcribing",
                })
                .eq("id", session_id);

              // Trigger transcription + analysis pipeline
              const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
              await fetch(`${supabaseUrl}/functions/v1/process-video-call`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${supabaseAnonKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ session_id }),
              });
            }
          }
        }
      } catch (e) {
        console.error("Recording processing error:", e);
        // Non-blocking - call still ended successfully
      }

      return new Response(
        JSON.stringify({ success: true, duration }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-guest-link") {
      const { room_name, guest_name } = body;

      const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            room_name,
            user_name: guest_name || "Convidado",
            is_owner: false,
          },
        }),
      });

      if (!tokenRes.ok) throw new Error("Failed to create guest token");
      const tokenData = await tokenRes.json();

      return new Response(
        JSON.stringify({ token: tokenData.token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("daily-video-call error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
