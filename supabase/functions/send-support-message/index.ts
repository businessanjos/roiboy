import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendMessagePayload {
  ticket_id: string;
  content: string;
  sender_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: SendMessagePayload = await req.json();
    console.log("Send support message payload:", JSON.stringify(payload));

    const { ticket_id, content, sender_id } = payload;

    if (!ticket_id || !content) {
      return new Response(
        JSON.stringify({ error: "ticket_id and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ticket info
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("client_phone, account_id, first_response_at")
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error("Error fetching ticket:", ticketError);
      return new Response(
        JSON.stringify({ error: "Ticket not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save message to database
    const { error: messageError } = await supabase.from("support_messages").insert({
      ticket_id,
      sender_type: "admin",
      sender_id,
      content,
      message_type: "text",
    });

    if (messageError) {
      console.error("Error inserting message:", messageError);
      return new Response(
        JSON.stringify({ error: messageError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update first response time if not set
    if (!ticket.first_response_at) {
      await supabase
        .from("support_tickets")
        .update({ first_response_at: new Date().toISOString() })
        .eq("id", ticket_id);
    }

    // Get support WhatsApp settings
    const { data: supportSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "support_whatsapp")
      .single();

    const whatsappConfig = supportSettings?.value as {
      instance_name?: string;
      status?: string;
    } | null;

    if (!whatsappConfig?.instance_name || whatsappConfig?.status !== "connected") {
      console.log("Support WhatsApp not connected, skipping message send");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message_saved: true, 
          whatsapp_sent: false,
          reason: "Support WhatsApp not connected"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via WhatsApp
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");

    if (!UAZAPI_URL || !UAZAPI_ADMIN_TOKEN) {
      console.error("UAZAPI credentials not configured");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message_saved: true, 
          whatsapp_sent: false,
          reason: "UAZAPI not configured"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone for WhatsApp (remove + if present)
    const formattedPhone = ticket.client_phone.replace(/^\+/, "");

    const sendResponse = await fetch(`${UAZAPI_URL}/message/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UAZAPI_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        instance: whatsappConfig.instance_name,
        phone: formattedPhone,
        message: content,
      }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("Failed to send WhatsApp message:", errorText);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message_saved: true, 
          whatsapp_sent: false,
          reason: "WhatsApp send failed: " + errorText
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp message sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_saved: true, 
        whatsapp_sent: true 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send support message error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
