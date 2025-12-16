import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface MessageItem {
  phone_e164: string;
  direction: "client_to_team" | "team_to_client";
  content_text: string;
  sent_at: string;
  external_thread_id?: string;
}

interface BulkPayload {
  account_id: string;
  messages: MessageItem[];
  skip_analysis?: boolean; // Skip AI analysis for historical imports
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: BulkPayload = await req.json();
    console.log(`Bulk ingest request: ${payload.messages?.length || 0} messages for account ${payload.account_id}`);

    // Validate required fields
    if (!payload.account_id || !payload.messages || !Array.isArray(payload.messages)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: account_id, messages (array)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit batch size
    if (payload.messages.length > 500) {
      return new Response(
        JSON.stringify({ error: "Maximum 500 messages per batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all unique phone numbers
    const phoneNumbers = [...new Set(payload.messages.map(m => m.phone_e164))];
    
    // Fetch all clients for these phones in one query
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, phone_e164, account_id")
      .eq("account_id", payload.account_id)
      .in("phone_e164", phoneNumbers);

    if (clientsError) {
      console.error("Error fetching clients:", clientsError);
      return new Response(
        JSON.stringify({ error: "Database error fetching clients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create phone -> client map
    const clientMap = new Map(clients?.map(c => [c.phone_e164, c]) || []);

    // Track results
    const results = {
      total: payload.messages.length,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
      unknown_phones: [] as string[],
    };

    // Find unknown phones
    const unknownPhones = phoneNumbers.filter(p => !clientMap.has(p));
    results.unknown_phones = unknownPhones;

    // Prepare messages for insertion
    const messagesToInsert: Array<{
      account_id: string;
      client_id: string;
      source: "whatsapp_text";
      direction: "client_to_team" | "team_to_client";
      content_text: string;
      sent_at: string;
    }> = [];

    for (const msg of payload.messages) {
      // Validate message
      if (!msg.phone_e164 || !msg.direction || !msg.content_text || !msg.sent_at) {
        results.skipped++;
        continue;
      }

      // Validate phone format
      if (!msg.phone_e164.match(/^\+[1-9]\d{6,14}$/)) {
        results.skipped++;
        results.errors.push(`Invalid phone format: ${msg.phone_e164}`);
        continue;
      }

      const client = clientMap.get(msg.phone_e164);
      if (!client) {
        results.skipped++;
        continue;
      }

      messagesToInsert.push({
        account_id: payload.account_id,
        client_id: client.id,
        source: "whatsapp_text",
        direction: msg.direction,
        content_text: msg.content_text,
        sent_at: msg.sent_at,
      });
    }

    // Batch insert messages
    if (messagesToInsert.length > 0) {
      const { data: insertedMessages, error: insertError } = await supabase
        .from("message_events")
        .insert(messagesToInsert)
        .select("id");

      if (insertError) {
        console.error("Error inserting messages:", insertError);
        results.errors.push(`Insert error: ${insertError.message}`);
      } else {
        results.inserted = insertedMessages?.length || 0;
      }
    }

    console.log(`Bulk ingest complete: ${results.inserted} inserted, ${results.skipped} skipped`);

    // If not skipping analysis and we have client messages, trigger recalculation
    if (!payload.skip_analysis && results.inserted > 0) {
      // Get unique client IDs that received messages
      const clientIds = [...new Set(messagesToInsert.map(m => m.client_id))];
      
      // Trigger score recalculation for affected clients (fire and forget)
      for (const clientId of clientIds) {
        fetch(`${supabaseUrl}/functions/v1/recompute-scores`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ account_id: payload.account_id, client_id: clientId }),
        }).catch(err => console.error("Score recalc error:", err));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in bulk-ingest-messages:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
