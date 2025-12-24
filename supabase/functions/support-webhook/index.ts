import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SupportWebhookPayload {
  phone: string;
  name?: string;
  content: string;
  message_type?: string;
  external_message_id?: string;
  account_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: SupportWebhookPayload = await req.json();
    console.log("Support webhook payload:", JSON.stringify(payload));

    const { phone, name, content, message_type = "text", external_message_id, account_id } = payload;

    if (!phone || !content) {
      return new Response(
        JSON.stringify({ error: "phone and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;

    // Find account_id from phone if not provided
    let ticketAccountId = account_id;
    
    if (!ticketAccountId) {
      // Try to find the client by phone to get account_id
      const { data: client } = await supabase
        .from("clients")
        .select("account_id, full_name")
        .eq("phone_e164", normalizedPhone)
        .maybeSingle();

      if (client) {
        ticketAccountId = client.account_id;
      }
    }

    if (!ticketAccountId) {
      console.log("Could not determine account_id for support ticket");
      return new Response(
        JSON.stringify({ error: "Could not determine account for this phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or create ticket for this phone
    const { data: existingTicket } = await supabase
      .from("support_tickets")
      .select("id, status")
      .eq("account_id", ticketAccountId)
      .eq("client_phone", normalizedPhone)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ticketId: string;

    if (existingTicket) {
      ticketId = existingTicket.id;
      console.log(`Found existing ticket: ${ticketId}`);

      // Update ticket updated_at
      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticketId);
    } else {
      // Create new ticket
      const { data: newTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          account_id: ticketAccountId,
          client_phone: normalizedPhone,
          client_name: name || null,
          status: "open",
          priority: "normal",
          subject: content.substring(0, 100),
        })
        .select("id")
        .single();

      if (ticketError) {
        console.error("Error creating ticket:", ticketError);
        return new Response(
          JSON.stringify({ error: ticketError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      ticketId = newTicket.id;
      console.log(`Created new ticket: ${ticketId}`);
    }

    // Insert message
    const { error: messageError } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "client",
        content,
        message_type,
        external_message_id,
      });

    if (messageError) {
      console.error("Error inserting message:", messageError);
      return new Response(
        JSON.stringify({ error: messageError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Support message saved successfully");

    return new Response(
      JSON.stringify({ success: true, ticket_id: ticketId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Support webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
