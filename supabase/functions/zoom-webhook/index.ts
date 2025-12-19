import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp",
};

// Security constants
const MAX_TOPIC_LENGTH = 500;
const MAX_USERNAME_LENGTH = 200;
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

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

interface ZoomChallenge {
  payload: {
    plainToken: string;
  };
  event: "endpoint.url_validation";
}

// Create HMAC SHA256 hash
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

// Verify Zoom webhook signature
async function verifyZoomSignature(
  body: string, 
  signature: string | null, 
  timestamp: string | null, 
  secretToken: string
): Promise<boolean> {
  if (!signature || !timestamp || !secretToken) {
    return false;
  }

  // Check timestamp is recent (within tolerance)
  const requestTimestamp = parseInt(timestamp, 10) * 1000; // Convert to ms
  const now = Date.now();
  if (Math.abs(now - requestTimestamp) > TIMESTAMP_TOLERANCE_MS) {
    console.log("Timestamp outside tolerance window");
    return false;
  }

  // Create message for signature verification
  const message = `v0:${timestamp}:${body}`;
  const expectedSignature = await createHmacSha256(secretToken, message);
  const expectedHeader = `v0=${expectedSignature}`;

  return signature === expectedHeader;
}

// Sanitize string input
function sanitizeString(input: string | undefined, maxLength: number): string {
  if (!input) return "";
  return input.slice(0, maxLength).replace(/[<>]/g, '');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const accountIdFromQuery = url.searchParams.get("account_id");
    
    const body = await req.text();
    const payload = JSON.parse(body);
    
    console.log("Zoom webhook received:", payload.event);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get secret token from integration config or fallback to env
    let secretToken = Deno.env.get("ZOOM_WEBHOOK_SECRET") || "";
    
    if (accountIdFromQuery) {
      const { data: integration } = await supabase
        .from("integrations")
        .select("config")
        .eq("account_id", accountIdFromQuery)
        .eq("type", "zoom")
        .eq("status", "connected")
        .maybeSingle();
      
      if (integration?.config && typeof integration.config === 'object') {
        const config = integration.config as Record<string, string>;
        if (config.secret_token) {
          secretToken = config.secret_token;
        }
      }
    }

    // Handle URL validation challenge from Zoom
    if (payload.event === "endpoint.url_validation") {
      const challenge = payload as ZoomChallenge;
      const plainToken = challenge.payload.plainToken;
      
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

    // SECURITY: Verify signature for ALL non-validation events
    const signature = req.headers.get("x-zm-signature");
    const timestamp = req.headers.get("x-zm-request-timestamp");
    
    if (!await verifyZoomSignature(body, signature, timestamp, secretToken)) {
      console.log("Signature verification failed");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookPayload = payload as ZoomWebhookPayload;
    const { event, payload: eventPayload } = webhookPayload;

    // Get account_id from query param or find by integration
    let accountId = accountIdFromQuery;
    
    if (!accountId) {
      const { data: integration } = await supabase
        .from("integrations")
        .select("account_id")
        .eq("type", "zoom")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      
      if (integration) {
        accountId = integration.account_id;
      }
    }

    if (!accountId) {
      console.log("No account found for webhook");
      return new Response(
        JSON.stringify({ error: "Account not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different webhook events
    switch (event) {
      case "meeting.started": {
        console.log("Meeting started");
        
        const topic = sanitizeString(eventPayload.object.topic, MAX_TOPIC_LENGTH) || "Untitled Meeting";

        const { data: session, error: sessionError } = await supabase
          .from("live_sessions")
          .insert({
            account_id: accountId,
            platform: "zoom",
            title: topic,
            start_time: eventPayload.object.start_time || new Date().toISOString(),
            external_meeting_id: eventPayload.object.id,
          })
          .select("id")
          .single();

        if (sessionError) {
          console.error("Session creation error:", sessionError.code);
        } else {
          console.log("Live session created:", session.id);
        }
        break;
      }

      case "meeting.ended": {
        console.log("Meeting ended");
        
        const { error: updateError } = await supabase
          .from("live_sessions")
          .update({ end_time: eventPayload.object.end_time || new Date().toISOString() })
          .eq("external_meeting_id", eventPayload.object.id);

        if (updateError) {
          console.error("Session update error:", updateError.code);
        }
        break;
      }

      case "meeting.participant_joined": {
        const participant = eventPayload.object.participant;
        if (!participant) break;
        
        const userName = sanitizeString(participant.user_name, MAX_USERNAME_LENGTH);
        console.log("Participant joined");

        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, account_id, start_time, title")
          .eq("external_meeting_id", eventPayload.object.id)
          .maybeSingle();

        if (!session) break;

        // Try to find client by name match
        let clientId: string | null = null;
        if (userName) {
          const { data: matchedClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", session.account_id)
            .ilike("full_name", `%${userName}%`)
            .maybeSingle();
          
          if (matchedClient) {
            clientId = matchedClient.id;
          }
        }

        if (!clientId) {
          console.log("Could not match participant to client");
          break;
        }

        const sessionStart = new Date(session.start_time).getTime();
        const joinTime = new Date(participant.join_time || new Date()).getTime();
        const joinDelaySec = Math.max(0, Math.floor((joinTime - sessionStart) / 1000));

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
          console.error("Attendance creation error:", attendanceError.code);
        } else {
          console.log("Attendance recorded");
        }

        // Auto-create event delivery for matching live events
        const { data: clientProducts } = await supabase
          .from("client_products")
          .select("product_id")
          .eq("client_id", clientId);

        if (clientProducts && clientProducts.length > 0) {
          const productIds = clientProducts.map(cp => cp.product_id);
          
          const now = new Date();
          const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
          const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
          
          const { data: matchingEvents } = await supabase
            .from("events")
            .select(`id, title, scheduled_at, event_products!inner(product_id)`)
            .eq("account_id", session.account_id)
            .eq("event_type", "live")
            .gte("scheduled_at", windowStart.toISOString())
            .lte("scheduled_at", windowEnd.toISOString())
            .in("event_products.product_id", productIds);

          if (matchingEvents && matchingEvents.length > 0) {
            for (const event of matchingEvents) {
              const { data: existingDelivery } = await supabase
                .from("client_event_deliveries")
                .select("id")
                .eq("client_id", clientId)
                .eq("event_id", event.id)
                .maybeSingle();

              if (!existingDelivery) {
                await supabase
                  .from("client_event_deliveries")
                  .insert({
                    account_id: session.account_id,
                    client_id: clientId,
                    event_id: event.id,
                    status: "delivered",
                    delivered_at: new Date().toISOString(),
                    delivery_method: "zoom_auto",
                    notes: "Presença automática via Zoom",
                  });
              } else {
                await supabase
                  .from("client_event_deliveries")
                  .update({
                    status: "delivered",
                    delivered_at: new Date().toISOString(),
                    delivery_method: "zoom_auto",
                    notes: "Presença confirmada via Zoom",
                  })
                  .eq("id", existingDelivery.id);
              }
            }
          }
        }
        break;
      }

      case "meeting.participant_left": {
        const participant = eventPayload.object.participant;
        if (!participant) break;
        
        const userName = sanitizeString(participant.user_name, MAX_USERNAME_LENGTH);
        console.log("Participant left");

        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, account_id")
          .eq("external_meeting_id", eventPayload.object.id)
          .maybeSingle();

        if (!session) break;

        // Find client by name match
        let clientId: string | null = null;
        if (userName) {
          const { data: matchedClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", session.account_id)
            .ilike("full_name", `%${userName}%`)
            .maybeSingle();

          if (matchedClient) {
            clientId = matchedClient.id;
          }
        }

        if (!clientId) break;

        const leaveTime = participant.leave_time || new Date().toISOString();
        
        const { data: attendance } = await supabase
          .from("attendance")
          .select("id, join_time")
          .eq("live_session_id", session.id)
          .eq("client_id", clientId)
          .is("leave_time", null)
          .maybeSingle();

        if (attendance) {
          const joinTimeMs = new Date(attendance.join_time).getTime();
          const leftTimeMs = new Date(leaveTime).getTime();
          const durationSec = Math.floor((leftTimeMs - joinTimeMs) / 1000);

          await supabase
            .from("attendance")
            .update({ 
              leave_time: leaveTime,
              duration_sec: durationSec
            })
            .eq("id", attendance.id);

          console.log("Attendance updated");
        }
        break;
      }

      case "meeting.chat_message_sent": {
        console.log("Chat message in meeting");
        break;
      }

      default:
        console.log("Unhandled event:", event);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Request processing error");
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
