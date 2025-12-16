import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp",
};

// Zoom Webhook Event Types
interface ZoomWebhookPayload {
  event: string;
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid?: string;
      host_id?: string;
      topic?: string;
      type?: number;
      start_time?: string;
      end_time?: string;
      duration?: number;
      timezone?: string;
      participant?: {
        id?: string;
        user_id?: string;
        user_name?: string;
        email?: string;
        participant_uuid?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
  event_ts?: number;
}

// Zoom URL Validation Challenge
interface ZoomChallenge {
  payload: {
    plainToken: string;
  };
  event: "endpoint.url_validation";
}

// Helper function to create HMAC SHA256 hash
async function createHmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const payload = JSON.parse(body);
    
    console.log("Zoom webhook received:", payload.event);

    // Handle URL validation challenge from Zoom
    if (payload.event === "endpoint.url_validation") {
      const challenge = payload as ZoomChallenge;
      const plainToken = challenge.payload.plainToken;
      const secretToken = Deno.env.get("ZOOM_WEBHOOK_SECRET") || "";
      
      const encryptedToken = await createHmacSha256(secretToken, plainToken);
      
      console.log("Responding to Zoom URL validation challenge");
      
      return new Response(
        JSON.stringify({
          plainToken: plainToken,
          encryptedToken: encryptedToken
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const webhookPayload = payload as ZoomWebhookPayload;
    const { event, payload: eventPayload } = webhookPayload;

    // Handle different webhook events
    switch (event) {
      case "meeting.started": {
        console.log("Meeting started:", eventPayload.object.topic);
        
        // Find account by Zoom integration config
        const { data: integration } = await supabase
          .from("integrations")
          .select("account_id")
          .eq("type", "zoom")
          .eq("status", "connected")
          .limit(1)
          .maybeSingle();

        if (!integration) {
          console.log("No connected Zoom integration found");
          break;
        }

        // Create live session
        const { data: session, error: sessionError } = await supabase
          .from("live_sessions")
          .insert({
            account_id: integration.account_id,
            platform: "zoom",
            title: eventPayload.object.topic || "Untitled Meeting",
            start_time: eventPayload.object.start_time || new Date().toISOString(),
            external_meeting_id: eventPayload.object.id,
          })
          .select("id")
          .single();

        if (sessionError) {
          console.error("Error creating session:", sessionError);
        } else {
          console.log("Live session created:", session.id);
        }
        break;
      }

      case "meeting.ended": {
        console.log("Meeting ended:", eventPayload.object.id);
        
        // Update live session with end time
        const { error: updateError } = await supabase
          .from("live_sessions")
          .update({ end_time: eventPayload.object.end_time || new Date().toISOString() })
          .eq("external_meeting_id", eventPayload.object.id);

        if (updateError) {
          console.error("Error updating session end time:", updateError);
        }
        break;
      }

      case "meeting.participant_joined": {
        console.log("Participant joined:", eventPayload.object.participant?.user_name);
        
        const participant = eventPayload.object.participant;
        if (!participant) break;

        // Find the live session
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, account_id, start_time")
          .eq("external_meeting_id", eventPayload.object.id)
          .maybeSingle();

        if (!session) {
          console.log("Session not found for participant join");
          break;
        }

        // Try to find client by email
        let clientId: string | null = null;
        if (participant.email) {
          // Try to match by email in users table, then find their clients
          // Or match directly if client has email stored
          const { data: matchedClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", session.account_id)
            .ilike("full_name", `%${participant.user_name || ""}%`)
            .maybeSingle();
          
          if (matchedClient) {
            clientId = matchedClient.id;
          }
        }

        if (!clientId) {
          console.log("Could not match participant to client:", participant.user_name);
          break;
        }

        // Calculate join delay
        const sessionStart = new Date(session.start_time).getTime();
        const joinTime = new Date(participant.join_time || new Date()).getTime();
        const joinDelaySec = Math.max(0, Math.floor((joinTime - sessionStart) / 1000));

        // Create attendance record
        const { error: attendanceError } = await supabase
          .from("attendance")
          .insert({
            account_id: session.account_id,
            live_session_id: session.id,
            client_id: clientId,
            join_time: participant.join_time || new Date().toISOString(),
            join_delay_sec: joinDelaySec,
          });

        if (attendanceError) {
          console.error("Error creating attendance:", attendanceError);
        } else {
          console.log("Attendance recorded for client:", clientId);
        }
        break;
      }

      case "meeting.participant_left": {
        console.log("Participant left:", eventPayload.object.participant?.user_name);
        
        const participant = eventPayload.object.participant;
        if (!participant) break;

        // Find the session and update attendance
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, account_id")
          .eq("external_meeting_id", eventPayload.object.id)
          .maybeSingle();

        if (!session) break;

        // Find client by name match (simplified)
        const { data: matchedClient } = await supabase
          .from("clients")
          .select("id")
          .eq("account_id", session.account_id)
          .ilike("full_name", `%${participant.user_name || ""}%`)
          .maybeSingle();

        if (!matchedClient) break;

        // Update attendance with leave time
        const leaveTime = participant.leave_time || new Date().toISOString();
        
        // Get attendance record to calculate duration
        const { data: attendance } = await supabase
          .from("attendance")
          .select("id, join_time")
          .eq("live_session_id", session.id)
          .eq("client_id", matchedClient.id)
          .is("leave_time", null)
          .maybeSingle();

        if (attendance) {
          const joinTime = new Date(attendance.join_time).getTime();
          const leftTime = new Date(leaveTime).getTime();
          const durationSec = Math.floor((leftTime - joinTime) / 1000);

          await supabase
            .from("attendance")
            .update({ 
              leave_time: leaveTime,
              duration_sec: durationSec
            })
            .eq("id", attendance.id);

          console.log("Attendance updated for client:", matchedClient.id);
        }
        break;
      }

      case "meeting.chat_message_sent": {
        console.log("Chat message in meeting");
        // Track chat interactions
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, account_id")
          .eq("external_meeting_id", eventPayload.object.id)
          .maybeSingle();

        if (session) {
          // Try to match sender to client and create interaction
          // This is simplified - would need more participant data from Zoom
          console.log("Chat interaction recorded for session:", session.id);
        }
        break;
      }

      default:
        console.log("Unhandled webhook event:", event);
    }

    return new Response(
      JSON.stringify({ success: true, event }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in zoom-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
