import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  life_event_id: string;
  client_id: string;
  name: string;
  phone: string;
  event_type: string;
  event_title: string;
  event_message: string | null;
  event_date: string | null;
  send_order: number;
}

interface CampaignRequest {
  campaign_name: string;
  recipients: Recipient[];
  message_template: string;
}

// Random delay between min and max seconds
function randomDelay(minSeconds: number, maxSeconds: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
  return new Promise(resolve => setTimeout(resolve, delay));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get auth header to identify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's account
    const { data: userData } = await supabase
      .from("users")
      .select("account_id, id")
      .eq("auth_user_id", user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = userData.account_id;
    const userId = userData.id;

    const payload: CampaignRequest = await req.json();
    const { 
      campaign_name,
      recipients, 
      message_template
    } = payload;

    console.log("Creating CX moment campaign:", {
      campaign_name,
      recipients_count: recipients.length,
      account_id: accountId,
    });

    // Validate input
    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp integration: prefer uazapi-with-token in "operacoes", then any uazapi with token.
    let integration: { id: string; sector_id: string | null; config: Record<string, string> } | null = null;

    const { data: allIntegrations } = await supabase
      .from("integrations")
      .select("id, sector_id, config")
      .eq("account_id", accountId)
      .eq("type", "whatsapp")
      .eq("status", "connected");

    const usableUazapi = (allIntegrations || []).filter((i) => {
      const cfg = (i.config || {}) as Record<string, string>;
      const prov = cfg.provider || "uazapi";
      return prov === "uazapi" && !!cfg.instance_token;
    });

    integration =
      (usableUazapi.find((i) => i.sector_id === "operacoes") as typeof integration) ||
      (usableUazapi[0] as typeof integration) ||
      null;

    if (!integration) {
      console.error("No usable UAZAPI WhatsApp integration");
      return new Response(
        JSON.stringify({ error: "Nenhum WhatsApp UAZAPI conectado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = integration.config?.provider || "uazapi";
    const instanceToken = integration.config?.instance_token;
    const UAZAPI_URL =
      integration.config?.host_url ||
      Deno.env.get("UAZAPI_URL") ||
      "https://g1.uazapi.com";
    console.log(`[cx-campaign] Using integration ${integration.id} via ${UAZAPI_URL}`);

    if (provider === "uazapi" && !instanceToken) {
      return new Response(
        JSON.stringify({ error: "Token da integração WhatsApp não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from("reminder_campaigns")
      .insert({
        account_id: accountId,
        event_id: null, // No event for CX moment campaigns
        campaign_type: "notice",
        name: campaign_name,
        message_template: message_template,
        send_whatsapp: true,
        send_email: false,
        status: "sending",
        total_recipients: recipients.length,
        started_at: new Date().toISOString(),
        created_by: userId,
        delay_min_seconds: 3,
        delay_max_seconds: 10,
      })
      .select("id")
      .single();

    if (campaignError) {
      console.error("Error creating campaign:", campaignError);
      throw new Error(`Failed to create campaign: ${campaignError.message}`);
    }

    const campaignId = campaign.id;
    console.log("Campaign created:", campaignId);

    // Create recipient records
    type RecipientStatus = "pending" | "queued" | "sending" | "sent" | "failed" | "responded";
    
    const recipientRecords = recipients.map((r, index) => ({
      account_id: accountId,
      campaign_id: campaignId,
      participant_id: null,
      client_id: r.client_id,
      recipient_name: r.name,
      recipient_phone: r.phone,
      recipient_email: null,
      whatsapp_status: "queued" as RecipientStatus,
      email_status: "pending" as RecipientStatus,
      send_order: index,
    }));

    const { error: recipientsError } = await supabase
      .from("reminder_recipients")
      .insert(recipientRecords);

    if (recipientsError) {
      console.error("Error creating recipients:", recipientsError);
      throw new Error(`Failed to create recipients: ${recipientsError.message}`);
    }

    // Process each recipient
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        // Split name into first name and last name
        const nameParts = recipient.name.trim().split(/\s+/);
        const primeiroNome = nameParts[0] || recipient.name;
        const sobrenome = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        
        // Format event date
        const momentoData = recipient.event_date 
          ? new Date(recipient.event_date).toLocaleDateString("pt-BR")
          : "";

        // Personalize message
        const personalizedMessage = message_template
          .replace(/\{nome\}/gi, recipient.name)
          .replace(/\{primeiro_nome\}/gi, primeiroNome)
          .replace(/\{sobrenome\}/gi, sobrenome)
          .replace(/\{momento_titulo\}/gi, recipient.event_title)
          .replace(/\{momento_tipo\}/gi, recipient.event_type)
          .replace(/\{momento_data\}/gi, momentoData)
          .replace(/\{momento_mensagem\}/gi, recipient.event_message || "");

        // Mark as sending
        await supabase
          .from("reminder_recipients")
          .update({
            whatsapp_status: "sending",
          })
          .eq("campaign_id", campaignId)
          .eq("recipient_phone", recipient.phone);

        // Send via WhatsApp
        let whatsappSuccess = false;
        let whatsappError: string | null = null;

        const phoneClean = recipient.phone.replace(/\D/g, "");
        
        if (provider === "uazapi") {
          const response = await fetch(`${UAZAPI_URL}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": instanceToken! },
            body: JSON.stringify({ number: phoneClean, text: personalizedMessage }),
          });

          const result = await response.json();
          console.log("UAZAPI response:", result);

          if (result.error === false || result.chatid || result.messageid || result.messageId || result.status?.toLowerCase?.() === "pending") {
            whatsappSuccess = true;
          } else {
            whatsappError = result.message || result.error || "Unknown error";
          }
        } else {
          whatsappError = `Provider ${provider} não suportado`;
        }

        // Update recipient status
        await supabase
          .from("reminder_recipients")
          .update({
            whatsapp_status: whatsappSuccess ? "sent" : "failed",
            whatsapp_sent_at: whatsappSuccess ? new Date().toISOString() : null,
            whatsapp_error: whatsappError,
          })
          .eq("campaign_id", campaignId)
          .eq("recipient_phone", recipient.phone);

        if (whatsappSuccess) {
          sentCount++;
          console.log(`Message sent successfully to ${recipient.name}`);
        } else {
          failedCount++;
          console.log(`Message failed to ${recipient.name}: ${whatsappError}`);
        }

        // Random delay between messages
        if (recipient.send_order < recipients.length - 1) {
          await randomDelay(3, 10);
        }

      } catch (error) {
        console.error(`Error sending to ${recipient.name}:`, error);
        failedCount++;
        
        await supabase
          .from("reminder_recipients")
          .update({
            whatsapp_status: "failed",
            whatsapp_error: (error as Error).message,
          })
          .eq("campaign_id", campaignId)
          .eq("recipient_phone", recipient.phone);
      }
    }

    // Update campaign status
    await supabase
      .from("reminder_campaigns")
      .update({
        status: "completed",
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    console.log("Campaign completed:", { campaignId, sentCount, failedCount });

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaignId,
        sent_count: sentCount,
        failed_count: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Campaign error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
