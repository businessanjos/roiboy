import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const resend = new Resend(resendApiKey);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending emails that are due
    const now = new Date().toISOString();
    const { data: pendingEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", now)
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending emails:", fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("No pending emails to process");
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending emails" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${pendingEmails.length} pending emails`);

    let successCount = 0;
    let errorCount = 0;

    for (const email of pendingEmails) {
      try {
        // Mark as processing
        await supabase
          .from("email_queue")
          .update({ status: "processing" })
          .eq("id", email.id);

        // Send email via Resend
        const { error: sendError } = await resend.emails.send({
          from: "Reunião <noreply@resend.dev>",
          to: [email.recipient_email],
          subject: email.subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📅 Convite para Reunião</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
                ${email.html_content}
                ${email.meeting_url ? `
                  <div style="margin-top: 30px; text-align: center;">
                    <a href="${email.meeting_url}" 
                       style="display: inline-block; background: #667eea; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      🎥 Entrar na Reunião
                    </a>
                  </div>
                ` : ''}
                <p style="margin-top: 30px; color: #6b7280; font-size: 12px; text-align: center;">
                  Este é um email automático. Por favor, não responda.
                </p>
              </div>
            </div>
          `,
        });

        if (sendError) {
          throw sendError;
        }

        // Mark as sent
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        successCount++;
        console.log(`Email sent to ${email.recipient_email}`);
      } catch (emailError: any) {
        console.error(`Error sending email ${email.id}:`, emailError);

        // Mark as failed
        await supabase
          .from("email_queue")
          .update({
            status: "failed",
            error: emailError.message || "Unknown error",
          })
          .eq("id", email.id);

        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        processed: pendingEmails.length,
        success: successCount,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in process-meeting-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
