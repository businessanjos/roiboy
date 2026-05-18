// Edge function: análise tributária com IA (Lovable AI Gateway)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MODEL = "google/gemini-2.5-pro";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const { omie_settings_id } = await req.json();
    if (!omie_settings_id) return json({ error: "omie_settings_id obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Empresa + account
    const { data: company, error: cErr } = await admin
      .from("omie_settings")
      .select("id, account_id, cnpj, legal_name, trade_name")
      .eq("id", omie_settings_id)
      .single();
    if (cErr || !company) return json({ error: "Empresa não encontrada" }, 404);

    // Perfil tributário
    const { data: profile } = await admin
      .from("financial_tax_profile")
      .select("*")
      .eq("omie_settings_id", omie_settings_id)
      .maybeSingle();

    // Agregados financeiros (12m) — best-effort, tolerante a colunas faltantes
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const sinceIso = since.toISOString().slice(0, 10);

    const { data: entries } = await admin
      .from("financial_entries")
      .select("type, amount, category_id, due_date, paid_at, description")
      .eq("account_id", company.account_id)
      .gte("due_date", sinceIso)
      .limit(2000);

    const totals = aggregate(entries ?? []);

    const inputSummary = {
      empresa: { cnpj: company.cnpj, razao: company.legal_name, nome: company.trade_name },
      perfil: profile ?? null,
      financeiro_12m: totals,
    };

    const systemPrompt = `Você é um consultor tributário sênior brasileiro. Analise os dados a seguir e gere alertas tributários objetivos, em português do Brasil, focados em:
- adequação do regime atual (Simples/Presumido/Real) ao faturamento e mix
- classificação de produtos e serviços (anexo do Simples / CNAE)
- pró-labore dos sócios (existência, valor compatível)
- distribuição de lucros (sinais de risco fiscal)
- proximidade de tetos (MEI/Simples)
- despesas potencialmente pessoais em conta PJ
- ausência de NF emitida vs entradas bancárias

Use severidade "critical" só para risco fiscal real. "warning" para oportunidades importantes. "info" para boas práticas.
Seja concreto: nada de "consulte seu contador" como única recomendação.`;

    const userPrompt = `Dados em JSON:\n\n${JSON.stringify(inputSummary, null, 2)}\n\nGere de 3 a 8 alertas.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_tax_alerts",
              description: "Retorna alertas tributários estruturados.",
              parameters: {
                type: "object",
                properties: {
                  alertas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tipo: { type: "string" },
                        severidade: { type: "string", enum: ["info", "warning", "critical"] },
                        titulo: { type: "string" },
                        descricao: { type: "string" },
                        acao_sugerida: { type: "string" },
                      },
                      required: ["tipo", "severidade", "titulo", "descricao", "acao_sugerida"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["alertas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_tax_alerts" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Limite de requisições atingido. Tente em alguns minutos." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return json({ error: "Falha na análise de IA" }, 500);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : { alertas: [] };
    const alertas: any[] = Array.isArray(args.alertas) ? args.alertas : [];

    // Persistir alertas
    if (alertas.length) {
      await admin.from("financial_tax_alerts").insert(
        alertas.map((a) => ({
          account_id: company.account_id,
          omie_settings_id,
          tipo: String(a.tipo).slice(0, 80),
          severidade: ["info", "warning", "critical"].includes(a.severidade) ? a.severidade : "info",
          titulo: String(a.titulo).slice(0, 200),
          descricao: a.descricao,
          acao_sugerida: a.acao_sugerida,
          origem: "ai",
          status: "open",
        }))
      );
    }

    await admin.from("financial_tax_ai_runs").insert({
      account_id: company.account_id,
      omie_settings_id,
      input_summary: inputSummary,
      output: { alertas },
      model: MODEL,
      alerts_created: alertas.length,
      created_by: userId,
    });

    return json({ ok: true, alerts_created: alertas.length, alertas });
  } catch (e) {
    console.error("financial-tax-ai-analyze fatal", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function aggregate(rows: any[]) {
  let receita = 0,
    despesa = 0;
  const porMes: Record<string, { receita: number; despesa: number }> = {};
  for (const r of rows) {
    const amount = Number(r.amount ?? 0);
    const m = (r.due_date ?? "").slice(0, 7);
    if (!porMes[m]) porMes[m] = { receita: 0, despesa: 0 };
    if (r.type === "receivable" || r.type === "income" || r.type === "receita") {
      receita += amount;
      porMes[m].receita += amount;
    } else {
      despesa += amount;
      porMes[m].despesa += amount;
    }
  }
  return {
    receita_total_12m: round(receita),
    despesa_total_12m: round(despesa),
    saldo_12m: round(receita - despesa),
    por_mes: Object.fromEntries(
      Object.entries(porMes).map(([k, v]) => [k, { receita: round(v.receita), despesa: round(v.despesa) }])
    ),
    quantidade_lancamentos: rows.length,
  };
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
