import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "payment_confirmed" | "payment_failed" | "trial_expiring" | "trial_expired" | "welcome";
  to: string;
  data?: Record<string, any>;
}

const EMAIL_TEMPLATES = {
  welcome: {
    subject: "Bem-vindo à plataforma!",
    html: (data: Record<string, any>) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Bem-vindo, ${data.name || ""}!</h1>
        <p>Sua conta foi criada com sucesso. Você tem <strong>7 dias de teste gratuito</strong> para explorar todas as funcionalidades.</p>
        <p>Comece agora:</p>
        <ul>
          <li>Cadastre seus primeiros clientes</li>
          <li>Configure integrações</li>
          <li>Explore os relatórios</li>
        </ul>
        <a href="${data.appUrl || ""}/dashboard" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Acessar plataforma</a>
        <p style="margin-top: 24px; color: #666; font-size: 14px;">Dúvidas? Responda este e-mail.</p>
      </div>
    `,
  },
  trial_expiring: {
    subject: "Seu período de teste está acabando",
    html: (data: Record<string, any>) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">⏰ Faltam ${data.daysLeft || "poucos"} dias para seu trial expirar</h1>
        <p>Olá${data.name ? ` ${data.name}` : ""},</p>
        <p>Seu período de teste termina em <strong>${data.daysLeft} dias</strong>. Não perca acesso às suas informações!</p>
        <p>Escolha um plano agora e continue usando todos os recursos:</p>
        <a href="${data.appUrl || ""}/choose-plan" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Ver planos</a>
        <p style="margin-top: 24px; color: #666; font-size: 14px;">Se tiver dúvidas, estamos aqui para ajudar.</p>
      </div>
    `,
  },
  trial_expired: {
    subject: "Seu período de teste expirou",
    html: (data: Record<string, any>) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Seu período de teste expirou</h1>
        <p>Olá${data.name ? ` ${data.name}` : ""},</p>
        <p>Seu acesso à plataforma foi bloqueado. Mas não se preocupe, seus dados estão seguros!</p>
        <p>Escolha um plano para recuperar o acesso imediatamente:</p>
        <a href="${data.appUrl || ""}/choose-plan" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Escolher plano</a>
        <p style="margin-top: 24px; color: #666; font-size: 14px;">Dúvidas? Entre em contato com nosso suporte.</p>
      </div>
    `,
  },
  payment_confirmed: {
    subject: "Pagamento confirmado!",
    html: (data: Record<string, any>) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #16a34a;">✓ Pagamento confirmado!</h1>
        <p>Olá${data.name ? ` ${data.name}` : ""},</p>
        <p>Recebemos seu pagamento com sucesso!</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Plano:</strong> ${data.planName || "N/A"}</p>
          <p style="margin: 8px 0 0;"><strong>Valor:</strong> ${data.amount || "N/A"}</p>
        </div>
        <p>Seu acesso foi liberado. Aproveite todos os recursos!</p>
        <a href="${data.appUrl || ""}/dashboard" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Acessar plataforma</a>
      </div>
    `,
  },
  payment_failed: {
    subject: "Problema com seu pagamento",
    html: (data: Record<string, any>) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">⚠️ Não conseguimos processar seu pagamento</h1>
        <p>Olá${data.name ? ` ${data.name}` : ""},</p>
        <p>Houve um problema ao processar seu pagamento. Por favor, verifique seus dados e tente novamente.</p>
        ${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ""}
        <a href="${data.appUrl || ""}/account-settings" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Tentar novamente</a>
        <p style="margin-top: 24px; color: #666; font-size: 14px;">Se precisar de ajuda, entre em contato com nosso suporte.</p>
      </div>
    `,
  },
};

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-email] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, data = {} }: EmailRequest = await req.json();
    console.log(`[send-email] Sending ${type} email to ${to}`);

    if (!type || !to) {
      throw new Error("Missing required fields: type, to");
    }

    const template = EMAIL_TEMPLATES[type];
    if (!template) {
      throw new Error(`Unknown email type: ${type}`);
    }

    // Add default app URL if not provided
    const emailData = {
      ...data,
      appUrl: data.appUrl || Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app") || "",
    };

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Sistema <onboarding@resend.dev>",
        to: [to],
        subject: template.subject,
        html: template.html(emailData),
      }),
    });

    const result = await emailResponse.json();
    
    if (!emailResponse.ok) {
      throw new Error(result.message || "Failed to send email");
    }

    console.log("[send-email] Email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);