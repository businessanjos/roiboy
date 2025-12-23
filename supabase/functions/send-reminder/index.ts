import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Participant {
  participant_id: string;
  client_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  send_order: number;
}

interface CampaignRequest {
  event_id: string;
  campaign_name: string;
  campaign_type: "notice" | "rsvp" | "checkin" | "feedback";
  participants: Participant[];
  message_template: string;
  email_subject?: string;
  send_whatsapp: boolean;
  send_email: boolean;
}

// Random delay between min and max seconds
function randomDelay(minSeconds: number, maxSeconds: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
  return new Promise(resolve => setTimeout(resolve, delay));
}

serve(async (req) => {
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
      event_id, 
      campaign_name, 
      campaign_type,
      participants, 
      message_template, 
      email_subject,
      send_whatsapp, 
      send_email 
    } = payload;

    console.log("Creating reminder campaign:", {
      event_id,
      campaign_name,
      campaign_type,
      participants_count: participants.length,
      send_whatsapp,
      send_email,
    });

    // Verify event belongs to account
    const { data: event } = await supabase
      .from("events")
      .select("id, title, checkin_code")
      .eq("id", event_id)
      .eq("account_id", accountId)
      .single();

    if (!event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("reminder_campaigns")
      .insert({
        account_id: accountId,
        event_id: event_id,
        campaign_type: campaign_type,
        name: campaign_name,
        message_template: message_template,
        email_subject: email_subject || `${campaign_name}`,
        send_whatsapp: send_whatsapp,
        send_email: send_email,
        status: "sending",
        total_recipients: participants.length,
        started_at: new Date().toISOString(),
        created_by: userId,
        delay_min_seconds: 3,
        delay_max_seconds: 10,
      })
      .select("id")
      .single();

    if (campaignError || !campaign) {
      console.error("Error creating campaign:", campaignError);
      return new Response(
        JSON.stringify({ error: "Failed to create campaign", details: campaignError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaignId = campaign.id;

    // Create recipient records
    const recipientRecords = participants.map((p, index) => ({
      account_id: accountId,
      campaign_id: campaignId,
      participant_id: p.participant_id,
      client_id: p.client_id,
      recipient_name: p.name,
      recipient_phone: p.phone,
      recipient_email: p.email,
      whatsapp_status: send_whatsapp && p.phone ? "queued" : "pending",
      email_status: send_email && p.email ? "queued" : "pending",
      send_order: index,
    }));

    const { error: recipientsError } = await supabase
      .from("reminder_recipients")
      .insert(recipientRecords);

    if (recipientsError) {
      console.error("Error creating recipients:", recipientsError);
    }

    // Return immediately with campaign ID - processing continues in background
    const response = new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaignId,
        message: "Campaign created and sending started",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    // Process sending in the background (edge runtime limitation workaround)
    // We'll use a separate function call for actual sending
    EdgeRuntime.waitUntil(processCampaignSending(
      supabase,
      campaignId,
      accountId,
      event,
      participants,
      message_template,
      email_subject || campaign_name,
      send_whatsapp,
      send_email
    ));

    return response;

  } catch (error) {
    console.error("Send reminder error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to create campaign", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processCampaignSending(
  supabase: any,
  campaignId: string,
  accountId: string,
  event: any,
  participants: Participant[],
  messageTemplate: string,
  emailSubject: string,
  sendWhatsapp: boolean,
  sendEmail: boolean
) {
  console.log(`Starting background processing for campaign ${campaignId}`);
  
  let sentCount = 0;
  let failedCount = 0;

  // Get Evolution API integration
  let evolutionConfig: { api_url?: string; api_key?: string; instance_name?: string } | null = null;
  
  if (sendWhatsapp) {
    const { data: integration } = await supabase
      .from("integrations")
      .select("config")
      .eq("account_id", accountId)
      .in("type", ["evolution", "whatsapp"])
      .eq("status", "connected")
      .maybeSingle();

    if (integration?.config) {
      const config = integration.config as Record<string, unknown>;
      evolutionConfig = {
        api_url: config.api_url as string | undefined,
        api_key: config.api_key as string | undefined,
        instance_name: config.instance_name as string | undefined,
      };
    }
  }

  // Get Resend API key
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resend = resendApiKey ? new Resend(resendApiKey) : null;

  // Get base URL for links
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '') || '';
  const appUrl = `https://preview--roy-ai.lovable.app`; // Replace with actual app URL

  // Process each participant with human-like delays
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    // Add random delay between sends (except for first one)
    if (i > 0) {
      await randomDelay(3, 10);
    }

    // Update recipient status to "sending"
    await supabase
      .from("reminder_recipients")
      .update({ 
        whatsapp_status: sendWhatsapp && participant.phone ? "sending" : undefined,
        email_status: sendEmail && participant.email ? "sending" : undefined,
      })
      .eq("campaign_id", campaignId)
      .eq("participant_id", participant.participant_id);

    // Personalize message
    let personalizedMessage = messageTemplate
      .replace(/\{nome\}/g, participant.name)
      .replace(/\{link_rsvp\}/g, `${appUrl}/rsvp/${participant.participant_id}`)
      .replace(/\{link_checkin\}/g, `${appUrl}/checkin/${event.checkin_code || 'code'}`)
      .replace(/\{link_feedback\}/g, `${appUrl}/feedback/${event.id}?p=${participant.participant_id}`);

    let whatsappStatus = "pending";
    let whatsappError: string | null = null;
    let whatsappSentAt: string | null = null;

    let emailStatus = "pending";
    let emailError: string | null = null;
    let emailSentAt: string | null = null;

    // Send WhatsApp
    if (sendWhatsapp && participant.phone) {
      if (evolutionConfig?.api_url && evolutionConfig?.instance_name) {
        try {
          const cleanPhone = participant.phone.replace(/\D/g, "");
          
          const response = await fetch(
            `${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": evolutionConfig.api_key || "",
              },
              body: JSON.stringify({
                number: cleanPhone,
                text: personalizedMessage,
              }),
            }
          );

          if (response.ok) {
            whatsappStatus = "sent";
            whatsappSentAt = new Date().toISOString();
            sentCount++;
            console.log(`WhatsApp sent to ${participant.name}`);
          } else {
            const errorData = await response.json();
            whatsappStatus = "failed";
            whatsappError = errorData.message || "Erro ao enviar";
            failedCount++;
            console.log(`WhatsApp failed for ${participant.name}: ${whatsappError}`);
          }
        } catch (err) {
          whatsappStatus = "failed";
          whatsappError = err instanceof Error ? err.message : "Erro desconhecido";
          failedCount++;
          console.log(`WhatsApp error for ${participant.name}: ${whatsappError}`);
        }
      } else {
        whatsappStatus = "failed";
        whatsappError = "WhatsApp não configurado";
        failedCount++;
      }
    }

    // Send Email
    if (sendEmail && participant.email && resend) {
      try {
        const { error: emailErr } = await resend.emails.send({
          from: "Lembretes <onboarding@resend.dev>",
          to: [participant.email],
          subject: emailSubject,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">${emailSubject}</h1>
              </div>
              <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">
                  ${personalizedMessage.replace(/\n/g, "<br>")}
                </div>
              </div>
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p>Este é um lembrete automático.</p>
              </div>
            </div>
          `,
        });

        if (emailErr) {
          emailStatus = "failed";
          emailError = emailErr.message;
          failedCount++;
        } else {
          emailStatus = "sent";
          emailSentAt = new Date().toISOString();
          sentCount++;
          console.log(`Email sent to ${participant.name}`);
        }
      } catch (err) {
        emailStatus = "failed";
        emailError = err instanceof Error ? err.message : "Erro desconhecido";
        failedCount++;
      }
    } else if (sendEmail && participant.email && !resend) {
      emailStatus = "failed";
      emailError = "Resend API não configurada";
      failedCount++;
    }

    // Update recipient record
    await supabase
      .from("reminder_recipients")
      .update({
        whatsapp_status: whatsappStatus,
        email_status: emailStatus,
        whatsapp_sent_at: whatsappSentAt,
        email_sent_at: emailSentAt,
        whatsapp_error: whatsappError,
        email_error: emailError,
      })
      .eq("campaign_id", campaignId)
      .eq("participant_id", participant.participant_id);

    // Update campaign progress
    await supabase
      .from("reminder_campaigns")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq("id", campaignId);
  }

  // Mark campaign as completed
  await supabase
    .from("reminder_campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      sent_count: sentCount,
      failed_count: failedCount,
    })
    .eq("id", campaignId);

  console.log(`Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`);
}

// EdgeRuntime polyfill for Deno
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};
