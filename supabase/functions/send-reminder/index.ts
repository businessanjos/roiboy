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

    // Fetch RSVP tokens for participants
    const participantIds = participants.map(p => p.participant_id);
    const { data: participantsData } = await supabase
      .from("event_participants")
      .select("id, rsvp_token")
      .in("id", participantIds);

    const tokenMap = new Map<string, string>();
    participantsData?.forEach(p => {
      if (p.rsvp_token) {
        tokenMap.set(p.id, p.rsvp_token);
      }
    });

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

    // Get WhatsApp integration (UAZAPI)
    let whatsappConfig: { provider?: string; instance_name?: string; instance_token?: string } | null = null;
    
    if (send_whatsapp) {
      const { data: integration } = await supabase
        .from("integrations")
        .select("config")
        .eq("account_id", accountId)
        .eq("type", "whatsapp")
        .eq("status", "connected")
        .maybeSingle();

      if (integration?.config) {
        const config = integration.config as Record<string, unknown>;
        whatsappConfig = {
          provider: config.provider as string | undefined,
          instance_name: config.instance_name as string | undefined,
          instance_token: config.instance_token as string | undefined,
        };
      }
    }

    // UAZAPI config
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";

    // Get Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    // Use custom domain for links
    const appUrl = "https://cxroy.com";

    let sentCount = 0;
    let failedCount = 0;

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
          whatsapp_status: send_whatsapp && participant.phone ? "sending" : "pending",
          email_status: send_email && participant.email ? "sending" : "pending",
        })
        .eq("campaign_id", campaignId)
        .eq("participant_id", participant.participant_id);

      // Get RSVP token for this participant
      const rsvpToken = tokenMap.get(participant.participant_id);

      // Build dynamic links
      const linkRsvp = rsvpToken ? `${appUrl}/rsvp/${rsvpToken}` : `${appUrl}/rsvp/invalid`;
      const linkCheckin = event.checkin_code ? `${appUrl}/checkin/${event.checkin_code}` : `${appUrl}/checkin/code`;
      const linkFeedback = `${appUrl}/feedback/${event_id}?p=${participant.participant_id}`;

      // Personalize message
      const personalizedMessage = message_template
        .replace(/\{nome\}/g, participant.name)
        .replace(/\{link_rsvp\}/g, linkRsvp)
        .replace(/\{link_checkin\}/g, linkCheckin)
        .replace(/\{link_feedback\}/g, linkFeedback);

      let whatsappStatus = "pending";
      let whatsappError: string | null = null;
      let whatsappSentAt: string | null = null;

      let emailStatus = "pending";
      let emailError: string | null = null;
      let emailSentAt: string | null = null;

      // Send WhatsApp via UAZAPI
      if (send_whatsapp && participant.phone) {
        const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";
        
        if (whatsappConfig?.instance_name && UAZAPI_URL && UAZAPI_ADMIN_TOKEN) {
          try {
            const cleanPhone = participant.phone.replace(/\D/g, "");
            
            console.log(`Sending WhatsApp to ${cleanPhone} via ${whatsappConfig.instance_name}`);
            
            let messageSent = false;
            let lastError = "";
            
            // UAZAPI GO V2 - Documentação oficial: POST /send/text
            // Body: { number: "5511999999999", text: "mensagem" }
            // Header: token
            
            // Normalize URL - remove trailing slash if present
            const baseUrl = UAZAPI_URL.replace(/\/$/, '');
            console.log(`UAZAPI base URL: ${baseUrl}`);
            
            // UAZAPI GO v2 body format - number and text are required
            const messageBody = { 
              number: cleanPhone,
              text: personalizedMessage 
            };
            
            // If we have instance token, try instance endpoints
            if (whatsappConfig.instance_token) {
              console.log(`Using instance_token authentication: ${whatsappConfig.instance_token.slice(0, 8)}...`);
              
              // UAZAPI GO V2 documentação oficial: /send/text
              const instanceEndpoints = [
                `/send/text`,     // UAZAPI GO v2 documentação oficial
              ];
              
              for (const endpointPath of instanceEndpoints) {
                if (messageSent) break;
                
                try {
                  console.log(`Trying: POST ${endpointPath} with body: ${JSON.stringify(messageBody).substring(0, 80)}`);
                  
                  const response = await fetch(
                    `${baseUrl}${endpointPath}`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "token": whatsappConfig.instance_token,  // lowercase token as per UAZAPI docs
                      },
                      body: JSON.stringify(messageBody),
                    }
                  );
                  
                  const responseText = await response.text();
                  console.log(`Response from ${endpointPath}: ${response.status} - ${responseText.substring(0, 300)}`);

                  if (response.ok) {
                    whatsappStatus = "sent";
                    whatsappSentAt = new Date().toISOString();
                    sentCount++;
                    messageSent = true;
                    console.log(`WhatsApp sent to ${participant.name} via ${endpointPath}`);
                    break;
                  } else {
                    try {
                      const errorData = JSON.parse(responseText);
                      lastError = errorData.message || `${response.status}`;
                    } catch {
                      lastError = responseText || `${response.status}`;
                    }
                  }
                } catch (err) {
                  lastError = err instanceof Error ? err.message : "Erro de conexão";
                  console.log(`Endpoint ${endpointPath} failed: ${lastError}`);
                }
              }
            }
            
            // If still not sent, try admin endpoints (with instance name in path)
            if (!messageSent) {
              console.log(`Using admintoken authentication`);
              
              // UAZAPI GO V2 admin endpoints use /send/text/{instanceName}
              const adminEndpoints = [
                `/send/text/${whatsappConfig.instance_name}`,  // UAZAPI GO v2 admin format
              ];
              
              for (const endpointPath of adminEndpoints) {
                if (messageSent) break;
                
                try {
                  console.log(`Trying admin endpoint: POST ${endpointPath}`);
                  
                  const response = await fetch(
                    `${baseUrl}${endpointPath}`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "admintoken": UAZAPI_ADMIN_TOKEN,
                      },
                      body: JSON.stringify(messageBody),
                    }
                  );
                  
                  const responseText = await response.text();
                  console.log(`Response from ${endpointPath}: ${response.status} - ${responseText.substring(0, 200)}`);

                  if (response.ok) {
                    whatsappStatus = "sent";
                    whatsappSentAt = new Date().toISOString();
                    sentCount++;
                    messageSent = true;
                    console.log(`WhatsApp sent to ${participant.name} via ${endpointPath}`);
                    break;
                  } else {
                    try {
                      const errorData = JSON.parse(responseText);
                      lastError = errorData.message || `${response.status}`;
                    } catch {
                      lastError = responseText || `${response.status}`;
                    }
                  }
                } catch (err) {
                  lastError = err instanceof Error ? err.message : "Erro de conexão";
                  console.log(`Endpoint ${endpointPath} failed: ${lastError}`);
                }
              }
            }
            
            if (!messageSent) {
              whatsappStatus = "failed";
              whatsappError = whatsappConfig.instance_token 
                ? lastError || "Nenhum endpoint funcionou" 
                : "Token da instância não encontrado. Por favor, reconecte o WhatsApp na página de Integrações.";
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
          whatsappError = !UAZAPI_ADMIN_TOKEN 
            ? "UAZAPI_ADMIN_TOKEN não configurado" 
            : "WhatsApp não configurado. Conecte seu WhatsApp na página de integrações.";
          failedCount++;
        }
      }

      // Send Email
      if (send_email && participant.email && resend) {
        try {
          const { error: emailErr } = await resend.emails.send({
            from: "Lembretes <onboarding@resend.dev>",
            to: [participant.email],
            subject: email_subject || campaign_name,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">${email_subject || campaign_name}</h1>
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
      } else if (send_email && participant.email && !resend) {
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

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaignId,
        sent_count: sentCount,
        failed_count: failedCount,
        message: `Campanha concluída: ${sentCount} enviados, ${failedCount} falharam`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Send reminder error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to create campaign", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
