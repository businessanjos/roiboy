import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Custos estimados por 1M tokens (USD)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-flash-lite": { input: 0.025, output: 0.10 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "google/gemini-3-pro-preview": { input: 1.50, output: 6.00 },
};

interface UsageLimit {
  id: string;
  account_id: string;
  max_analyses_per_day: number;
  max_tokens_per_day: number;
  max_cost_per_day: number;
  alert_email: string;
  is_enabled: boolean;
  last_alert_sent_at: string | null;
}

interface DailyUsage {
  total_analyses: number;
  total_input_tokens: number;
  total_output_tokens: number;
  models_used: string[];
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  // Usando custo médio (flash-lite como padrão)
  const avgInputCost = 0.05; // per 1M tokens
  const avgOutputCost = 0.20; // per 1M tokens
  
  const inputCost = (inputTokens / 1_000_000) * avgInputCost;
  const outputCost = (outputTokens / 1_000_000) * avgOutputCost;
  
  return inputCost + outputCost;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

async function sendAlertEmail(
  resend: InstanceType<typeof Resend>,
  toEmail: string,
  alertType: string,
  thresholdValue: number,
  currentValue: number,
  usage: DailyUsage
): Promise<boolean> {
  const alertTypeLabels: Record<string, string> = {
    analyses: "Análises de IA",
    tokens: "Tokens Consumidos",
    cost: "Custo Estimado",
  };

  const formatValue = (type: string, value: number): string => {
    if (type === "cost") return `$${value.toFixed(4)}`;
    if (type === "tokens") return formatNumber(value);
    return value.toString();
  };

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const estimatedCost = estimateCost(usage.total_input_tokens, usage.total_output_tokens);

  try {
    const { error } = await resend.emails.send({
      from: "ROY Platform <alerts@omundoedequemfaz.com.br>",
      to: [toEmail],
      subject: `⚠️ Alerta de Consumo: ${alertTypeLabels[alertType]} excedeu o limite`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 15px 0; }
            .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0; }
            .stat { background: white; padding: 15px; border-radius: 6px; text-align: center; border: 1px solid #e5e7eb; }
            .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
            .stat-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
            .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">⚠️ Alerta de Consumo de IA</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">${today}</p>
            </div>
            <div class="content">
              <div class="alert-box">
                <strong>${alertTypeLabels[alertType]}</strong> excedeu o limite configurado!
                <br><br>
                <strong>Limite:</strong> ${formatValue(alertType, thresholdValue)}<br>
                <strong>Atual:</strong> ${formatValue(alertType, currentValue)} 
                <span style="color: #dc2626;">(${((currentValue / thresholdValue) * 100).toFixed(0)}%)</span>
              </div>
              
              <h3>📊 Resumo de Consumo Hoje</h3>
              <div class="stats">
                <div class="stat">
                  <div class="stat-value">${usage.total_analyses}</div>
                  <div class="stat-label">Análises</div>
                </div>
                <div class="stat">
                  <div class="stat-value">${formatNumber(usage.total_input_tokens + usage.total_output_tokens)}</div>
                  <div class="stat-label">Tokens</div>
                </div>
                <div class="stat">
                  <div class="stat-value">$${estimatedCost.toFixed(4)}</div>
                  <div class="stat-label">Custo Est.</div>
                </div>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                <strong>Modelos utilizados:</strong> ${usage.models_used.join(", ") || "Nenhum"}
              </p>
              
              <p style="color: #6b7280; font-size: 14px;">
                Este alerta é enviado apenas uma vez por dia por tipo de limite. 
                Você pode ajustar os limites nas configurações da plataforma.
              </p>
            </div>
            <div class="footer">
              ROY Platform - Monitoramento de Consumo de IA
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending alert email:", error);
      return false;
    }

    console.log(`Alert email sent to ${toEmail} for ${alertType}`);
    return true;
  } catch (error) {
    console.error("Exception sending alert email:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    // Buscar todas as configurações de limite ativas
    const { data: limits, error: limitsError } = await supabase
      .from("ai_usage_limits")
      .select("*")
      .eq("is_enabled", true);

    if (limitsError) {
      console.error("Error fetching limits:", limitsError);
      throw limitsError;
    }

    if (!limits || limits.length === 0) {
      console.log("No usage limits configured");
      return new Response(
        JSON.stringify({ message: "No limits configured", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking ${limits.length} account(s) for usage limits`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const results: { account_id: string; alerts_sent: string[] }[] = [];

    for (const limit of limits as UsageLimit[]) {
      const alertsSent: string[] = [];

      // Buscar uso de hoje para esta conta
      const { data: usageLogs, error: usageError } = await supabase
        .from("ai_usage_logs")
        .select("input_tokens, output_tokens, model")
        .eq("account_id", limit.account_id)
        .gte("created_at", todayISO);

      if (usageError) {
        console.error(`Error fetching usage for account ${limit.account_id}:`, usageError);
        continue;
      }

      const usage: DailyUsage = {
        total_analyses: usageLogs?.length || 0,
        total_input_tokens: usageLogs?.reduce((sum, log) => sum + (log.input_tokens || 0), 0) || 0,
        total_output_tokens: usageLogs?.reduce((sum, log) => sum + (log.output_tokens || 0), 0) || 0,
        models_used: [...new Set(usageLogs?.map((log) => log.model?.split("/")[1] || log.model) || [])],
      };

      const totalTokens = usage.total_input_tokens + usage.total_output_tokens;
      const estimatedCost = estimateCost(usage.total_input_tokens, usage.total_output_tokens);

      console.log(`Account ${limit.account_id}: ${usage.total_analyses} analyses, ${totalTokens} tokens, $${estimatedCost.toFixed(4)} cost`);

      // Verificar se já enviamos alerta hoje
      const { data: todayAlerts } = await supabase
        .from("ai_usage_alerts")
        .select("alert_type")
        .eq("account_id", limit.account_id)
        .gte("alert_sent_at", todayISO);

      const alertedTypes = new Set(todayAlerts?.map((a) => a.alert_type) || []);

      // Verificar limite de análises
      if (usage.total_analyses >= limit.max_analyses_per_day && !alertedTypes.has("analyses")) {
        const sent = await sendAlertEmail(
          resend,
          limit.alert_email,
          "analyses",
          limit.max_analyses_per_day,
          usage.total_analyses,
          usage
        );

        if (sent) {
          await supabase.from("ai_usage_alerts").insert({
            account_id: limit.account_id,
            alert_type: "analyses",
            threshold_value: limit.max_analyses_per_day,
            current_value: usage.total_analyses,
            email_sent_to: limit.alert_email,
          });
          alertsSent.push("analyses");
        }
      }

      // Verificar limite de tokens
      if (totalTokens >= limit.max_tokens_per_day && !alertedTypes.has("tokens")) {
        const sent = await sendAlertEmail(
          resend,
          limit.alert_email,
          "tokens",
          limit.max_tokens_per_day,
          totalTokens,
          usage
        );

        if (sent) {
          await supabase.from("ai_usage_alerts").insert({
            account_id: limit.account_id,
            alert_type: "tokens",
            threshold_value: limit.max_tokens_per_day,
            current_value: totalTokens,
            email_sent_to: limit.alert_email,
          });
          alertsSent.push("tokens");
        }
      }

      // Verificar limite de custo
      if (estimatedCost >= Number(limit.max_cost_per_day) && !alertedTypes.has("cost")) {
        const sent = await sendAlertEmail(
          resend,
          limit.alert_email,
          "cost",
          Number(limit.max_cost_per_day),
          estimatedCost,
          usage
        );

        if (sent) {
          await supabase.from("ai_usage_alerts").insert({
            account_id: limit.account_id,
            alert_type: "cost",
            threshold_value: Number(limit.max_cost_per_day),
            current_value: estimatedCost,
            email_sent_to: limit.alert_email,
          });
          alertsSent.push("cost");
        }
      }

      if (alertsSent.length > 0) {
        // Atualizar último alerta enviado
        await supabase
          .from("ai_usage_limits")
          .update({ last_alert_sent_at: new Date().toISOString() })
          .eq("id", limit.id);
      }

      results.push({ account_id: limit.account_id, alerts_sent: alertsSent });
    }

    const totalAlerts = results.reduce((sum, r) => sum + r.alerts_sent.length, 0);
    console.log(`Check complete: ${results.length} accounts, ${totalAlerts} alerts sent`);

    return new Response(
      JSON.stringify({
        message: "Usage limits check complete",
        checked: results.length,
        alerts_sent: totalAlerts,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-ai-usage-limits:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
