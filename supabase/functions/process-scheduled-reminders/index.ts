import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  console.log("Processing scheduled reminders...");

  try {
    // Find campaigns that are scheduled and due to be sent
    const now = new Date().toISOString();
    
    const { data: dueCampaigns, error: fetchError } = await supabase
      .from("reminder_campaigns")
      .select(`
        *,
        events(id, title, checkin_code)
      `)
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(5);

    if (fetchError) {
      console.error("Error fetching due campaigns:", fetchError);
      throw fetchError;
    }

    if (!dueCampaigns || dueCampaigns.length === 0) {
      console.log("No scheduled campaigns due for processing");
      return new Response(
        JSON.stringify({ success: true, message: "No campaigns to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${dueCampaigns.length} campaigns to process`);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    let totalProcessed = 0;

    for (const campaign of dueCampaigns) {
      console.log(`Processing campaign: ${campaign.id} - ${campaign.name}`);

      // Update campaign status to sending
      await supabase
        .from("reminder_campaigns")
        .update({ 
          status: "sending", 
          started_at: new Date().toISOString() 
        })
        .eq("id", campaign.id);

      // Get recipients for this campaign
      const { data: recipients, error: recipientsError } = await supabase
        .from("reminder_recipients")
        .select("*")
        .eq("campaign_id", campaign.id)
        .in("whatsapp_status", ["queued", "pending"])
        .order("send_order");

      if (recipientsError) {
        console.error(`Error fetching recipients for campaign ${campaign.id}:`, recipientsError);
        continue;
      }

      if (!recipients || recipients.length === 0) {
        console.log(`No pending recipients for campaign ${campaign.id}`);
        await supabase
          .from("reminder_campaigns")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", campaign.id);
        continue;
      }

      // Get WhatsApp integration config (UAZAPI)
      let whatsappConfig: { provider?: string; instance_name?: string; instance_token?: string } | null = null;
      
      if (campaign.send_whatsapp) {
        const { data: integration } = await supabase
          .from("integrations")
          .select("config")
          .eq("account_id", campaign.account_id)
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
      const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";

      // Derive app URL
      const appUrl = "https://preview--roy-ai.lovable.app";

      let sentCount = campaign.sent_count || 0;
      let failedCount = campaign.failed_count || 0;

      // Process each recipient
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        
        // Add random delay between sends (except for first one)
        if (i > 0) {
          await randomDelay(3, 10);
        }

        // Build dynamic links
        const linkRsvp = `${appUrl}/rsvp/${recipient.participant_id}`;
        const linkCheckin = campaign.events?.checkin_code 
          ? `${appUrl}/checkin/${campaign.events.checkin_code}` 
          : `${appUrl}/checkin/code`;
        const linkFeedback = `${appUrl}/feedback/${campaign.event_id}?p=${recipient.participant_id}`;

        // Personalize message
        const personalizedMessage = campaign.message_template
          .replace(/\{nome\}/g, recipient.recipient_name)
          .replace(/\{link_rsvp\}/g, linkRsvp)
          .replace(/\{link_checkin\}/g, linkCheckin)
          .replace(/\{link_feedback\}/g, linkFeedback);

        let whatsappStatus = recipient.whatsapp_status;
        let whatsappError: string | null = null;
        let whatsappSentAt: string | null = null;

        let emailStatus = recipient.email_status;
        let emailError: string | null = null;
        let emailSentAt: string | null = null;

        // Send WhatsApp via UAZAPI
        if (campaign.send_whatsapp && recipient.recipient_phone) {
          if (whatsappConfig?.instance_name && UAZAPI_URL && UAZAPI_ADMIN_TOKEN) {
            try {
              const cleanPhone = recipient.recipient_phone.replace(/\D/g, "");
              
              const response = await fetch(
                `${UAZAPI_URL}/message/sendText/${whatsappConfig.instance_name}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${UAZAPI_ADMIN_TOKEN}`,
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
                console.log(`WhatsApp sent to ${recipient.recipient_name} via UAZAPI`);
              } else {
                const errorData = await response.json();
                whatsappStatus = "failed";
                whatsappError = errorData.message || "Erro ao enviar";
                failedCount++;
                console.log(`WhatsApp failed for ${recipient.recipient_name}: ${whatsappError}`);
              }
            } catch (err) {
              whatsappStatus = "failed";
              whatsappError = err instanceof Error ? err.message : "Erro desconhecido";
              failedCount++;
              console.log(`WhatsApp error for ${recipient.recipient_name}: ${whatsappError}`);
            }
          } else {
            whatsappStatus = "failed";
            whatsappError = "WhatsApp não configurado. Conecte seu WhatsApp na página de integrações.";
            failedCount++;
          }
        }

        // Send Email
        if (campaign.send_email && recipient.recipient_email && resend) {
          try {
            const { error: emailErr } = await resend.emails.send({
              from: "Lembretes <onboarding@resend.dev>",
              to: [recipient.recipient_email],
              subject: campaign.email_subject || campaign.name,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">${campaign.email_subject || campaign.name}</h1>
                  </div>
                  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">
                      ${personalizedMessage.replace(/\n/g, "<br>")}
                    </div>
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
            }
          } catch (err) {
            emailStatus = "failed";
            emailError = err instanceof Error ? err.message : "Erro desconhecido";
            failedCount++;
          }
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
          .eq("id", recipient.id);

        // Update campaign progress
        await supabase
          .from("reminder_campaigns")
          .update({
            sent_count: sentCount,
            failed_count: failedCount,
          })
          .eq("id", campaign.id);
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
        .eq("id", campaign.id);

      console.log(`Campaign ${campaign.id} completed: ${sentCount} sent, ${failedCount} failed`);
      totalProcessed++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${totalProcessed} campaigns`,
        processed: totalProcessed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Process scheduled reminders error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to process reminders", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
