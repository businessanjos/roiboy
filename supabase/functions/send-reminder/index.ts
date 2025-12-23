import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  event_id: string;
  participants: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    client_id: string | null;
  }>;
  message: string;
  send_whatsapp: boolean;
  send_email: boolean;
  email_subject?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      .select("account_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = userData.account_id;

    const payload: ReminderRequest = await req.json();
    const { event_id, participants, message, send_whatsapp, send_email, email_subject } = payload;

    console.log("Processing reminder request:", {
      event_id,
      participants_count: participants.length,
      send_whatsapp,
      send_email,
    });

    // Get event details
    const { data: event } = await supabase
      .from("events")
      .select("id, title")
      .eq("id", event_id)
      .eq("account_id", accountId)
      .single();

    if (!event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for Evolution API integration
    let evolutionConfig: { api_url?: string; api_key?: string; instance_name?: string } | null = null;
    
    if (send_whatsapp) {
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

    const results = {
      total: participants.length,
      whatsapp_sent: 0,
      whatsapp_failed: 0,
      email_sent: 0,
      email_failed: 0,
      logs: [] as Array<{ participant: string; channel: string; status: string; error?: string }>,
    };

    // Create a reminder record first (for tracking)
    const { data: reminderRecord } = await supabase
      .from("reminders")
      .insert({
        account_id: accountId,
        name: `Lembrete: ${event.title}`,
        reminder_type: "event",
        is_active: false, // One-time reminder
        days_before: 0,
        send_whatsapp,
        send_email,
        send_notification: false,
        whatsapp_template: message,
        email_subject: email_subject || `Lembrete: ${event.title}`,
        email_template: message,
      })
      .select("id")
      .single();

    const reminderId = reminderRecord?.id;

    for (const participant of participants) {
      const personalizedMessage = message.replace(/\{nome\}/g, participant.name);

      // Send WhatsApp
      if (send_whatsapp && participant.phone) {
        let whatsappStatus = "pending";
        let errorMessage: string | null = null;

        if (evolutionConfig?.api_url && evolutionConfig?.instance_name) {
          try {
            // Clean phone number
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
              results.whatsapp_sent++;
            } else {
              const errorData = await response.json();
              whatsappStatus = "failed";
              errorMessage = errorData.message || "Erro ao enviar";
              results.whatsapp_failed++;
            }
          } catch (err) {
            whatsappStatus = "failed";
            errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
            results.whatsapp_failed++;
          }
        } else {
          whatsappStatus = "failed";
          errorMessage = "WhatsApp não configurado";
          results.whatsapp_failed++;
        }

        // Log the attempt
        if (reminderId) {
          await supabase.from("reminder_logs").insert({
            account_id: accountId,
            reminder_id: reminderId,
            client_id: participant.client_id,
            event_id: event_id,
            channel: "whatsapp",
            status: whatsappStatus,
            error_message: errorMessage,
            sent_at: whatsappStatus === "sent" ? new Date().toISOString() : null,
          });
        }

        results.logs.push({
          participant: participant.name,
          channel: "whatsapp",
          status: whatsappStatus,
          error: errorMessage || undefined,
        });
      }

      // Send Email
      if (send_email && participant.email && resend) {
        let emailStatus = "pending";
        let errorMessage: string | null = null;

        try {
          const { error: emailError } = await resend.emails.send({
            from: "Lembretes <onboarding@resend.dev>",
            to: [participant.email],
            subject: email_subject || `Lembrete: ${event.title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Lembrete de Evento</h2>
                <p>${personalizedMessage.replace(/\n/g, "<br>")}</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">Este é um lembrete automático.</p>
              </div>
            `,
          });

          if (emailError) {
            emailStatus = "failed";
            errorMessage = emailError.message;
            results.email_failed++;
          } else {
            emailStatus = "sent";
            results.email_sent++;
          }
        } catch (err) {
          emailStatus = "failed";
          errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
          results.email_failed++;
        }

        // Log the attempt
        if (reminderId) {
          await supabase.from("reminder_logs").insert({
            account_id: accountId,
            reminder_id: reminderId,
            client_id: participant.client_id,
            event_id: event_id,
            channel: "email",
            status: emailStatus,
            error_message: errorMessage,
            sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
          });
        }

        results.logs.push({
          participant: participant.name,
          channel: "email",
          status: emailStatus,
          error: errorMessage || undefined,
        });
      } else if (send_email && participant.email && !resend) {
        // Log that email couldn't be sent
        if (reminderId) {
          await supabase.from("reminder_logs").insert({
            account_id: accountId,
            reminder_id: reminderId,
            client_id: participant.client_id,
            event_id: event_id,
            channel: "email",
            status: "failed",
            error_message: "Resend API não configurada",
          });
        }

        results.email_failed++;
        results.logs.push({
          participant: participant.name,
          channel: "email",
          status: "failed",
          error: "Email não configurado",
        });
      }

      // Create notification in app
      if (participant.client_id) {
        // We could create an internal notification here if needed
      }
    }

    console.log("Reminder results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Send reminder error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to send reminders", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});