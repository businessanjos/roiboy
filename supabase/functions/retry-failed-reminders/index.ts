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

    const { campaign_id, retry_whatsapp = true, retry_email = true } = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Retrying failed reminders for campaign:", campaign_id);

    // Get campaign and verify ownership
    const { data: campaign, error: campaignError } = await supabase
      .from("reminder_campaigns")
      .select("*, events(id, title, checkin_code)")
      .eq("id", campaign_id)
      .eq("account_id", accountId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get failed recipients
    const { data: failedRecipients, error: recipientsError } = await supabase
      .from("reminder_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .or(`whatsapp_status.eq.failed,email_status.eq.failed`);

    if (recipientsError) {
      console.error("Error fetching failed recipients:", recipientsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch recipients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!failedRecipients || failedRecipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No failed recipients to retry", retried: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${failedRecipients.length} failed recipients to retry`);

    // Get WhatsApp integration
    let whatsappConfig: { provider?: string; instance_name?: string; instance_token?: string } | null = null;

    if (retry_whatsapp && campaign.send_whatsapp) {
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

    // Get RSVP tokens for participants
    const participantIds = failedRecipients.filter(r => r.participant_id).map(r => r.participant_id);
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

    let retriedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // Process each failed recipient
    for (let i = 0; i < failedRecipients.length; i++) {
      const recipient = failedRecipients[i];

      // Add delay between sends
      if (i > 0) {
        await randomDelay(3, 8);
      }

      const shouldRetryWhatsapp = retry_whatsapp && recipient.whatsapp_status === "failed" && recipient.recipient_phone;
      const shouldRetryEmail = retry_email && recipient.email_status === "failed" && recipient.recipient_email;

      if (!shouldRetryWhatsapp && !shouldRetryEmail) {
        continue;
      }

      retriedCount++;

      // Update status to sending
      await supabase
        .from("reminder_recipients")
        .update({
          whatsapp_status: shouldRetryWhatsapp ? "sending" : recipient.whatsapp_status,
          email_status: shouldRetryEmail ? "sending" : recipient.email_status,
          whatsapp_error: shouldRetryWhatsapp ? null : recipient.whatsapp_error,
          email_error: shouldRetryEmail ? null : recipient.email_error,
        })
        .eq("id", recipient.id);

      // Build dynamic links
      const rsvpToken = recipient.participant_id ? tokenMap.get(recipient.participant_id) : null;
      const event = campaign.events as { id: string; title: string; checkin_code?: string } | null;
      const linkRsvp = rsvpToken ? `${appUrl}/rsvp/${rsvpToken}` : `${appUrl}/rsvp/invalid`;
      const linkCheckin = event?.checkin_code ? `${appUrl}/checkin/${event.checkin_code}` : `${appUrl}/checkin/code`;
      const linkFeedback = event ? `${appUrl}/feedback/${event.id}?p=${recipient.participant_id}` : "";

      // Split name into first name and last name
      const recipientName = recipient.recipient_name || "Participante";
      const nameParts = recipientName.trim().split(/\s+/);
      const primeiroNome = nameParts[0] || recipientName;
      const sobrenome = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      // Replace placeholders in message
      let finalMessage = campaign.message_template
        .replace(/\{nome\}/gi, recipientName)
        .replace(/\{primeiro_nome\}/gi, primeiroNome)
        .replace(/\{sobrenome\}/gi, sobrenome)
        .replace(/\{link_rsvp\}/gi, linkRsvp)
        .replace(/\{link_checkin\}/gi, linkCheckin)
        .replace(/\{link_feedback\}/gi, linkFeedback);

      let whatsappSuccess = !shouldRetryWhatsapp;
      let whatsappError: string | null = null;
      let emailSuccess = !shouldRetryEmail;
      let emailError: string | null = null;

      // Retry WhatsApp
      if (shouldRetryWhatsapp && whatsappConfig?.instance_token) {
        try {
          const cleanPhone = recipient.recipient_phone!.replace(/\D/g, "");
          console.log(`Retrying WhatsApp to ${cleanPhone} using token: ${whatsappConfig.instance_token.slice(0, 8)}...`);

          // UAZAPI GO V2 uses "token" header (not Authorization Bearer)
          const waResponse = await fetch(`${UAZAPI_URL}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": whatsappConfig.instance_token,
            },
            body: JSON.stringify({
              number: cleanPhone,
              text: finalMessage,
            }),
          });

          if (waResponse.ok) {
            whatsappSuccess = true;
            console.log(`WhatsApp retry sent successfully to ${cleanPhone}`);
          } else {
            const errorData = await waResponse.text();
            whatsappError = `UAZAPI error ${waResponse.status}: ${errorData.slice(0, 100)}`;
            console.error(`WhatsApp retry failed: ${whatsappError}`);
          }
        } catch (err) {
          whatsappError = (err as Error).message;
          console.error(`WhatsApp retry exception: ${whatsappError}`);
        }
      } else if (shouldRetryWhatsapp && !whatsappConfig?.instance_token) {
        whatsappError = "Token da instância não encontrado. Reconecte o WhatsApp.";
      }

      // Retry Email
      if (shouldRetryEmail && resend) {
        try {
          console.log(`Retrying email to ${recipient.recipient_email}`);

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>${campaign.email_subject || campaign.name}</h2>
              <p>${finalMessage.replace(/\n/g, "<br>")}</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #666;">Este email foi enviado automaticamente.</p>
            </div>
          `;

          const { error: emailErr } = await resend.emails.send({
            from: "Roy <noreply@cxroy.com>",
            to: recipient.recipient_email!,
            subject: campaign.email_subject || campaign.name,
            html: emailHtml,
          });

          if (!emailErr) {
            emailSuccess = true;
            console.log(`Email retry sent successfully to ${recipient.recipient_email}`);
          } else {
            emailError = emailErr.message;
            console.error(`Email retry failed: ${emailError}`);
          }
        } catch (err) {
          emailError = (err as Error).message;
          console.error(`Email retry exception: ${emailError}`);
        }
      }

      // Update recipient status
      await supabase
        .from("reminder_recipients")
        .update({
          whatsapp_status: shouldRetryWhatsapp ? (whatsappSuccess ? "sent" : "failed") : recipient.whatsapp_status,
          whatsapp_sent_at: shouldRetryWhatsapp && whatsappSuccess ? new Date().toISOString() : recipient.whatsapp_sent_at,
          whatsapp_error: shouldRetryWhatsapp ? whatsappError : recipient.whatsapp_error,
          email_status: shouldRetryEmail ? (emailSuccess ? "sent" : "failed") : recipient.email_status,
          email_sent_at: shouldRetryEmail && emailSuccess ? new Date().toISOString() : recipient.email_sent_at,
          email_error: shouldRetryEmail ? emailError : recipient.email_error,
        })
        .eq("id", recipient.id);

      if (whatsappSuccess && emailSuccess) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    // Update campaign counts
    const { data: updatedCounts } = await supabase
      .from("reminder_recipients")
      .select("whatsapp_status, email_status")
      .eq("campaign_id", campaign_id);

    if (updatedCounts) {
      const sentCount = updatedCounts.filter(r => 
        r.whatsapp_status === "sent" || r.email_status === "sent"
      ).length;
      const newFailedCount = updatedCounts.filter(r => 
        r.whatsapp_status === "failed" || r.email_status === "failed"
      ).length;

      await supabase
        .from("reminder_campaigns")
        .update({
          sent_count: sentCount,
          failed_count: newFailedCount,
        })
        .eq("id", campaign_id);
    }

    console.log(`Retry complete: ${successCount} success, ${failedCount} still failed out of ${retriedCount} retried`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reenvio concluído`,
        retried: retriedCount,
        success_count: successCount,
        failed_count: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error retrying failed reminders:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
