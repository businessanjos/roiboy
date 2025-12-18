import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Meet Webhook Event Types (from Google Workspace Events API)
interface GoogleMeetEvent {
  eventType: string;
  conferenceRecord?: {
    name: string;
    startTime: string;
    endTime?: string;
    space?: string;
  };
  participant?: {
    user?: {
      displayName?: string;
      email?: string;
    };
    anonymousUser?: {
      displayName?: string;
    };
    phoneUser?: {
      displayName?: string;
    };
    earliestStartTime?: string;
    latestEndTime?: string;
  };
  transcriptEntry?: {
    participant?: string;
    text?: string;
    startTime?: string;
    endTime?: string;
  };
}

interface GooglePubSubMessage {
  message: {
    data: string; // base64 encoded JSON
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const accountIdFromQuery = url.searchParams.get("account_id");
    
    const body = await req.text();
    let payload: GoogleMeetEvent;

    // Google sends events via Pub/Sub - data is base64 encoded
    try {
      const pubsubMessage = JSON.parse(body) as GooglePubSubMessage;
      if (pubsubMessage.message?.data) {
        const decodedData = atob(pubsubMessage.message.data);
        payload = JSON.parse(decodedData);
      } else {
        // Direct webhook format
        payload = JSON.parse(body);
      }
    } catch {
      payload = JSON.parse(body);
    }

    console.log("Google Meet webhook received:", payload.eventType, "account_id:", accountIdFromQuery);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get account_id from query param or find by integration
    let accountId = accountIdFromQuery;
    
    if (!accountId) {
      // Fallback: Find account with Google integration (legacy support)
      const { data: integration } = await supabase
        .from("integrations")
        .select("account_id")
        .eq("type", "google")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

      if (integration) {
        accountId = integration.account_id;
      }
    }

    if (!accountId) {
      console.log("No account_id provided and no connected Google integration found");
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different event types
    switch (payload.eventType) {
      case "google.workspace.meet.conference.v2.started": {
        console.log("Google Meet started:", payload.conferenceRecord?.name);
        
        // Create live session
        const { data: session, error: sessionError } = await supabase
          .from("live_sessions")
          .insert({
            account_id: accountId,
            platform: "google_meet",
            title: payload.conferenceRecord?.space || "Google Meet Session",
            start_time: payload.conferenceRecord?.startTime || new Date().toISOString(),
            external_meeting_id: payload.conferenceRecord?.name,
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

      case "google.workspace.meet.conference.v2.ended": {
        console.log("Google Meet ended:", payload.conferenceRecord?.name);
        
        // Update live session with end time
        const { error: updateError } = await supabase
          .from("live_sessions")
          .update({ end_time: payload.conferenceRecord?.endTime || new Date().toISOString() })
          .eq("external_meeting_id", payload.conferenceRecord?.name);

        if (updateError) {
          console.error("Error updating session end time:", updateError);
        }
        break;
      }

      case "google.workspace.meet.participant.v2.joined": {
        console.log("Participant joined:", payload.participant?.user?.displayName);
        
        const participant = payload.participant;
        if (!participant) break;

        const displayName = participant.user?.displayName || 
                           participant.anonymousUser?.displayName || 
                           participant.phoneUser?.displayName;
        const email = participant.user?.email;

        // Find the live session
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, account_id, start_time, title")
          .eq("external_meeting_id", payload.conferenceRecord?.name)
          .maybeSingle();

        if (!session) {
          console.log("Session not found for participant join");
          break;
        }

        // Try to find client by email first, then by name
        let clientId: string | null = null;
        
        if (email) {
          // Try to match by email in emails JSONB array
          const { data: clientByEmail } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", session.account_id)
            .contains("emails", [email])
            .maybeSingle();
          
          if (clientByEmail) {
            clientId = clientByEmail.id;
          }
        }

        // Fallback to name match
        if (!clientId && displayName) {
          const { data: clientByName } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", session.account_id)
            .ilike("full_name", `%${displayName}%`)
            .maybeSingle();
          
          if (clientByName) {
            clientId = clientByName.id;
          }
        }

        if (!clientId) {
          console.log("Could not match participant to client:", displayName);
          break;
        }

        // Calculate join delay
        const sessionStart = new Date(session.start_time).getTime();
        const joinTime = new Date(participant.earliestStartTime || new Date()).getTime();
        const joinDelaySec = Math.max(0, Math.floor((joinTime - sessionStart) / 1000));

        // Create attendance record
        const { error: attendanceError } = await supabase
          .from("attendance")
          .insert({
            account_id: session.account_id,
            live_session_id: session.id,
            client_id: clientId,
            join_time: participant.earliestStartTime || new Date().toISOString(),
            join_delay_sec: joinDelaySec,
          });

        if (attendanceError) {
          console.error("Error creating attendance:", attendanceError);
        } else {
          console.log("Attendance recorded for client:", clientId);
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
            .select(`
              id,
              title,
              scheduled_at,
              event_products!inner(product_id)
            `)
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
                const { error: deliveryError } = await supabase
                  .from("client_event_deliveries")
                  .insert({
                    account_id: session.account_id,
                    client_id: clientId,
                    event_id: event.id,
                    status: "delivered",
                    delivered_at: new Date().toISOString(),
                    delivery_method: "google_meet_auto",
                    notes: `Presença automática via Google Meet - ${session.title}`,
                  });

                if (deliveryError) {
                  console.error("Error creating event delivery:", deliveryError);
                } else {
                  console.log("Event delivery created for client:", clientId, "event:", event.id);
                }
              } else {
                await supabase
                  .from("client_event_deliveries")
                  .update({
                    status: "delivered",
                    delivered_at: new Date().toISOString(),
                    delivery_method: "google_meet_auto",
                    notes: `Presença confirmada via Google Meet - ${session.title}`,
                  })
                  .eq("id", existingDelivery.id);
                  
                console.log("Event delivery updated for client:", clientId, "event:", event.id);
              }
            }
          }
        }
        break;
      }

      case "google.workspace.meet.participant.v2.left": {
        console.log("Participant left:", payload.participant?.user?.displayName);
        
        const participant = payload.participant;
        if (!participant) break;

        const displayName = participant.user?.displayName || 
                           participant.anonymousUser?.displayName;
        const email = participant.user?.email;

        // Find the session
        const { data: session } = await supabase
          .from("live_sessions")
          .select("id, account_id")
          .eq("external_meeting_id", payload.conferenceRecord?.name)
          .maybeSingle();

        if (!session) break;

        // Find client
        let clientId: string | null = null;
        
        if (email) {
          const { data: clientByEmail } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", session.account_id)
            .contains("emails", [email])
            .maybeSingle();
          
          if (clientByEmail) {
            clientId = clientByEmail.id;
          }
        }

        if (!clientId && displayName) {
          const { data: clientByName } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", session.account_id)
            .ilike("full_name", `%${displayName}%`)
            .maybeSingle();
          
          if (clientByName) {
            clientId = clientByName.id;
          }
        }

        if (!clientId) break;

        // Update attendance with leave time
        const leaveTime = participant.latestEndTime || new Date().toISOString();
        
        const { data: attendance } = await supabase
          .from("attendance")
          .select("id, join_time")
          .eq("live_session_id", session.id)
          .eq("client_id", clientId)
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

          console.log("Attendance updated for client:", clientId);
        }
        break;
      }

      default:
        console.log("Unhandled webhook event:", payload.eventType);
    }

    return new Response(
      JSON.stringify({ success: true, eventType: payload.eventType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in google-meet-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
