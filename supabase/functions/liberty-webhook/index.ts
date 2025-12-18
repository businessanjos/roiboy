import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get account_id from query params
    const url = new URL(req.url);
    const accountId = url.searchParams.get("account_id");

    if (!accountId) {
      console.error("Liberty webhook: Missing account_id");
      return new Response(
        JSON.stringify({ error: "Missing account_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    console.log("Liberty webhook received:", JSON.stringify(payload, null, 2));

    const { type, phone, content, audio_url, duration_sec, direction, timestamp, is_group, group_name, sender_phone } = payload;

    if (!type) {
      console.error("Liberty webhook: Missing type");
      return new Response(
        JSON.stringify({ error: "Missing type field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number to E.164
    const normalizePhone = (phoneNumber: string) => {
      if (!phoneNumber) return null;
      let cleaned = phoneNumber.replace(/\D/g, "");
      if (!cleaned.startsWith("55") && cleaned.length <= 11) {
        cleaned = "55" + cleaned;
      }
      return "+" + cleaned;
    };

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      console.error("Liberty webhook: Invalid phone number");
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find client by phone
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("account_id", accountId)
      .eq("phone_e164", normalizedPhone)
      .single();

    if (clientError || !client) {
      console.log(`Liberty webhook: Client not found for phone ${normalizedPhone}`);
      return new Response(
        JSON.stringify({ status: "ignored", reason: "Client not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different event types
    if (type === "message" && content) {
      // Insert text message
      const { error: insertError } = await supabase
        .from("message_events")
        .insert({
          account_id: accountId,
          client_id: client.id,
          source: "whatsapp_text",
          direction: direction === "incoming" ? "client_to_team" : "team_to_client",
          content_text: content,
          sent_at: timestamp || new Date().toISOString(),
          is_group: is_group || false,
          group_name: group_name || null,
        });

      if (insertError) {
        console.error("Liberty webhook: Error inserting message:", insertError);
        throw insertError;
      }

      console.log(`Liberty webhook: Message inserted for client ${client.id}`);
      
      // Trigger AI analysis if message is from client
      if (direction === "incoming") {
        try {
          await supabase.functions.invoke("analyze-message", {
            body: { client_id: client.id, message_text: content },
          });
          console.log("Liberty webhook: AI analysis triggered");
        } catch (aiError) {
          console.error("Liberty webhook: AI analysis error:", aiError);
        }
      }

      return new Response(
        JSON.stringify({ status: "success", type: "message", client_id: client.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "audio" && audio_url) {
      // For audio, we'll trigger the audio ingestion function
      try {
        const { data, error } = await supabase.functions.invoke("ingest-whatsapp-audio", {
          body: {
            phone: normalizedPhone,
            audio_url: audio_url,
            duration_sec: duration_sec || 0,
            direction: direction === "incoming" ? "client_to_team" : "team_to_client",
            timestamp: timestamp || new Date().toISOString(),
            is_group: is_group || false,
            group_name: group_name || null,
            account_id: accountId,
          },
        });

        if (error) {
          console.error("Liberty webhook: Audio ingestion error:", error);
          throw error;
        }

        console.log(`Liberty webhook: Audio processed for client ${client.id}`);
        return new Response(
          JSON.stringify({ status: "success", type: "audio", client_id: client.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (audioError) {
        console.error("Liberty webhook: Audio processing error:", audioError);
        return new Response(
          JSON.stringify({ error: "Audio processing failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (type === "contact") {
      // Handle new contact - could create client if needed
      console.log(`Liberty webhook: Contact event received, client exists: ${client.id}`);
      return new Response(
        JSON.stringify({ status: "success", type: "contact", client_id: client.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "deal") {
      // Handle deal/sale event - could create ROI event
      const { amount, description, deal_id } = payload;
      
      if (amount) {
        const { error: roiError } = await supabase
          .from("roi_events")
          .insert({
            account_id: accountId,
            client_id: client.id,
            category: "revenue",
            roi_type: "tangible",
            impact: amount >= 5000 ? "high" : amount >= 1000 ? "medium" : "low",
            source: "manual",
            happened_at: timestamp || new Date().toISOString(),
            evidence_snippet: description || `Venda via Liberty: R$ ${amount}`,
          });

        if (roiError) {
          console.error("Liberty webhook: Error creating ROI event:", roiError);
        } else {
          console.log(`Liberty webhook: ROI event created for deal ${deal_id}`);
        }
      }

      return new Response(
        JSON.stringify({ status: "success", type: "deal", client_id: client.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown type
    console.log(`Liberty webhook: Unknown type ${type}`);
    return new Response(
      JSON.stringify({ status: "ignored", reason: "Unknown event type" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Liberty webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
